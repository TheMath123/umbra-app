/**
 * Conversão de markdown para os formatos de exportação (HTML, texto puro
 * e DOCX). Reaproveita o mesmo parser (`@lezer/markdown` + GFM) já usado
 * pelo editor live preview — é o parser que já foi validado contra os
 * arquivos reais do usuário (exportação do Notion, tabelas, listas de
 * tarefa), então a exportação sempre enxerga a mesma árvore de sintaxe
 * que a pré-via mostra em tela.
 *
 * MD é tratado à parte (é só o texto original — ver `+page.svelte`).
 */
import { parser as baseParser, GFM } from '@lezer/markdown';
import type { SyntaxNode } from '@lezer/common';
import {
	AlignmentType,
	BorderStyle,
	Document as DocxDocument,
	ExternalHyperlink,
	HeadingLevel,
	ImageRun,
	LevelFormat,
	Packer,
	Paragraph,
	ShadingType,
	Table as DocxTable,
	TableCell as DocxTableCell,
	TableRow as DocxTableRow,
	TextRun,
	WidthType
} from 'docx';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isExternalLink, resolveRelativePath } from './paths';

const parser = baseParser.configure([GFM]);

const MONO_FONT = 'Consolas';
const CODE_SHADING = 'F4F4F5';
const HEADER_SHADING = 'F4F4F5';
const MUTED_COLOR = '6B6B70';
const ACCENT_COLOR = '4F46E5';
const BORDER_COLOR = 'E2E2E5';
const ORDERED_LIST_REF = 'md-export-ordered';

// ---------------------------------------------------------------------
// Utilidades de árvore compartilhadas pelos três formatos
// ---------------------------------------------------------------------

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Range "interno" de um nó com marcadores nas pontas (ex.: `**negrito**`
 *  → range sem os `**`). */
function innerRange(node: SyntaxNode, markName: string): { from: number; to: number } {
	const marks = node.getChildren(markName);
	return { from: marks[0]?.to ?? node.from, to: marks[marks.length - 1]?.from ?? node.to };
}

function imageInfo(node: SyntaxNode, doc: string): { url: string; alt: string } {
	const urlNode = node.getChild('URL');
	const url = urlNode ? doc.slice(urlNode.from, urlNode.to) : '';
	const marks = node.getChildren('LinkMark');
	const alt = marks.length >= 2 ? doc.slice(marks[0].to, marks[1].from) : '';
	return { url, alt };
}

function linkInfo(node: SyntaxNode, doc: string): { url: string; from: number; to: number } {
	const urlNode = node.getChild('URL');
	const marks = node.getChildren('LinkMark');
	const url = urlNode ? doc.slice(urlNode.from, urlNode.to) : '';
	return { url, from: marks[0]?.to ?? node.from, to: marks[1]?.from ?? node.to };
}

function resolveHref(url: string, basePath: string): string {
	return isExternalLink(url) ? url : resolveRelativePath(basePath, url);
}

function codeBody(node: SyntaxNode, doc: string): { lang: string; code: string } {
	const info = node.getChild('CodeInfo');
	const lang = info ? doc.slice(info.from, info.to) : '';
	const marks = node.getChildren('CodeMark');
	const openEnd = marks[0]?.to ?? node.from;
	const infoEnd = info?.to ?? openEnd;
	const closeStart = marks.length > 1 ? marks[marks.length - 1].from : node.to;
	let from = infoEnd;
	if (doc[from] === '\n') from += 1;
	let to = closeStart;
	if (doc[to - 1] === '\n') to -= 1;
	return { lang, code: doc.slice(Math.min(from, to), Math.max(to, from)) };
}

// ---------------------------------------------------------------------
// Imagens: baixa os bytes reais (via protocolo de asset do Tauri) para
// incorporar como data URI (HTML) ou bytes (DOCX) — o arquivo exportado
// fica autocontido, sem depender de uma pasta de imagens ao lado.
// ---------------------------------------------------------------------

interface LoadedImage {
	bytes: Uint8Array;
	mime: string;
	width: number;
	height: number;
}

const imageCache = new Map<string, Promise<LoadedImage | null>>();

function guessMime(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'svg':
			return 'image/svg+xml';
		case 'bmp':
			return 'image/bmp';
		default:
			return 'application/octet-stream';
	}
}

