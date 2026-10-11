<script lang="ts">
	import { untrack } from 'svelte';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { EditorView, Decoration, WidgetType, keymap, BlockType } from '@codemirror/view';
	import type { DecorationSet } from '@codemirror/view';
	import { EditorState, StateField, StateEffect, Compartment, EditorSelection, CharCategory, RangeSet } from '@codemirror/state';
	import type { EditorState as EditorStateType, Line, Range } from '@codemirror/state';
	import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
	import { GFM } from '@lezer/markdown';
	import { syntaxTree, syntaxHighlighting } from '@codemirror/language';
	import type { SyntaxNode } from '@lezer/common';
	import { defaultKeymap, history, historyKeymap, indentWithTab, redo, cursorGroupForwardWin, selectGroupForwardWin } from '@codemirror/commands';
	import { isExternalLink, resolveRelativePath } from './paths';
	import { settings, effectiveFontFamily, effectiveFontSize, effectiveLineHeight, effectiveContentWidth } from './settings.svelte';
	import { isDarkThemeActive } from './themes.svelte';
	import { codeLanguages, highlightStyleFor } from './codeSyntax';
	import { t } from './i18n.svelte';
	import type { DocStats } from './types';

	let {
		path,
		content,
		zoom = 100,
		active = true,
		onSave,
		onNavigate,
		onStats
	}: {
		path: string;
		content: string;
		zoom?: number;
		/** Se essa aba é a visível no momento — a instância continua montada
		 *  (escondida) quando o usuário troca de aba, pra preservar scroll,
		 *  cursor e histórico de undo. Usado só pra reemitir as estatísticas
		 *  da barra de status ao voltar pra essa aba. */
		active?: boolean;
		onSave: (newContent: string) => Promise<void> | void;
		onNavigate?: (path: string) => void;
		onStats?: (stats: DocStats) => void;
	} = $props();

	let editorHost = $state<HTMLDivElement | null>(null);
	let bodyEl = $state<HTMLDivElement | null>(null);
	let view: EditorView | null = null;
	let saving = $state(false);

	function resolveImageSrc(basePath: string, src: string): string {
		if (isExternalLink(src) || src.startsWith('data:')) return src;
		return convertFileSrc(resolveRelativePath(basePath, src));
	}

	function followLink(basePath: string, href: string) {
		if (isExternalLink(href)) {
			openUrl(href).catch(() => {});
		} else if (!href.startsWith('#')) {
			onNavigate?.(resolveRelativePath(basePath, href));
		}
	}

	class ImageWidget extends WidgetType {
		src: string;
		alt: string;
		constructor(src: string, alt: string) {
			super();
			this.src = src;
			this.alt = alt;
		}
		eq(other: ImageWidget) {
			return other.src === this.src && other.alt === this.alt;
		}
		toDOM() {
			// Wrapper com padding: margem no img vazaria pra fora do .cm-line e o
			// CodeMirror mede a altura sem ela.
			const wrap = document.createElement('span');
			wrap.className = 'cm-md-image-wrap';
			const img = document.createElement('img');
			img.src = this.src;
			img.alt = this.alt;
			img.className = 'cm-md-image';
			wrap.appendChild(img);
			return wrap;
		}
	}

	class BulletWidget extends WidgetType {
		eq() {
			return true;
		}
		toDOM() {
			const span = document.createElement('span');
			span.className = 'cm-md-bullet';
			span.textContent = '•';
			return span;
		}
	}

	class HrWidget extends WidgetType {
		eq() {
			return true;
		}
		get estimatedHeight() {
			return Math.round(effectiveFontSize() * 3) + 1;
		}
		toDOM() {
			const wrap = document.createElement('div');
			wrap.className = 'cm-md-hr-wrap';
			const hr = document.createElement('hr');
			hr.className = 'cm-md-hr';
			wrap.appendChild(hr);
			return wrap;
		}
	}

	// ignoreEvent fica no padrão (true): o CodeMirror não vê eventos de dentro
	// da tabela e o clique é tratado no próprio DOM (onTableMouseDown).
	class TableWidget extends WidgetType {
		rows: string[][];
		headerRowCount: number;
		aligns: (string | null)[];
		inQuote: boolean;
		basePath: string;
		key: string;
		constructor(rows: string[][], headerRowCount: number, aligns: (string | null)[], inQuote: boolean, basePath: string) {
			super();
			this.rows = rows;
			this.headerRowCount = headerRowCount;
			this.aligns = aligns;
			this.inQuote = inQuote;
			this.basePath = basePath;
			this.key = JSON.stringify([rows, headerRowCount, aligns, inQuote]);
		}
		eq(other: TableWidget) {
			return other.key === this.key;
		}
		get estimatedHeight() {
			const fs = effectiveFontSize();
			return Math.round(this.rows.length * (fs * 0.95 * effectiveLineHeight() + 13) + 1 + fs * 1.5);
		}
		toDOM(view: EditorView) {
			const wrap = document.createElement('div');
			wrap.className = this.inQuote ? 'cm-md-table-wrap cm-md-table-in-quote' : 'cm-md-table-wrap';
			const table = document.createElement('table');
			table.className = 'cm-md-table';
			this.rows.forEach((cells, i) => {
				const tr = document.createElement('tr');
				cells.forEach((html, j) => {
					const cell = document.createElement(i < this.headerRowCount ? 'th' : 'td');
					cell.innerHTML = html;
					cell.dataset.row = String(i);
					cell.dataset.col = String(j);
					if (this.aligns[j]) cell.style.textAlign = this.aligns[j]!;
					tr.appendChild(cell);
				});
				table.appendChild(tr);
			});
			wrap.appendChild(table);
			for (const img of table.querySelectorAll('img')) {
				const m = () => view.requestMeasure();
				img.addEventListener('load', m, { once: true });
				img.addEventListener('error', m, { once: true });
			}
			wrap.addEventListener('mousedown', (e) => onTableMouseDown(e, view, wrap, this.basePath));
			return wrap;
		}
	}

	/** Clique na tabela: link navega; o resto entra em edição com o caret no
	 *  fim da célula clicada. A posição sai da árvore na hora do clique —
	 *  o DOM pode ter sido reaproveitado (eq) depois de edições acima. */
	function onTableMouseDown(e: MouseEvent, v: EditorView, wrap: HTMLElement, basePath: string) {
		if (e.button !== 0) return;
		const el = e.target as Element;
		if (el === wrap && e.offsetY >= wrap.clientHeight) return; // scrollbar horizontal do wrapper
		const link = el.closest('.cm-md-link[data-href]');
		if (link && !(e.ctrlKey || e.metaKey)) {
			const href = link.getAttribute('data-href')!;
			if (href && !href.startsWith('#')) {
				e.preventDefault();
				followLink(basePath, href);
				return;
			}
		}
		e.preventDefault();
		const start = v.posAtDOM(wrap);
		// fim da primeira linha: o widget pode começar antes de Table.from (tabela em citação)
		let n: SyntaxNode | null = syntaxTree(v.state).resolveInner(v.state.doc.lineAt(start).to, -1);
		while (n && n.name !== 'Table') n = n.parent;
		if (!n) return;
		let pos = n.from;
		const cellEl = el.closest('th,td') as HTMLElement | null;
		if (cellEl) {
			const rows = [...n.getChildren('TableHeader'), ...n.getChildren('TableRow')];
			const row = rows[Number(cellEl.dataset.row)];
			if (row) {
				const s = rowSlots(row)[Number(cellEl.dataset.col)];
				pos = s ? (s.cell ? s.cell.to : Math.min(s.from + 1, s.to)) : row.to;
			}
		}
		v.focus();
		v.dispatch({ selection: { anchor: pos }, userEvent: 'select' });
	}

	function overlaps(state: EditorStateType, from: number, to: number): boolean {
		return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

	/** Renderiza o conteúdo inline (negrito, itálico, código, riscado, link,
	 *  imagem) para HTML simples — usado dentro de células de tabela, que o
	 *  CodeMirror não decora token a token como o resto do documento (a
	 *  tabela vira um widget substituindo o node inteiro). */
	function renderRange(parent: SyntaxNode, from: number, to: number, state: EditorStateType, basePath: string): string {
		let html = '';
		let pos = from;
		for (let n = parent.firstChild; n; n = n.nextSibling) {
			if (n.to <= from || n.from >= to) continue;
			if (n.from > pos) html += escapeHtml(state.doc.sliceString(pos, n.from));
			html += renderInlineNode(n, state, basePath);
			pos = n.to;
		}
		if (pos < to) html += escapeHtml(state.doc.sliceString(pos, to));
		return html;
	}

	function renderInlineHtml(c: SyntaxNode, state: EditorStateType, basePath: string): string {
		return renderRange(c, c.from, c.to, state, basePath);
	}

	function renderInlineNode(node: SyntaxNode, state: EditorStateType, basePath: string): string {
		const slice = (a: number, b: number) => state.doc.sliceString(a, b);
		const inner = (markName: string) => {
			const marks = node.getChildren(markName);
			return { from: marks[0]?.to ?? node.from, to: marks[1]?.from ?? node.to };
		};
		const wrapTag = (tag: string, mark: string) => {
			const { from, to } = inner(mark);
			return `<${tag}>${renderRange(node, from, to, state, basePath)}</${tag}>`;
		};
		switch (node.name) {
			case 'StrongEmphasis':
				return wrapTag('strong', 'EmphasisMark');
			case 'Emphasis':
				return wrapTag('em', 'EmphasisMark');
			case 'Strikethrough':
				return wrapTag('s', 'StrikethroughMark');
			case 'InlineCode': {
				const { from, to } = inner('CodeMark');
				// o lezer não gera Escape dentro de InlineCode
				return `<code>${escapeHtml(slice(from, to).replace(/\\\|/g, '|'))}</code>`;
			}
			case 'Link': {
				const { from, to } = inner('LinkMark');
				const url = node.getChild('URL');
				const href = url ? slice(url.from, url.to) : '';
				return `<span class="cm-md-link cm-md-link-live" data-href="${escapeAttr(href)}">${renderRange(node, from, to, state, basePath)}</span>`;
			}
			case 'Image': {
				const url = node.getChild('URL');
				if (!url) return escapeHtml(slice(node.from, node.to));
				const { from, to } = inner('LinkMark');
				return `<img class="cm-md-cell-image" src="${escapeAttr(resolveImageSrc(basePath, slice(url.from, url.to)))}" alt="${escapeAttr(slice(from, to))}">`;
			}
			case 'Escape':
				return escapeHtml(slice(node.from + 1, node.to));
			case 'Entity':
				return slice(node.from, node.to); // o regex do lezer só aceita entidades válidas
			default:
				return escapeHtml(slice(node.from, node.to));
		}
	}

	type CellSlot = { from: number; to: number; cell: SyntaxNode | null };

	/** Mesma contagem do parseRow do lezer: pipe inicial/final opcionais,
	 *  célula vazia (sem TableCell) mantém o slot. */
	function rowSlots(row: SyntaxNode): CellSlot[] {
		const slots: CellSlot[] = [];
		let start = row.from;
		let cell: SyntaxNode | null = null;
		let sawDelim = false;
		for (let c = row.firstChild; c; c = c.nextSibling) {
			if (c.name === 'TableCell') cell = c;
			else if (c.name === 'TableDelimiter') {
				if (sawDelim || cell) slots.push({ from: start, to: c.from, cell });
				start = c.to;
				cell = null;
				sawDelim = true;
			}
		}
		if (cell) slots.push({ from: start, to: row.to, cell });
		return slots;
	}

	function cellsOf(row: SyntaxNode, state: EditorStateType, cols: number, basePath: string): string[] {
		const out = rowSlots(row)
			.slice(0, cols)
			.map((s) => (s.cell ? renderInlineHtml(s.cell, state, basePath) : ''));
		while (out.length < cols) out.push('');
		return out;
	}

	function tableAligns(table: SyntaxNode, state: EditorStateType, cols: number): (string | null)[] {
		const d = table.getChild('TableDelimiter'); // linha |---|:-:| (filho direto de Table)
		const parts = d
			? state.doc.sliceString(d.from, d.to).trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
			: [];
		const out = parts.slice(0, cols).map((p) => {
			const s = p.trim();
			const l = s.startsWith(':');
			const r = s.endsWith(':');
			return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
		});
		while (out.length < cols) out.push(null);
		return out;
	}

	type Preview = { deco: DecorationSet; atoms: RangeSet<Decoration> };
	const refreshPreview = StateEffect.define<null>();
	const atomMark = Decoration.mark({});
	const POINTER_SETTLE_MS = 500; // >= tempo padrão de duplo clique do Windows
	let pointerSelecting = false;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let releasePointer: (() => void) | null = null;

	/** Durante um gesto de mouse o preview fica congelado: revelar os
	 *  marcadores no mousedown deslocaria o texto sob o ponteiro (o mouseup
	 *  ou o duplo clique cairiam em outro caractere). */
	function armPointerFreeze(v: EditorView) {
		pointerSelecting = true;
		clearTimeout(refreshTimer);
		releasePointer?.();
		const doc = v.dom.ownerDocument;
		const win = doc.defaultView!;
		const end = () => {
			releasePointer?.();
			refreshTimer = setTimeout(() => {
				pointerSelecting = false;
				if (view === v) v.dispatch({ effects: refreshPreview.of(null) });
			}, POINTER_SETTLE_MS);
		};
		const onMove = (e: MouseEvent) => {
			if (e.buttons === 0) end();
		};
		doc.addEventListener('mouseup', end, true);
		doc.addEventListener('mousemove', onMove, true);
		win.addEventListener('blur', end);
		releasePointer = () => {
			doc.removeEventListener('mouseup', end, true);
			doc.removeEventListener('mousemove', onMove, true);
			win.removeEventListener('blur', end);
			releasePointer = null;
		};
	}

	/**
	 * O coração da edição "estilo Typora": para cada elemento de sintaxe,
	 * quando o cursor não está nele, os marcadores (**, #, `, [](...) )
	 * somem e só sobra o texto já estilizado; quando o cursor entra, os
	 * marcadores reaparecem (discretos) para poder editar em texto puro.
	 */
	function buildLivePreview(state: EditorStateType, basePath: string): Preview {
		const ranges: { from: number; to: number; deco: Decoration }[] = [];
		const atoms: Range<Decoration>[] = [];
		const push = (from: number, to: number, deco: Decoration) => ranges.push({ from, to, deco });
		const hide = (from: number, to: number, block = false) => {
			if (to > from) push(from, to, Decoration.replace(block ? { block: true } : {}));
		};
		const markDiscreet = (from: number, to: number) => {
			if (to > from) push(from, to, Decoration.mark({ class: 'cm-md-mark' }));
		};

		syntaxTree(state).iterate({
			enter(node) {
				switch (node.name) {
					case 'ATXHeading1':
					case 'ATXHeading2':
					case 'ATXHeading3':
					case 'ATXHeading4':
					case 'ATXHeading5':
					case 'ATXHeading6': {
						const level = node.name.slice(-1);
						const line = state.doc.lineAt(node.from);
						push(line.from, line.from, Decoration.line({ class: `cm-heading cm-heading-${level}` }));
						// Revela o "# " só com o cursor no próprio prefixo: revelar com o
						// cursor em qualquer ponto da linha deslocaria o texto no clique.
						const mark = node.node.getChild('HeaderMark');
						if (mark) {
							let end = mark.to;
							if (state.doc.sliceString(end, end + 1) === ' ') end += 1;
							if (overlaps(state, line.from, end)) markDiscreet(mark.from, end);
							else hide(mark.from, end);
						}
						break;
					}
					case 'StrongEmphasis':
					case 'Emphasis':
					case 'Strikethrough': {
						const focused = overlaps(state, node.from, node.to);
						const cls =
							node.name === 'StrongEmphasis'
								? 'cm-md-strong'
								: node.name === 'Emphasis'
									? 'cm-md-em'
									: 'cm-md-strike';
						push(node.from, node.to, Decoration.mark({ class: cls }));
						const markName = node.name === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark';
						for (const m of node.node.getChildren(markName)) {
							if (focused) markDiscreet(m.from, m.to);
							else hide(m.from, m.to);
						}
						break;
					}
					case 'InlineCode': {
						const focused = overlaps(state, node.from, node.to);
						push(node.from, node.to, Decoration.mark({ class: 'cm-md-code' }));
						for (const m of node.node.getChildren('CodeMark')) {
							if (focused) markDiscreet(m.from, m.to);
							else hide(m.from, m.to);
						}
						break;
					}
					case 'Link': {
						const focused = overlaps(state, node.from, node.to);
						const marks = node.node.getChildren('LinkMark');
						push(node.from, node.to, Decoration.mark({ class: focused ? 'cm-md-link' : 'cm-md-link cm-md-link-live' }));
						if (marks.length >= 2) {
							if (focused) {
								markDiscreet(marks[0].from, marks[0].to);
								markDiscreet(marks[1].from, node.to);
							} else {
								hide(marks[0].from, marks[0].to);
								hide(marks[1].from, node.to);
							}
						}
						break;
					}
					case 'Image': {
						const focused = overlaps(state, node.from, node.to);
						if (!focused) {
							const urlNode = node.node.getChild('URL');
							const url = urlNode ? state.doc.sliceString(urlNode.from, urlNode.to) : '';
							const marks = node.node.getChildren('LinkMark');
							const alt = marks.length >= 2 ? state.doc.sliceString(marks[0].to, marks[1].from) : '';
							push(
								node.from,
								node.to,
								Decoration.replace({ widget: new ImageWidget(resolveImageSrc(basePath, url), alt) })
							);
						}
						break;
					}
					case 'ListItem': {
						const isOrdered = node.node.parent?.name === 'OrderedList';
						const mark = node.node.getChild('ListMark');
						if (mark) {
							if (isOrdered) push(mark.from, mark.to, Decoration.mark({ class: 'cm-md-list-mark' }));
							else {
								push(mark.from, mark.to, Decoration.replace({ widget: new BulletWidget() }));
								// bullet + espaço como átomo: o caret não para entre os dois
								const end = state.doc.sliceString(mark.to, mark.to + 1) === ' ' ? mark.to + 1 : mark.to;
								if (end > mark.from + 1) atoms.push(atomMark.range(mark.from, end));
							}
						}
						break;
					}
					case 'TaskMarker': {
						const checked = state.doc.sliceString(node.from, node.to).includes('x');
						push(
							node.from,
							node.to,
							Decoration.mark({ class: checked ? 'cm-md-task cm-md-task-done' : 'cm-md-task' })
						);
						break;
					}
					case 'Blockquote': {
						// O "> " de cada linha fica sempre visível de propósito (sem
						// Decoration.replace escondendo nada, sem padding na linha): as
						// duas coisas mexem na métrica que o CodeMirror usa pra mapear
						// clique/Home/End em linha com quebra visual, e a imprecisão daí
						// é pior que a sintaxe aparecendo. Só a cor do texto marca a
						// citação.
						const first = state.doc.lineAt(node.from).number;
						const last = state.doc.lineAt(node.to).number;
						for (let n = first; n <= last; n++) {
							const l = state.doc.line(n);
							push(l.from, l.from, Decoration.line({ class: 'cm-md-quote-line' }));
						}
						break;
					}
					case 'HorizontalRule': {
						if (!overlaps(state, node.from, node.to)) {
							push(node.from, node.to, Decoration.replace({ widget: new HrWidget(), block: true }));
						}
						break;
					}
					case 'FencedCode': {
						const firstLine = state.doc.lineAt(node.from);
						const lastLine = state.doc.lineAt(node.to);
						// A cerca (```) fica sempre visível e as linhas não têm padding
						// — as duas coisas mexem na métrica que o CodeMirror usa pra
						// mapear clique/Home/End em linha com quebra visual. Só o fundo
						// marca a caixa.
						for (let n = firstLine.number; n <= lastLine.number; n++) {
							push(state.doc.line(n).from, state.doc.line(n).from, Decoration.line({ class: 'cm-md-code-line' }));
						}
						push(firstLine.from, firstLine.from, Decoration.line({ class: 'cm-md-code-first' }));
						push(lastLine.from, lastLine.from, Decoration.line({ class: 'cm-md-code-last' }));
						break;
					}
					case 'Table': {
						const fromLine = state.doc.lineAt(node.from);
						const toLine = state.doc.lineAt(node.to);
						const prefix = state.doc.sliceString(fromLine.from, node.from);
						// Tabela em citação: o widget cobre as linhas inteiras (inclusive o
						// "> "). Com marcador de lista no prefixo, mantém node.from pra
						// não esconder o bullet.
						const fullLine = /^[\s>]*$/.test(prefix);
						const from = fullLine ? fromLine.from : node.from;
						const to = fullLine ? toLine.to : node.to;
						if (!overlaps(state, from, to)) {
							const header = node.node.getChild('TableHeader');
							const cols = header ? rowSlots(header).length : 0;
							if (cols > 0) {
								const rows: string[][] = [];
								let headerRowCount = 0;
								for (const h of node.node.getChildren('TableHeader')) {
									rows.push(cellsOf(h, state, cols, basePath));
									headerRowCount++;
								}
								for (const r of node.node.getChildren('TableRow')) {
									rows.push(cellsOf(r, state, cols, basePath));
								}
								push(
									from,
									to,
									Decoration.replace({
										widget: new TableWidget(
											rows,
											headerRowCount,
											tableAligns(node.node, state, cols),
											prefix.includes('>'),
											basePath
										),
										block: true
									})
								);
							}
						}
						break;
					}
				}
			}
		});

		return {
			deco: Decoration.set(
				ranges.map((r) => r.deco.range(r.from, r.to)),
				true
			),
			atoms: RangeSet.of(atoms, true)
		};
	}

	/**
	 * Precisa ser um StateField, não um ViewPlugin: decorações de bloco
	 * (as da tabela e do bloco de código cercado) só são aceitas quando
	 * vêm de um StateField — um ViewPlugin lança "Block decorations may
	 * not be specified via plugins".
	 */
	function livePreviewField(basePath: string) {
		return StateField.define<Preview>({
			create(state) {
				return buildLivePreview(state, basePath);
			},
			update(value, tr) {
				// O parser de markdown roda em segundo plano para documentos
				// maiores: a árvore sintática pode continuar incompleta bem
				// depois do `create()`, e vai terminando em transações que não
				// mudam o texto nem a seleção. Sem essa comparação, blocos mais
				// abaixo no arquivo (tabelas, links, "---"...) só ganhavam
				// formatação quando algo mais disparava um recálculo (como
				// clicar e mover o cursor).
				const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
				const forced = tr.effects.some((e) => e.is(refreshPreview));
				const frozen =
					pointerSelecting && !tr.docChanged && !treeChanged && !forced && tr.isUserEvent('select.pointer');
				if (!frozen && (tr.docChanged || tr.selection || treeChanged || forced)) {
					return buildLivePreview(tr.state, basePath);
				}
				return { deco: value.deco.map(tr.changes), atoms: value.atoms.map(tr.changes) };
			},
			provide: (field) => [
				EditorView.decorations.from(field, (v) => v.deco),
				EditorView.atomicRanges.of((v) => v.state.field(field).atoms)
			]
		});
	}

	function linkNodeAt(editorView: EditorView, pos: number): SyntaxNode | null {
		let node: SyntaxNode | null = syntaxTree(editorView.state).resolveInner(pos, 1);
		while (node) {
			if (node.name === 'Link' || node.name === 'Image' || node.name === 'URL') return node;
			node = node.parent;
		}
		return null;
	}

	/** Clique simples num link navega — como um link de verdade.
	 *  Ctrl/Cmd+clique, ou link já em edição, só posiciona o cursor. */
	function linkClickHandler(basePath: string) {
		return (e: MouseEvent, editorView: EditorView) => {
			if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.detail > 1) return false;
			const target = e.target instanceof Element ? e.target.closest('.cm-md-link') : null;
			if (!target) return false;
			const node = linkNodeAt(editorView, editorView.posAtDOM(target, 0));
			if (!node) return false;
			let outer: SyntaxNode | null = node;
			while (outer && outer.name !== 'Link' && outer.name !== 'Image') outer = outer.parent;
			const range = outer ?? node;
			if (overlaps(editorView.state, range.from, range.to)) return false; // link em edição: o CM posiciona o caret
			const urlNode = node.name === 'URL' ? node : node.getChild('URL');
			if (!urlNode) return false;
			const href = editorView.state.doc.sliceString(urlNode.from, urlNode.to);
			if (href.startsWith('#')) return false;
			e.preventDefault();
			followLink(basePath, href);
			return true;
		};
	}

	/** Enquanto Ctrl/Cmd está pressionado, o cursor vira "texto" sobre um
	 *  link/imagem (sinal de "clique aqui para editar" em vez de navegar). */
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Control' || e.key === 'Meta') editorHost?.classList.add('modifier-down');
	}
	function onWindowKeyup(e: KeyboardEvent) {
		if (e.key === 'Control' || e.key === 'Meta') editorHost?.classList.remove('modifier-down');
	}
	function onWindowBlur() {
		editorHost?.classList.remove('modifier-down');
	}

	/** PageUp/PageDown rolando o `.body` (o scroller real; o padrão do CodeMirror
	 *  mede o .cm-scroller, que aqui tem a altura do documento) exatamente uma
	 *  página e pondo o caret no que ficou na mesma altura da tela. Rolar
	 *  primeiro evita que uma tabela/hr no caminho faça a página pular conteúdo. */
	function pageMove(forward: boolean, extend: boolean) {
		return (v: EditorView) => {
			const body = bodyEl;
			if (!body) return false;
			const { state } = v;
			const main = state.selection.main;
			if (!extend && !main.empty) {
				const sel = EditorSelection.create(
					state.selection.ranges.map((r) => EditorSelection.cursor(forward ? r.to : r.from)),
					state.selection.mainIndex
				);
				v.dispatch({ selection: sel, userEvent: 'select', scrollIntoView: true });
				return true;
			}
			const br = body.getBoundingClientRect();
			const top = br.top, bottom = br.top + body.clientHeight;
			const lh = v.defaultLineHeight; // já em px de tela (medido via getBoundingClientRect)
			const dist = Math.max(lh, body.clientHeight - 2 * lh);
			const start = v.coordsAtPos(main.head);
			const content = v.contentDOM.getBoundingClientRect();
			const goal = main.goalColumn ?? (start ? start.left - content.left : 0);
			const mid = start ? (start.top + start.bottom) / 2 : v.documentTop + v.lineBlockAt(main.head).top + lh / 2;
			const y = Math.min(Math.max(mid, top + lh / 2), bottom - lh / 2);
			const before = body.scrollTop;
			body.scrollTop = before + (forward ? dist : -dist);
			const moved = body.scrollTop - before;
			let head: number;
			let wantVisible = true;
			if (moved === 0) head = forward ? state.doc.length : 0;
			else {
				const docTop = v.documentTop;
				const blk = v.elementAtHeight(Math.max(0, y - docTop));
				if (blk.type === BlockType.Text) head = v.posAtCoords({ x: content.left + goal, y }, false);
				else {
					// widget de bloco na altura do caret: vai pro lado visível dele (fora do widget)
					const after = Math.min(blk.to + 1, state.doc.length);
					const prev = Math.max(blk.from - 1, 0);
					const afterVisible = docTop + blk.bottom + lh <= bottom;
					const prevVisible = docTop + blk.top - lh >= top;
					head = forward ? (afterVisible || !prevVisible ? after : prev) : prevVisible || !afterVisible ? prev : after;
					wantVisible = head === after ? afterVisible : prevVisible;
				}
			}
			const sel = EditorSelection.create(
				state.selection.ranges.map((r, i) => {
					let h = head, g: number | undefined = goal;
					if (i !== state.selection.mainIndex) {
						const m = v.moveVertically(r, forward, Math.abs(moved) || dist);
						h = m.head;
						g = m.goalColumn;
					}
					return extend ? EditorSelection.range(r.anchor, h, g) : EditorSelection.cursor(h, 0, undefined, g);
				}),
				state.selection.mainIndex
			);
			// caret visível: fica onde está na tela mesmo se o layout mudar (tabela
			// que fecha). Linha ainda não renderizada dá posição aproximada: só
			// garante o caret na tela, com a menor rolagem extra.
			const end = v.coordsAtPos(head);
			const keep = !!end && end.top >= top && end.bottom <= bottom;
			v.dispatch({
				selection: sel,
				userEvent: 'select',
				effects: keep
					? EditorView.scrollIntoView(head, { y: 'start', yMargin: end!.top - top })
					: wantVisible
						? EditorView.scrollIntoView(head)
						: undefined
			});
			return true;
		};
	}

	const MD_PREFIX_NODES = new Set(['QuoteMark', 'ListMark', 'TaskMarker', 'HeaderMark']);

	/** Início do conteúdo da linha, depois de "> ", "- ", "1. ", "[ ] ", "# ". */
	function mdContentStart(state: EditorStateType, line: Line): number {
		let end = line.from;
		syntaxTree(state).iterate({
			from: line.from,
			to: line.to,
			enter(n) {
				if (!MD_PREFIX_NODES.has(n.name) || n.from < line.from || n.to > line.to) return;
				if (/^\s*$/.test(state.sliceDoc(end, n.from))) end = n.to;
			}
		});
		if (end === line.from) return line.from;
		return end + /^\s*/.exec(state.sliceDoc(end, line.to))![0].length;
	}

	/** Home: primeiro vai pro início do conteúdo (depois do marcador), o
	 *  segundo vai pro começo da linha. */
	function smartHome(extend: boolean) {
		return (v: EditorView) => {
			const { state } = v;
			const sel = EditorSelection.create(
				state.selection.ranges.map((r) => {
					const line = state.doc.lineAt(r.head);
					const start = EditorSelection.cursor(r.head, r.assoc);
					let target = v.moveToLineBoundary(start, false).head;
					if (target === r.head && r.head !== line.from) target = v.moveToLineBoundary(start, false, false).head;
					if (target === line.from) {
						const content = mdContentStart(state, line);
						if (content > line.from && r.head !== content) target = content;
					}
					return extend ? EditorSelection.range(r.anchor, target) : EditorSelection.cursor(target, 1);
				}),
				state.selection.mainIndex
			);
			if (sel.eq(state.selection)) return false;
			v.dispatch({ selection: sel, scrollIntoView: true, userEvent: 'select' });
			return true;
		};
	}

	const INLINE_MD = new Set(['Emphasis', 'StrongEmphasis', 'Strikethrough', 'InlineCode']);
	const INLINE_MARK = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);
	type MdMark = { from: number; to: number; pFrom: number; pTo: number };

	function inlineMarks(state: EditorStateType, line: Line): MdMark[] {
		const out: MdMark[] = [];
		syntaxTree(state).iterate({
			from: line.from,
			to: line.to,
			enter(n) {
				const p = n.node.parent;
				if (INLINE_MARK.has(n.name) && p && INLINE_MD.has(p.name)) {
					out.push({ from: n.from, to: n.to, pFrom: p.from, pTo: p.to });
				}
			}
		});
		return out;
	}

	/** Alvo de Ctrl+Backspace/Delete no estilo Windows, pulando marcadores. */
	function wordTarget(state: EditorStateType, head: number, forward: boolean, marks: MdMark[], line: Line): number {
		const cat = state.charCategorizer(head);
		const limit = forward ? line.to : line.from;
		const markAt = (p: number) => marks.find((m) => (forward ? m.from <= p && p < m.to : m.from < p && p <= m.to));
		const ch = (p: number) => (forward ? state.sliceDoc(p, p + 1) : state.sliceDoc(p - 1, p));
		const step = (p: number) => (forward ? p + 1 : p - 1);
		let pos = head;
		if (!forward) {
			while (pos !== limit) {
				const m = markAt(pos);
				if (m) {
					pos = m.from;
					continue;
				}
				if (cat(ch(pos)) === CharCategory.Space) pos = step(pos);
				else break;
			}
			const c0 = pos !== limit ? cat(ch(pos)) : null;
			while (pos !== limit && !markAt(pos) && cat(ch(pos)) === c0) pos = step(pos);
		} else {
			while (pos !== limit) {
				const m = markAt(pos);
				if (m) {
					pos = m.to;
					continue;
				}
				break;
			}
			const c0 = pos !== limit ? cat(ch(pos)) : null;
			if (c0 !== CharCategory.Space) while (pos !== limit && !markAt(pos) && cat(ch(pos)) === c0) pos = step(pos);
			while (pos !== limit && !markAt(pos) && cat(ch(pos)) === CharCategory.Space) pos = step(pos);
		}
		return pos;
	}

	/** Ctrl+Backspace/Ctrl+Delete sem desbalancear ** / * / ~~ / ` . */
	function mdDeleteWord(forward: boolean) {
		return (v: EditorView) => {
			const { state } = v;
			if (state.readOnly || state.selection.ranges.length > 1 || !state.selection.main.empty) return false;
			const head = state.selection.main.head;
			const line = state.doc.lineAt(head);
			if (head === (forward ? line.to : line.from)) return false; // junção de linhas: comando padrão
			const marks = inlineMarks(state, line);
			const target = wordTarget(state, head, forward, marks, line);
			let from = Math.min(head, target);
			let to = Math.max(head, target);
			if (from === to) return false;
			// nó cujo conteúdo inteiro cai no intervalo: apaga o nó todo, marcadores incluídos
			const byNode = new Map<string, MdMark[]>();
			for (const m of marks) {
				const k = `${m.pFrom}:${m.pTo}`;
				byNode.set(k, [...(byNode.get(k) ?? []), m]);
			}
			const emptied = new Set<string>();
			// Repete até estabilizar: esvaziar um nó interno (***x***) amplia o
			// intervalo e pode esvaziar o externo também.
			for (let grew = true; grew; ) {
				grew = false;
				for (const [k, ms] of byNode) {
					if (ms.length < 2 || emptied.has(k)) continue;
					const cFrom = ms[0].to;
					const cTo = ms[ms.length - 1].from;
					if (from <= cFrom && to >= cTo && (from < cTo || to > cFrom)) {
						emptied.add(k);
						from = Math.min(from, ms[0].pFrom);
						to = Math.max(to, ms[0].pTo);
						grew = true;
					}
				}
			}
			// marcadores de nós que continuam existindo nunca são apagados
			const keep = marks.filter((m) => !emptied.has(`${m.pFrom}:${m.pTo}`) && m.from < to && m.to > from);
			// Ctrl+Backspace antes de um fechamento: tira o espaço que ficaria colado nele (**a b|** -> **a**)
			if (!forward) {
				const closing = marks.some(
					(m) =>
						m.from > m.pFrom &&
						!emptied.has(`${m.pFrom}:${m.pTo}`) &&
						(m.from === to || (m.to === to && m.from >= from))
				);
				if (closing) while (from > line.from && /\s/.test(state.sliceDoc(from - 1, from))) from--;
			}
			const changes: { from: number; to: number }[] = [];
			let cur = from;
			for (const m of keep.sort((a, b) => a.from - b.from)) {
				if (m.from > cur) changes.push({ from: cur, to: m.from });
				cur = Math.max(cur, m.to);
			}
			if (cur < to) changes.push({ from: cur, to });
			if (!changes.length) return false;
			const cs = state.changes(changes);
			v.dispatch({
				changes: cs,
				selection: { anchor: cs.mapPos(head, -1) },
				scrollIntoView: true,
				userEvent: forward ? 'delete.forward' : 'delete.backward'
			});
			return true;
		};
	}

	function markerRun(text: string, ch: string) {
		let n = 0;
		while (n < text.length && text[n] === ch) n++;
		return n;
	}

	/** Ctrl+B / Ctrl+I: liga/desliga ** ou * em volta da seleção. */
	function toggleWrap(m: string) {
		const ch = m[0];
		return (v: EditorView) => {
			v.dispatch(
				v.state.changeByRange((r) => {
					const before = v.state.sliceDoc(Math.max(0, r.from - 3), r.from).split('').reverse().join('');
					const nb = markerRun(before, ch);
					const na = markerRun(v.state.sliceDoc(r.to, r.to + 3), ch);
					const wrapped = m.length === 1 ? (nb === 1 || nb === 3) && (na === 1 || na === 3) : nb >= 2 && na >= 2;
					if (wrapped) {
						return {
							changes: [
								{ from: r.from - m.length, to: r.from },
								{ from: r.to, to: r.to + m.length }
							],
							range: EditorSelection.range(r.from - m.length, r.to - m.length)
						};
					}
					return {
						changes: [
							{ from: r.from, insert: m },
							{ from: r.to, insert: m }
						],
						range: EditorSelection.range(r.from + m.length, r.to + m.length)
					};
				}),
				{ userEvent: 'input', scrollIntoView: true }
			);
			return true;
		};
	}

	/** Ctrl+K: [seleção]() com o caret dentro dos parênteses. */
	function insertLink(v: EditorView) {
		v.dispatch(
			v.state.changeByRange((r) => ({
				changes: [
					{ from: r.from, insert: '[' },
					{ from: r.to, insert: ']()' }
				],
				range: EditorSelection.cursor(r.empty ? r.from + 1 : r.to + 3)
			})),
			{ userEvent: 'input' }
		);
		return true;
	}

	/** Enter numa linha da tabela cria uma linha vazia abaixo (sem partir a
	 *  linha); Enter numa linha vazia sai da tabela. */
	function tableEnter(v: EditorView): boolean {
		const { state } = v;
		if (state.selection.ranges.length !== 1 || !state.selection.main.empty) return false;
		const head = state.selection.main.head;
		const line = state.doc.lineAt(head);
		let n: SyntaxNode | null = syntaxTree(state).resolveInner(line.to, -1);
		while (n && n.name !== 'TableRow' && n.name !== 'TableHeader' && n.name !== 'Table') n = n.parent;
		if (!n || n.name !== 'TableRow' || !n.parent) return false; // cabeçalho/delimitador: Enter normal
		if (head < n.from) return false; // caret no prefixo ("> ", recuo)
		const header = n.parent.getChild('TableHeader');
		if (!header) return false;
		const cols = rowSlots(header).length;
		const prefix = line.text.slice(0, Math.max(0, n.from - line.from));
		if (/^\s*\|?(\s*\|)*\s*$/.test(line.text.slice(prefix.length))) {
			const insert = prefix.trimEnd() + '\n' + prefix; // linha em branco encerra a tabela; caret na linha seguinte
			v.dispatch({
				changes: { from: line.from, to: line.to, insert },
				selection: { anchor: line.from + insert.length },
				userEvent: 'input',
				scrollIntoView: true
			});
			return true;
		}
		const row = '\n' + prefix + '|' + '  |'.repeat(cols);
		v.dispatch({
			changes: { from: line.to, insert: row },
			selection: { anchor: line.to + 1 + prefix.length + 2 },
			userEvent: 'input',
			scrollIntoView: true
		});
		return true;
	}

	// Num Compartment para poder trocar fonte/tamanho/espaçamento em tempo
	// real (configurações) sem recriar o editor — preserva cursor, seleção
	// e histórico de undo/redo.
	const fontCompartment = new Compartment();
	// Idem pra quebra de linha (Configurações → Editor) — desligar evita um
	// problema conhecido do CodeMirror de clique/Home/End errando a linha
	// em parágrafos que quebram, em documentos grandes.
	const wrapCompartment = new Compartment();
	// A paleta do highlight de sintaxe é fixa (claro/escuro), não uma das 9
	// cores do tema — precisa reconfigurar quando o tema muda de claro pra
	// escuro (ou vice-versa), incluindo o modo "Sistema".
	const highlightCompartment = new Compartment();

	function buildEditorTheme() {
		return EditorView.theme({
			'&': { color: 'var(--text)', backgroundColor: 'transparent', fontSize: `${effectiveFontSize()}px` },
			'.cm-content': {
				padding: '32px 40px 80px',
				fontFamily: effectiveFontFamily(),
				caretColor: 'var(--text)'
			},
			'.cm-line': { padding: '0' },
			'.cm-scroller': { fontFamily: 'inherit', lineHeight: String(effectiveLineHeight()) },
			'&.cm-focused': { outline: 'none' }
		});
	}

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			if (!view) return;
			const hadFocus = view.hasFocus;
			saving = true;
			try {
				await onSave(view.state.doc.toString());
			} finally {
				saving = false;
				if (hadFocus && view && !view.hasFocus) view.focus();
			}
		}, 500);
	}

	function computeStats(state: EditorStateType): DocStats {
		const doc = state.doc;
		let selectedChars = 0;
		for (const range of state.selection.ranges) selectedChars += range.to - range.from;
		return {
			lines: doc.lines,
			currentLine: doc.lineAt(state.selection.main.head).number,
			chars: doc.length,
			selectedChars
		};
	}

	let statsRaf = 0;
	function scheduleStats() {
		cancelAnimationFrame(statsRaf);
		statsRaf = requestAnimationFrame(() => {
			if (view) onStats?.(computeStats(view.state));
		});
	}

	function destroyEditor() {
		clearTimeout(saveTimer);
		cancelAnimationFrame(statsRaf);
		clearTimeout(refreshTimer);
		releasePointer?.();
		pointerSelecting = false;
		view?.destroy();
		view = null;
	}

	function createEditor(doc: string, basePath: string) {
		destroyEditor();
		if (!editorHost) return;
		view = new EditorView({
			parent: editorHost,
			state: EditorState.create({
				doc,
				extensions: [
					history(),
					// Keymap único e ordenado: com addKeymap: false o markdown não
					// registra o próprio (em Prec.high), então o Enter da tabela vence.
					keymap.of([
						{ key: 'Enter', run: tableEnter },
						{ key: 'Mod-b', run: toggleWrap('**'), preventDefault: true },
						{ key: 'Mod-i', run: toggleWrap('*'), preventDefault: true },
						{ key: 'Mod-k', run: insertLink, preventDefault: true },
						{ key: 'Home', run: smartHome(false), shift: smartHome(true), preventDefault: true },
						{ key: 'PageDown', run: pageMove(true, false), shift: pageMove(true, true), preventDefault: true },
						{ key: 'PageUp', run: pageMove(false, false), shift: pageMove(false, true), preventDefault: true },
						{ win: 'Mod-ArrowRight', run: cursorGroupForwardWin, shift: selectGroupForwardWin, preventDefault: true },
						{ win: 'Mod-Backspace', linux: 'Mod-Backspace', run: mdDeleteWord(false) },
						{ win: 'Mod-Delete', linux: 'Mod-Delete', run: mdDeleteWord(true) },
						{ win: 'Ctrl-Shift-z', run: redo, preventDefault: true },
						...markdownKeymap,
						indentWithTab,
						...defaultKeymap,
						...historyKeymap
					]),
					markdown({ extensions: GFM, codeLanguages, addKeymap: false }),
					livePreviewField(basePath),
					wrapCompartment.of(settings.lineWrapping ? EditorView.lineWrapping : []),
					fontCompartment.of(buildEditorTheme()),
					highlightCompartment.of(syntaxHighlighting(highlightStyleFor(isDarkThemeActive(settings.themeId)))),
					EditorView.updateListener.of((u) => {
						if (u.docChanged) scheduleSave();
						if (u.docChanged || u.selectionSet) scheduleStats();
					}),
					EditorView.domEventObservers({
						mousedown(e, v) {
							if (e.button === 0) armPointerFreeze(v);
						}
					}),
					EditorView.domEventHandlers({ mousedown: linkClickHandler(basePath) })
				]
			})
		});
		onStats?.(computeStats(view.state));
	}

	$effect(() => {
		// Roda uma única vez, na criação da instância: cada aba tem sua
		// própria instância pra vida inteira (o Svelte usa um id estável
		// como chave — ver +page.svelte). A criação inteira fica fora da
		// reatividade: ela lê path/content e também settings (fonte, tema,
		// quebra de linha) — se isso virasse dependência, mudar uma
		// configuração recriaria o editor do zero, perdendo cursor/undo, em
		// vez de passar pelos compartments.
		editorHost;
		untrack(() => createEditor(content, path));
	});

	$effect(() => {
		return () => destroyEditor();
	});

	// Fonte/tamanho/espaçamento das configurações mudam em tempo real, sem
	// recriar o editor (preserva cursor, seleção e histórico de undo). O
	// tema ativo também entra nas dependências: ele pode definir sua própria
	// fonte/tamanho (ver effectiveFontFamily/effectiveFontSize/etc.).
	$effect(() => {
		settings.themeId;
		settings.fontFamily;
		settings.customFontFamily;
		settings.fontSize;
		settings.lineHeight;
		view?.dispatch({ effects: fontCompartment.reconfigure(buildEditorTheme()) });
	});

	// O zoom é CSS no .doc-host: o CodeMirror não percebe sozinho a mudança.
	$effect(() => {
		zoom;
		view?.requestMeasure();
	});

	$effect(() => {
		const wrap = settings.lineWrapping;
		if (!view) return;
		view.dispatch({ effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []) });
	});

	function reconfigureHighlight() {
		view?.dispatch({
			effects: highlightCompartment.reconfigure(
				syntaxHighlighting(highlightStyleFor(isDarkThemeActive(settings.themeId)))
			)
		});
	}

	$effect(() => {
		settings.themeId;
		reconfigureHighlight();
	});

	// No modo "Sistema" o claro/escuro depende do SO, não de `settings` —
	// escuta a mudança diretamente pra recolorir o highlight sem precisar
	// trocar de aba/reabrir o arquivo.
	$effect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => {
			if (settings.themeId === 'system') reconfigureHighlight();
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	// A instância continua montada quando a aba não está ativa (ver `active`
	// acima) — ao voltar pra ela, reemite as estatísticas, já que nenhuma
	// mudança de documento/seleção acontece só por ficar visível de novo.
	$effect(() => {
		if (active && view) onStats?.(computeStats(view.state));
	});

	/** Clique na lateral/abaixo do texto: posiciona o caret na linha mais
	 *  próxima. No mousedown (não no click): um arrasto que termina aqui
	 *  não pode desfazer a seleção. */
	function onBodyMouseDown(e: MouseEvent) {
		if (!view || !bodyEl || e.button !== 0 || e.defaultPrevented) return;
		// alvo desanexado: o widget (ex.: tabela) já tratou o clique e saiu do DOM
		const target = e.target as HTMLElement | null;
		if (!target?.isConnected || target.closest('.cm-editor')) return;
		const br = bodyEl.getBoundingClientRect();
		if (e.clientX >= br.left + bodyEl.clientLeft + bodyEl.clientWidth) return; // scrollbar do .body
		e.preventDefault();
		const r = view.contentDOM.getBoundingClientRect();
		const x = Math.min(Math.max(e.clientX, r.left + 1), r.right - 1);
		const y = Math.min(Math.max(e.clientY, r.top + 1), r.bottom - 1);
		const pos = view.posAtCoords({ x, y }) ?? view.state.doc.length;
		armPointerFreeze(view);
		view.focus();
		view.dispatch({
			selection: e.shiftKey ? view.state.selection.main.extend(pos) : { anchor: pos },
			userEvent: 'select.pointer'
		});
	}
</script>

<svelte:window onkeydown={onWindowKeydown} onkeyup={onWindowKeyup} onblur={onWindowBlur} />

<div class="view">
	<span class="status" hidden={!saving}>{t('editor.saving')}</span>
	<div class="body" bind:this={bodyEl} onmousedown={onBodyMouseDown} onkeydown={() => {}} role="presentation">
		<div
			class="doc-host"
			style="zoom: {zoom}%; max-width: {effectiveContentWidth()};"
			bind:this={editorHost}
		></div>
	</div>
</div>

<style>
	.view {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
	}

	.status {
		position: absolute;
		top: 10px;
		right: 16px;
		color: var(--text-muted);
		font-size: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px 10px;
		z-index: 1;
	}

	.body {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		/* a ancoragem de scroll é do CodeMirror; a nativa do Chromium brigaria com ela */
		overflow-anchor: none;
	}

	.doc-host {
		/* max-width vem das configurações (largura do conteúdo), via style inline. */
		margin: 0 auto;
	}

	/* Altura automática (sem scroll próprio): um único scroll, o do `.body`
	   acima, em vez de dois scrolls aninhados brigando pelo mesmo espaço. */
	.doc-host :global(.cm-editor) {
		height: auto;
	}

	.doc-host :global(.cm-scroller) {
		overflow: visible;
	}

	:global(.cm-heading) {
		font-weight: 700;
		line-height: 1.3;
	}

	:global(.cm-heading-1) {
		font-size: 2em;
	}
	:global(.cm-heading-2) {
		font-size: 1.5em;
	}
	:global(.cm-heading-3) {
		font-size: 1.17em;
	}
	:global(.cm-heading-4) {
		font-size: 1em;
	}
	:global(.cm-heading-5) {
		font-size: 0.83em;
	}
	:global(.cm-heading-6) {
		font-size: 0.67em;
	}

	:global(.cm-md-mark) {
		color: var(--text-muted);
	}

	:global(.cm-md-strong) {
		font-weight: 700;
	}

	:global(.cm-md-em) {
		font-style: italic;
	}

	:global(.cm-md-strike) {
		text-decoration: line-through;
	}

	:global(.cm-md-code) {
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.9em;
		background: var(--surface);
		border-radius: 4px;
		padding: 0.1em 0.3em;
	}

	:global(.cm-md-link) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* Só o link fora de edição navega no clique. */
	:global(.cm-md-link-live) {
		cursor: pointer;
	}

	/* Com Ctrl/Cmd pressionado o link vira "editável" em vez de "clicável". */
	:global(.modifier-down .cm-md-link-live) {
		cursor: text;
	}

	:global(.cm-md-list-mark) {
		color: var(--accent);
	}

	:global(.cm-md-bullet) {
		color: var(--accent);
		font-weight: 700;
	}

	:global(.cm-md-task) {
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
	}

	:global(.cm-md-task-done) {
		color: var(--text-muted);
		text-decoration: line-through;
	}

	/* Citação e bloco de código: SEM padding/border reais na linha — as duas
	 * coisas mexem na caixa que o CodeMirror usa pra medir a linha e mapear
	 * clique/Home/End em linha com quebra visual (bug real que já causou
	 * problema de digitação/seleção nesses blocos). Toda a moldura visual
	 * (barra lateral, bordas, cantos) vem de um `::before` posicionado —
	 * puramente visual, `pointer-events: none`, fora da conta do editor. */
	:global(.cm-md-quote-line) {
		position: relative;
		color: var(--text-muted);
	}

	:global(.cm-md-quote-line::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--border);
		pointer-events: none;
	}

	/* Sem font-size diferente aqui de propósito: uma linha com tamanho de
	 * fonte diferente das vizinhas é gatilho conhecido de erro de medição
	 * do CodeMirror em linha com quebra visual (clique/Home/End erram a
	 * linha) — a família monoespaçada sozinha, no mesmo tamanho, não tem
	 * esse problema. */
	:global(.cm-md-code-line) {
		position: relative;
		background: var(--surface);
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
	}

	:global(.cm-md-code-line::before) {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 1px solid var(--border);
		border-right: 1px solid var(--border);
		pointer-events: none;
	}

	:global(.cm-md-code-first::before) {
		border-top: 1px solid var(--border);
		border-top-left-radius: 6px;
		border-top-right-radius: 6px;
	}

	:global(.cm-md-code-last::before) {
		border-bottom: 1px solid var(--border);
		border-bottom-left-radius: 6px;
		border-bottom-right-radius: 6px;
	}

	/* Widgets de bloco: espaçamento só com padding. O CodeMirror mede a
	 * altura com getBoundingClientRect, que ignora margem — margem vertical
	 * aqui desalinha o heightmap (clique/setas/Home/End caem na linha errada). */
	:global(.cm-md-image-wrap) {
		display: block;
		margin: 0;
		padding: 0.4em 0;
	}

	:global(.cm-md-image) {
		display: block;
		max-width: 100%;
		border-radius: 4px;
		margin: 0;
	}

	:global(.cm-md-table-wrap) {
		margin: 0;
		padding: 0.75em 0;
		overflow-x: auto;
		/* impede o min-content da tabela de inflar a largura do .cm-content */
		contain: inline-size;
		white-space: normal;
		word-break: normal;
		overflow-wrap: break-word;
	}

	:global(.cm-md-table) {
		border-collapse: collapse;
		margin: 0;
		font-size: 0.95em;
	}

	:global(.cm-md-table th),
	:global(.cm-md-table td) {
		border: 1px solid var(--border);
		padding: 6px 10px;
		text-align: left;
		vertical-align: top;
		min-width: 3em;
	}

	:global(.cm-md-table th) {
		background: var(--surface);
		font-weight: 700;
	}

	/* célula vazia ainda ocupa a altura de uma linha */
	:global(.cm-md-table td:empty::after) {
		content: '\200b';
	}

	:global(.cm-md-table img.cm-md-cell-image) {
		display: inline-block;
		max-width: 100%;
		max-height: 12em;
		vertical-align: middle;
	}

	:global(.cm-md-table-in-quote) {
		position: relative;
		padding-left: 12px;
	}

	:global(.cm-md-table-in-quote::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--border);
		pointer-events: none;
	}

	:global(.cm-md-hr-wrap) {
		margin: 0;
		padding: 1.5em 0;
	}

	:global(.cm-md-hr) {
		margin: 0;
		height: 0;
		border: none;
		border-top: 1px solid var(--border);
	}
</style>
