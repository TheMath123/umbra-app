/**
 * Orquestra a exportação de verdade: individual (um arquivo) ou de uma
 * pasta inteira. A conversão de conteúdo mora em `markdownExport.ts`;
 * este módulo só decide QUAIS arquivos entram e ONDE cada um é escrito.
 */
import { invoke } from '@tauri-apps/api/core';
import type { DirNode } from './types';
import { joinPath, baseName } from './paths';
import { exportMarkdownToDocxBase64, exportMarkdownToHtml, exportMarkdownToText } from './markdownExport';

export type ExportFormat = 'md' | 'txt' | 'html' | 'docx';

function flattenFiles(nodes: DirNode[]): DirNode[] {
	const out: DirNode[] = [];
	for (const n of nodes) {
		if (n.isDir) out.push(...flattenFiles(n.children ?? []));
		else out.push(n);
	}
	return out;
}

function swapExt(path: string, ext: string): string {
	const idx = path.lastIndexOf('.');
	return (idx === -1 ? path : path.slice(0, idx)) + '.' + ext;
}

/** Caminho de `path` relativo a `root` — usado para espelhar a árvore
 *  original dentro da pasta de destino escolhida pelo usuário. */
function relativeTo(root: string, path: string): string {
	const sep = path.includes('\\') ? '\\' : '/';
	const normalizedRoot = root.endsWith(sep) ? root : root + sep;
	return path.startsWith(normalizedRoot) ? path.slice(normalizedRoot.length) : baseName(path);
}

function titleFor(path: string): string {
	return baseName(path).replace(/\.[^./\\]+$/, '');
}

async function writeConverted(format: ExportFormat, sourcePath: string, content: string, destPath: string): Promise<void> {
	if (format === 'md') {
		await invoke('write_markdown_file', { path: destPath, content });
	} else if (format === 'txt') {
		await invoke('write_markdown_file', { path: destPath, content: exportMarkdownToText(content) });
	} else if (format === 'html') {
		const html = await exportMarkdownToHtml(content, sourcePath, titleFor(destPath));
		await invoke('write_markdown_file', { path: destPath, content: html });
	} else if (format === 'docx') {
		const base64 = await exportMarkdownToDocxBase64(content, sourcePath);
		await invoke('write_binary_file', { path: destPath, dataBase64: base64 });
	}
}

/** Exporta um único arquivo markdown já aberto (o conteúdo vem da aba —
 *  evita reler do disco um arquivo que pode ter alterações não salvas
 *  refletidas só em memória). */
export async function exportSingleFile(
	format: ExportFormat,
	sourcePath: string,
	content: string,
	destPath: string
): Promise<void> {
	await writeConverted(format, sourcePath, content, destPath);
}

export interface FolderExportProgress {
	done: number;
	total: number;
	currentName: string;
}

export interface FolderExportResult {
	written: number;
	failed: { path: string; error: string }[];
}

/** Exporta a pasta inteira, espelhando a árvore original dentro de
 *  `destDir`. Para o formato Markdown, imagens e PDFs referenciados são
 *  copiados junto (os links relativos continuam funcionando); nos
 *  demais formatos as imagens já ficam embutidas no próprio arquivo
 *  convertido, então copiar o binário de novo seria só duplicar peso. */
export async function exportFolder(
	tree: DirNode[],
	rootDir: string,
	destDir: string,
	format: ExportFormat,
	onProgress?: (p: FolderExportProgress) => void
): Promise<FolderExportResult> {
	const files = flattenFiles(tree);
	const total = files.length;
	let done = 0;
	const failed: { path: string; error: string }[] = [];

	for (const file of files) {
		onProgress?.({ done, total, currentName: file.name });
		try {
			const rel = relativeTo(rootDir, file.path);
			if (file.kind === 'markdown') {
				const destPath = joinPath(destDir, format === 'md' ? rel : swapExt(rel, format));
				const content = await invoke<string>('read_markdown_file', { path: file.path });
				await writeConverted(format, file.path, content, destPath);
			} else if (format === 'md') {
				await invoke('copy_file', { source: file.path, destination: joinPath(destDir, rel) });
			}
		} catch (e) {
			failed.push({ path: file.path, error: String(e) });
		}
		done++;
	}
	onProgress?.({ done, total, currentName: '' });
	return { written: done - failed.length, failed };
}

const PRINT_PAYLOAD_KEY = 'umbra.printPayload';

/** PDF sai pelo diálogo de impressão nativo do Windows ("Salvar como
 *  PDF") — sem depender de nenhuma biblioteca pesada de geração de PDF,
 *  com fidelidade total ao mesmo HTML/CSS da exportação. A troca de
 *  conteúdo entre esta janela e a nova acontece por `localStorage`
 *  (mesma origem, compartilhado entre janelas do app). */
export function preparePrintPayload(html: string): void {
	localStorage.setItem(PRINT_PAYLOAD_KEY, html);
}

export function consumePrintPayload(): string | null {
	const raw = localStorage.getItem(PRINT_PAYLOAD_KEY);
	localStorage.removeItem(PRINT_PAYLOAD_KEY);
	return raw;
}