function naturalSize(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const blob = new Blob([new Uint8Array(bytes)], { type: mime });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		const done = (width: number, height: number) => {
			URL.revokeObjectURL(url);
			resolve({ width, height });
		};
		img.onload = () => done(img.naturalWidth || 300, img.naturalHeight || 200);
		img.onerror = () => done(300, 200);
		img.src = url;
	});
}

/** `resolvedPath` já é o caminho absoluto no disco. Retorna `null` para
 *  imagens externas/`data:` (tratadas à parte) ou que falharem ao
 *  carregar. Resultado fica em cache — a mesma imagem costuma aparecer
 *  em mais de um lugar do export de uma pasta inteira. */
async function loadLocalImage(resolvedPath: string): Promise<LoadedImage | null> {
	let promise = imageCache.get(resolvedPath);
	if (!promise) {
		promise = (async () => {
			try {
				const res = await fetch(convertFileSrc(resolvedPath));
				if (!res.ok) return null;
				const buf = new Uint8Array(await res.arrayBuffer());
				const mime = res.headers.get('content-type') || guessMime(resolvedPath);
				const { width, height } = await naturalSize(buf, mime);
				return { bytes: buf, mime, width, height };
			} catch {
				return null;
			}
		})();
		imageCache.set(resolvedPath, promise);
	}
	return promise;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

/** Pré-carrega todas as imagens locais referenciadas no documento — feito
 *  uma vez, no início da exportação, para os renderizadores não terem
 *  que entrelaçar `await` por toda a árvore (HTML/texto continuam
 *  síncronos; só o DOCX, que embute bytes de verdade, precisa do valor
 *  já resolvido no cache). */
async function preloadImages(root: SyntaxNode, doc: string, basePath: string): Promise<void> {
	const jobs: Promise<unknown>[] = [];
	root.cursor().iterate((node) => {
		if (node.name === 'Image') {
			const { url } = imageInfo(node.node, doc);
			if (url && !isExternalLink(url) && !url.startsWith('data:')) {
				jobs.push(loadLocalImage(resolveRelativePath(basePath, url)));
			}
		}
	});
	await Promise.all(jobs);
}

// ---------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------

interface HtmlCtx {
	doc: string;
	basePath: string;
}

function inlineToHtml(node: SyntaxNode, from: number, to: number, ctx: HtmlCtx): string {
	let html = '';
	let pos = from;
	let child = node.firstChild;
	while (child) {
		if (child.from >= from && child.to <= to) {
			if (child.from > pos) html += escapeHtml(ctx.doc.slice(pos, child.from));
			html += inlineNodeToHtml(child, ctx);
			pos = child.to;
		}
		child = child.nextSibling;
	}
	if (pos < to) html += escapeHtml(ctx.doc.slice(pos, to));
	return html;
}

function inlineNodeToHtml(node: SyntaxNode, ctx: HtmlCtx): string {
	switch (node.name) {
		case 'StrongEmphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return `<strong>${inlineToHtml(node, from, to, ctx)}</strong>`;
		}
		case 'Emphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return `<em>${inlineToHtml(node, from, to, ctx)}</em>`;
		}
		case 'Strikethrough': {
			const { from, to } = innerRange(node, 'StrikethroughMark');
			return `<s>${inlineToHtml(node, from, to, ctx)}</s>`;
		}
		case 'InlineCode': {
			const { from, to } = innerRange(node, 'CodeMark');
			return `<code>${escapeHtml(ctx.doc.slice(from, to))}</code>`;
		}
		case 'Link': {
			const { url, from, to } = linkInfo(node, ctx.doc);
			return `<a href="${escapeHtml(resolveHref(url, ctx.basePath))}">${inlineToHtml(node, from, to, ctx)}</a>`;
		}
		case 'URL': {
			const url = ctx.doc.slice(node.from, node.to);
			return `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
		}
		case 'Image': {
			const { url, alt } = imageInfo(node, ctx.doc);
			if (isExternalLink(url) || url.startsWith('data:')) {
				return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
			}
			const resolved = resolveRelativePath(ctx.basePath, url);
			return `<img src="__IMG__${resolved}__" alt="${escapeHtml(alt)}">`;
		}
		default:
			return escapeHtml(ctx.doc.slice(node.from, node.to));
	}
}

function cellsToHtml(row: SyntaxNode, ctx: HtmlCtx, tag: 'th' | 'td'): string {
	return row
		.getChildren('TableCell')
		.map((c) => `<${tag}>${inlineToHtml(c, c.from, c.to, ctx)}</${tag}>`)
		.join('');
}

function listItemToHtml(item: SyntaxNode, ctx: HtmlCtx): string {
	const task = item.getChild('TaskMarker');
	let inlineFrom = item.from;
	const mark = item.getChild('ListMark');
	if (mark) inlineFrom = mark.to;
	if (task) inlineFrom = task.to;

	let inner = '';
	if (task) {
		const checked = ctx.doc.slice(task.from, task.to).includes('x');
		inner += `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
	}

	const blockParts: string[] = [];
	let child = item.firstChild;
	while (child) {
		if (child.name === 'Paragraph') {
			inner += inlineToHtml(child, Math.max(child.from, inlineFrom), child.to, ctx);
		} else if (child.name === 'BulletList' || child.name === 'OrderedList') {
			blockParts.push(blockToHtml(child, ctx));
		}
		child = child.nextSibling;
	}
	return `<li>${inner}${blockParts.join('')}</li>`;
}

function blockToHtml(node: SyntaxNode, ctx: HtmlCtx): string {
	switch (node.name) {
		case 'Paragraph':
			return `<p>${inlineToHtml(node, node.from, node.to, ctx)}</p>`;
		case 'ATXHeading1':
		case 'ATXHeading2':
		case 'ATXHeading3':
		case 'ATXHeading4':
		case 'ATXHeading5':
		case 'ATXHeading6': {
			const level = node.name.slice(-1);
			const mark = node.getChild('HeaderMark');
			let from = mark ? mark.to : node.from;
			if (ctx.doc[from] === ' ') from += 1;
			return `<h${level}>${inlineToHtml(node, from, node.to, ctx)}</h${level}>`;
		}
		case 'BulletList':
			return `<ul>${node
				.getChildren('ListItem')
				.map((li) => listItemToHtml(li, ctx))
				.join('')}</ul>`;
		case 'OrderedList':
			return `<ol>${node
				.getChildren('ListItem')
				.map((li) => listItemToHtml(li, ctx))
				.join('')}</ol>`;
		case 'Blockquote': {
			const children: string[] = [];
			let c = node.firstChild;
			while (c) {
				if (c.name !== 'QuoteMark') children.push(blockToHtml(c, ctx));
				c = c.nextSibling;
			}
			return `<blockquote>${children.join('')}</blockquote>`;
		}
		case 'FencedCode':
		case 'CodeBlock': {
			const { lang, code } = codeBody(node, ctx.doc);
			const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
			return `<pre><code${cls}>${escapeHtml(code)}</code></pre>`;
		}
		case 'HorizontalRule':
			return `<hr>`;
		case 'Table': {
			const headerRows = node.getChildren('TableHeader');
			const bodyRows = node.getChildren('TableRow');
			const thead = headerRows.length
				? `<thead>${headerRows.map((r) => `<tr>${cellsToHtml(r, ctx, 'th')}</tr>`).join('')}</thead>`
				: '';
			const tbody = bodyRows.length
				? `<tbody>${bodyRows.map((r) => `<tr>${cellsToHtml(r, ctx, 'td')}</tr>`).join('')}</tbody>`
				: '';
			return `<table>${thead}${tbody}</table>`;
		}
		case 'HTMLBlock':
			return ctx.doc.slice(node.from, node.to);
		default:
			return `<p>${escapeHtml(ctx.doc.slice(node.from, node.to))}</p>`;
	}
}

const EXPORT_STYLE = `
:root{--bg:#ffffff;--surface:#f4f4f5;--border:#e2e2e5;--text:#1a1a1e;--text-muted:#6b6b70;--accent:#4f46e5}
@media(prefers-color-scheme:dark){:root{--bg:#1e1e22;--surface:#29292e;--border:#38383e;--text:#eaeaec;--text-muted:#9a9aa0;--accent:#6366f1}}
body{background:var(--bg);color:var(--text);font-family:-apple-system,'Segoe UI',Inter,Roboto,sans-serif;line-height:1.65;max-width:760px;margin:2.5rem auto;padding:0 1.5rem 4rem}
h1,h2,h3,h4,h5,h6{font-weight:700;line-height:1.3}
a{color:var(--accent)}
code{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;background:var(--surface);border-radius:4px;padding:0.1em 0.3em;font-size:0.9em}
pre{background:var(--surface);border-radius:6px;padding:12px 14px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{border-left:3px solid var(--border);margin:0;padding-left:1em;color:var(--text-muted)}
table{border-collapse:collapse;margin:0.75em 0}
th,td{border:1px solid var(--border);padding:6px 10px;text-align:left}
th{background:var(--surface)}
img{max-width:100%;border-radius:4px}
hr{border:none;border-top:1px solid var(--border);margin:1.5em 0}
`;

/** Troca os placeholders `__IMG__<caminho>__` deixados pelo render pelo
 *  data URI de fato — feito depois, de uma vez, para o render em si
 *  continuar síncrono (só a resolução final da imagem é assíncrona). */
async function replaceImagePlaceholders(html: string): Promise<string> {
	const matches = [...html.matchAll(/__IMG__(.+?)__/g)];
	let out = html;
	for (const m of matches) {
		const resolved = m[1];
		const loaded = await loadLocalImage(resolved);
		const dataUri = loaded ? `data:${loaded.mime};base64,${bytesToBase64(loaded.bytes)}` : '';
		out = out.split(m[0]).join(dataUri);
	}
	return out;
}

export async function exportMarkdownToHtml(markdown: string, basePath: string, title: string): Promise<string> {
	const tree = parser.parse(markdown);
	const top = tree.topNode;
	await preloadImages(top, markdown, basePath);

	const ctx: HtmlCtx = { doc: markdown, basePath };
	let body = '';
	let child = top.firstChild;
	while (child) {
		body += blockToHtml(child, ctx);
		child = child.nextSibling;
	}
	body = await replaceImagePlaceholders(body);

	return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${EXPORT_STYLE}</style></head><body>${body}</body></html>\n`;
}

// ---------------------------------------------------------------------
// Texto puro (.txt)
// ---------------------------------------------------------------------

function inlineToText(node: SyntaxNode, from: number, to: number, doc: string): string {
	let text = '';
	let pos = from;
	let child = node.firstChild;
	while (child) {
		if (child.from >= from && child.to <= to) {
			if (child.from > pos) text += doc.slice(pos, child.from);
			text += inlineNodeToText(child, doc);
			pos = child.to;
		}
		child = child.nextSibling;
	}
	if (pos < to) text += doc.slice(pos, to);
	return text;
}

function inlineNodeToText(node: SyntaxNode, doc: string): string {
	switch (node.name) {
		case 'StrongEmphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return inlineToText(node, from, to, doc);
		}
		case 'Emphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return inlineToText(node, from, to, doc);
		}
		case 'Strikethrough': {
			const { from, to } = innerRange(node, 'StrikethroughMark');
			return inlineToText(node, from, to, doc);
		}
		case 'InlineCode': {
			const { from, to } = innerRange(node, 'CodeMark');
			return doc.slice(from, to);
		}
		case 'Link': {
			const { url, from, to } = linkInfo(node, doc);
			const label = inlineToText(node, from, to, doc);
			return url ? `${label} (${url})` : label;
		}
		case 'URL':
			return doc.slice(node.from, node.to);
		case 'Image': {
			const { alt } = imageInfo(node, doc);
			return alt ? `[imagem: ${alt}]` : '[imagem]';
		}
		default:
			return doc.slice(node.from, node.to);
	}
}

function indentText(text: string, prefix: string): string {
	return text
		.split('\n')
		.map((l) => (l ? prefix + l : l))
		.join('\n');
}

function listItemToText(item: SyntaxNode, ordered: boolean, index: number, doc: string): string {
	const marker = ordered ? `${index}. ` : '- ';
	const task = item.getChild('TaskMarker');
	let inlineFrom = item.from;
	const mark = item.getChild('ListMark');
	if (mark) inlineFrom = mark.to;
	if (task) inlineFrom = task.to;

	let text = '';
	const nested: string[] = [];
	let child = item.firstChild;
	while (child) {
		if (child.name === 'Paragraph') {
			text += inlineToText(child, Math.max(child.from, inlineFrom), child.to, doc);
		} else if (child.name === 'BulletList' || child.name === 'OrderedList') {
			nested.push(indentText(blockToText(child, doc), '  '));
		}
		child = child.nextSibling;
	}
	const prefix = task ? (doc.slice(task.from, task.to).includes('x') ? '[x] ' : '[ ] ') : '';
	const line = marker + prefix + text;
	return nested.length ? `${line}\n${nested.join('\n')}` : line;
}

function blockToText(node: SyntaxNode, doc: string): string {
	switch (node.name) {
		case 'Paragraph':
			return inlineToText(node, node.from, node.to, doc);
		case 'ATXHeading1':
		case 'ATXHeading2':
		case 'ATXHeading3':
		case 'ATXHeading4':
		case 'ATXHeading5':
		case 'ATXHeading6': {
			const mark = node.getChild('HeaderMark');
			let from = mark ? mark.to : node.from;
			if (doc[from] === ' ') from += 1;
			return inlineToText(node, from, node.to, doc);
		}
		case 'BulletList':
			return node
				.getChildren('ListItem')
				.map((li) => listItemToText(li, false, 0, doc))
				.join('\n');
		case 'OrderedList':
			return node
				.getChildren('ListItem')
				.map((li, i) => listItemToText(li, true, i + 1, doc))
				.join('\n');
		case 'Blockquote': {
			const parts: string[] = [];
			let c = node.firstChild;
			while (c) {
				if (c.name !== 'QuoteMark') parts.push(blockToText(c, doc));
				c = c.nextSibling;
			}
			return indentText(parts.join('\n\n'), '> ');
		}
		case 'FencedCode':
		case 'CodeBlock':
			return codeBody(node, doc).code;
		case 'HorizontalRule':
			return '---';
		case 'Table': {
			const headerRows = node.getChildren('TableHeader');
			const bodyRows = node.getChildren('TableRow');
			const rowText = (r: SyntaxNode) =>
				r
					.getChildren('TableCell')
					.map((c) => inlineToText(c, c.from, c.to, doc))
					.join(' | ');
			const lines = headerRows.map(rowText);
			if (headerRows.length) lines.push(headerRows[0].getChildren('TableCell').map(() => '---').join(' | '));
			lines.push(...bodyRows.map(rowText));
			return lines.join('\n');
		}
		case 'HTMLBlock':
			return '';
		default:
			return doc.slice(node.from, node.to);
	}
}

export function exportMarkdownToText(markdown: string): string {
	const tree = parser.parse(markdown);
	const parts: string[] = [];
	let child = tree.topNode.firstChild;
	while (child) {
		const text = blockToText(child, markdown);
		if (text.trim() !== '') parts.push(text);
		child = child.nextSibling;
	}
	return parts.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------

interface RunStyle {
	bold?: boolean;
	italics?: boolean;
	strike?: boolean;
	code?: boolean;
	/** Dentro de um link — cor de destaque + sublinhado. */
	link?: boolean;
}

const HEADING_BY_LEVEL: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
	'1': HeadingLevel.HEADING_1,
	'2': HeadingLevel.HEADING_2,
	'3': HeadingLevel.HEADING_3,
	'4': HeadingLevel.HEADING_4,
	'5': HeadingLevel.HEADING_5,
	'6': HeadingLevel.HEADING_6
};

function docxRun(text: string, style: RunStyle): TextRun {
	return new TextRun({
		text,
		bold: style.bold,
		italics: style.italics,
		strike: style.strike,
		font: style.code ? MONO_FONT : undefined,
		shading: style.code ? { type: ShadingType.CLEAR, fill: CODE_SHADING, color: 'auto' } : undefined,
		color: style.link ? ACCENT_COLOR : undefined,
		underline: style.link ? {} : undefined
	});
}

function docxImageType(mime: string): 'jpg' | 'png' | 'gif' | 'bmp' {
	if (mime.includes('png')) return 'png';
	if (mime.includes('gif')) return 'gif';
	if (mime.includes('bmp')) return 'bmp';
	return 'jpg';
}

function scaledSize(width: number, height: number, maxWidth = 560): { width: number; height: number } {
	if (width <= maxWidth || width <= 0) return { width: width || maxWidth, height: height || Math.round(maxWidth * 0.6) };
	const ratio = maxWidth / width;
	return { width: maxWidth, height: Math.round(height * ratio) };
}

type DocxInline = TextRun | ImageRun | ExternalHyperlink;

async function inlineToDocxRuns(
	node: SyntaxNode,
	from: number,
	to: number,
	doc: string,
	basePath: string,
	style: RunStyle
): Promise<DocxInline[]> {
	const out: DocxInline[] = [];
	let pos = from;
	let child = node.firstChild;
	while (child) {
		if (child.from >= from && child.to <= to) {
			if (child.from > pos) {
				const t = doc.slice(pos, child.from);
				if (t) out.push(docxRun(t, style));
			}
			out.push(...(await inlineNodeToDocxRuns(child, doc, basePath, style)));
			pos = child.to;
		}
		child = child.nextSibling;
	}
	if (pos < to) {
		const t = doc.slice(pos, to);
		if (t) out.push(docxRun(t, style));
	}
	return out;
}

async function inlineNodeToDocxRuns(node: SyntaxNode, doc: string, basePath: string, style: RunStyle): Promise<DocxInline[]> {
	switch (node.name) {
		case 'StrongEmphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return inlineToDocxRuns(node, from, to, doc, basePath, { ...style, bold: true });
		}
		case 'Emphasis': {
			const { from, to } = innerRange(node, 'EmphasisMark');
			return inlineToDocxRuns(node, from, to, doc, basePath, { ...style, italics: true });
		}
		case 'Strikethrough': {
			const { from, to } = innerRange(node, 'StrikethroughMark');
			return inlineToDocxRuns(node, from, to, doc, basePath, { ...style, strike: true });
		}
		case 'InlineCode': {
			const { from, to } = innerRange(node, 'CodeMark');
			return [docxRun(doc.slice(from, to), { ...style, code: true })];
		}
		case 'Link': {
			const { url, from, to } = linkInfo(node, doc);
			const runs = await inlineToDocxRuns(node, from, to, doc, basePath, { ...style, link: true });
			const href = isExternalLink(url)
				? url
				: `file:///${resolveRelativePath(basePath, url).replace(/\\/g, '/')}`;
			const textRuns = runs.filter((r): r is TextRun => r instanceof TextRun);
			return textRuns.length ? [new ExternalHyperlink({ link: href, children: textRuns })] : [];
		}
		case 'URL': {
			const url = doc.slice(node.from, node.to);
			return [new ExternalHyperlink({ link: url, children: [docxRun(url, { ...style, link: true })] })];
		}
		case 'Image': {
			const { url, alt } = imageInfo(node, doc);
			if (isExternalLink(url) || url.startsWith('data:')) {
				return [docxRun(alt ? `[imagem: ${alt}]` : '[imagem]', style)];
			}
			const resolved = resolveRelativePath(basePath, url);
			const loaded = await loadLocalImage(resolved);
			if (!loaded) return [docxRun(alt ? `[imagem: ${alt}]` : '[imagem]', style)];
			const { width, height } = scaledSize(loaded.width, loaded.height);
			return [
				new ImageRun({
					type: docxImageType(loaded.mime),
					data: loaded.bytes,
					transformation: { width, height }
				})
			];
		}
		default:
			return [docxRun(doc.slice(node.from, node.to), style)];
	}
}

async function listItemToDocx(item: SyntaxNode, ordered: boolean, doc: string, basePath: string): Promise<Paragraph[]> {
	const task = item.getChild('TaskMarker');
	let inlineFrom = item.from;
	const mark = item.getChild('ListMark');
	if (mark) inlineFrom = mark.to;
	if (task) inlineFrom = task.to;

	const out: Paragraph[] = [];
	let child = item.firstChild;
	let first = true;
	while (child) {
		if (child.name === 'Paragraph') {
			const runs = await inlineToDocxRuns(child, Math.max(child.from, inlineFrom), child.to, doc, basePath, {});
			if (task) {
				const checked = doc.slice(task.from, task.to).includes('x');
				runs.unshift(docxRun(checked ? '☑ ' : '☐ ', {}));
			}
			out.push(
				first
					? ordered
						? new Paragraph({ numbering: { reference: ORDERED_LIST_REF, level: 0 }, children: runs })
						: new Paragraph({ bullet: { level: 0 }, children: runs })
					: new Paragraph({ indent: { left: 720 }, children: runs })
			);
			first = false;
		} else if (child.name === 'BulletList' || child.name === 'OrderedList') {
			out.push(...(await listBlockToDocx(child, doc, basePath)));
		}
		child = child.nextSibling;
	}
	return out;
}

async function listBlockToDocx(node: SyntaxNode, doc: string, basePath: string): Promise<Paragraph[]> {
	const ordered = node.name === 'OrderedList';
	const out: Paragraph[] = [];
	for (const li of node.getChildren('ListItem')) {
		out.push(...(await listItemToDocx(li, ordered, doc, basePath)));
	}
	return out;
}

/** Blocos dentro de uma citação ganham recuo e cor discreta — em vez de
 *  tentar "re-estilizar" um Paragraph já pronto (a API do docx não
 *  permite ler os filhos de volta), o miolo é montado com o próprio
 *  estilo de citação (`quoted: true`) desde a primeira montagem. */
async function blockToDocx(node: SyntaxNode, doc: string, basePath: string, quoted = false): Promise<(Paragraph | DocxTable)[]> {
	// Recuo é uma propriedade de parágrafo; itálico é aplicado nos runs de
	// texto logo abaixo (RunStyle), já que o docx não tem "itálico" no
	// nível do parágrafo.
	const quoteProps = quoted ? { indent: { left: 480 } } : {};

	switch (node.name) {
		case 'Paragraph': {
			const runs = await inlineToDocxRuns(node, node.from, node.to, doc, basePath, quoted ? { italics: true } : {});
			return [new Paragraph({ ...quoteProps, children: runs })];
		}
		case 'ATXHeading1':
		case 'ATXHeading2':
		case 'ATXHeading3':
		case 'ATXHeading4':
		case 'ATXHeading5':
		case 'ATXHeading6': {
			const level = node.name.slice(-1);
			const mark = node.getChild('HeaderMark');
			let from = mark ? mark.to : node.from;
			if (doc[from] === ' ') from += 1;
			const runs = await inlineToDocxRuns(node, from, node.to, doc, basePath, {});
			return [new Paragraph({ heading: HEADING_BY_LEVEL[level], children: runs })];
		}
		case 'BulletList':
		case 'OrderedList':
			return listBlockToDocx(node, doc, basePath);
		case 'Blockquote': {
			const out: (Paragraph | DocxTable)[] = [];
			let c = node.firstChild;
			while (c) {
				if (c.name !== 'QuoteMark') out.push(...(await blockToDocx(c, doc, basePath, true)));
				c = c.nextSibling;
			}
			return out;
		}
		case 'FencedCode':
		case 'CodeBlock': {
			const { code } = codeBody(node, doc);
			return code.split('\n').map(
				(line) =>
					new Paragraph({
						shading: { type: ShadingType.CLEAR, fill: CODE_SHADING, color: 'auto' },
						children: [new TextRun({ text: line || ' ', font: MONO_FONT, size: 20 })]
					})
			);
		}
		case 'HorizontalRule':
			return [
				new Paragraph({
					border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR } },
					children: []
				})
			];
		case 'Table': {
			const headerRows = node.getChildren('TableHeader');
			const bodyRows = node.getChildren('TableRow');
			const rowToDocx = async (r: SyntaxNode, header: boolean) =>
				new DocxTableRow({
					children: await Promise.all(
						r.getChildren('TableCell').map(async (c) => {
							const runs = await inlineToDocxRuns(c, c.from, c.to, doc, basePath, { bold: header });
							return new DocxTableCell({
								shading: header ? { type: ShadingType.CLEAR, fill: HEADER_SHADING, color: 'auto' } : undefined,
								children: [new Paragraph({ children: runs })]
							});
						})
					)
				});
			const rows = [
				...(await Promise.all(headerRows.map((r) => rowToDocx(r, true)))),
				...(await Promise.all(bodyRows.map((r) => rowToDocx(r, false))))
			];
			return [new DocxTable({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })];
		}
		default:
			return [];
	}
}

export async function exportMarkdownToDocxBase64(markdown: string, basePath: string): Promise<string> {
	const tree = parser.parse(markdown);
	const top = tree.topNode;
	await preloadImages(top, markdown, basePath);

	const children: (Paragraph | DocxTable)[] = [];
	let child = top.firstChild;
	while (child) {
		children.push(...(await blockToDocx(child, markdown, basePath)));
		child = child.nextSibling;
	}
	if (children.length === 0) children.push(new Paragraph({ children: [] }));

	const doc = new DocxDocument({
		numbering: {
			config: [
				{
					reference: ORDERED_LIST_REF,
					levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }]
				}
			]
		},
		sections: [{ children }]
	});

	return Packer.toBase64String(doc);
}
