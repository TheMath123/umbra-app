<script lang="ts">
	import { untrack } from 'svelte';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { EditorView, Decoration, WidgetType, keymap } from '@codemirror/view';
	import type { DecorationSet } from '@codemirror/view';
	import { EditorState, StateField, Compartment } from '@codemirror/state';
	import type { EditorState as EditorStateType } from '@codemirror/state';
	import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
	import { GFM } from '@lezer/markdown';
	import { syntaxTree } from '@codemirror/language';
	import type { SyntaxNode } from '@lezer/common';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { isExternalLink, resolveRelativePath } from './paths';
	import { settings, FONT_STACKS, LINE_HEIGHTS, CONTENT_WIDTHS } from './settings.svelte';
	import { t } from './i18n.svelte';
	import type { DocStats } from './types';

	let {
		path,
		content,
		zoom = 100,
		onSave,
		onNavigate,
		onStats
	}: {
		path: string;
		content: string;
		zoom?: number;
		onSave: (newContent: string) => Promise<void> | void;
		onNavigate?: (path: string) => void;
		onStats?: (stats: DocStats) => void;
	} = $props();

	let editorHost = $state<HTMLDivElement | null>(null);
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
			const img = document.createElement('img');
			img.src = this.src;
			img.alt = this.alt;
			img.className = 'cm-md-image';
			return img;
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
		toDOM() {
			const hr = document.createElement('hr');
			hr.className = 'cm-md-hr';
			return hr;
		}
	}

	class TableWidget extends WidgetType {
		rows: string[][];
		headerRowCount: number;
		constructor(rows: string[][], headerRowCount: number) {
			super();
			this.rows = rows;
			this.headerRowCount = headerRowCount;
		}
		eq(other: TableWidget) {
			return JSON.stringify(other.rows) === JSON.stringify(this.rows);
		}
		toDOM() {
			const table = document.createElement('table');
			table.className = 'cm-md-table';
			this.rows.forEach((cells, i) => {
				const tr = document.createElement('tr');
				for (const cellHtml of cells) {
					const cell = document.createElement(i < this.headerRowCount ? 'th' : 'td');
					cell.innerHTML = cellHtml;
					tr.appendChild(cell);
				}
				table.appendChild(tr);
			});
			return table;
		}
	}

	function overlaps(state: EditorStateType, from: number, to: number): boolean {
		return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/** Renderiza o conteúdo inline de um nó (negrito, itálico, código,
	 *  riscado, link) para HTML simples — usado dentro de células de
	 *  tabela, que o CodeMirror não decora token a token como o resto do
	 *  documento (a tabela vira um widget substituindo o node inteiro). */
	function renderInlineHtml(container: SyntaxNode, state: EditorStateType): string {
		const text = (from: number, to: number) => escapeHtml(state.doc.sliceString(from, to));
		let html = '';
		let pos = container.from;
		let node = container.firstChild;
		while (node) {
			if (node.from > pos) html += text(pos, node.from);
			html += renderInlineNode(node, state);
			pos = node.to;
			node = node.nextSibling;
		}
		if (pos < container.to) html += text(pos, container.to);
		return html;
	}

	function renderInlineNode(node: SyntaxNode, state: EditorStateType): string {
		const text = (from: number, to: number) => escapeHtml(state.doc.sliceString(from, to));
		const inner = (markName: string) => {
			const marks = node.getChildren(markName);
			return { from: marks[0]?.to ?? node.from, to: marks[1]?.from ?? node.to };
		};
		switch (node.name) {
			case 'StrongEmphasis': {
				const { from, to } = inner('EmphasisMark');
				return `<strong>${text(from, to)}</strong>`;
			}
			case 'Emphasis': {
				const { from, to } = inner('EmphasisMark');
				return `<em>${text(from, to)}</em>`;
			}
			case 'Strikethrough': {
				const { from, to } = inner('StrikethroughMark');
				return `<s>${text(from, to)}</s>`;
			}
			case 'InlineCode': {
				const { from, to } = inner('CodeMark');
				return `<code>${text(from, to)}</code>`;
			}
			case 'Link': {
				const { from, to } = inner('LinkMark');
				return `<span class="cm-md-link">${text(from, to)}</span>`;
			}
			default:
				return text(node.from, node.to);
		}
	}

	function cellsOf(row: SyntaxNode, state: EditorStateType): string[] {
		return row.getChildren('TableCell').map((c) => renderInlineHtml(c, state));
	}

	/**
	 * O coração da edição "estilo Typora": para cada elemento de sintaxe,
	 * quando o cursor não está nele, os marcadores (**, #, `, [](...) )
	 * somem e só sobra o texto já estilizado; quando o cursor entra, os
	 * marcadores reaparecem (discretos) para poder editar em texto puro.
	 */
	function buildLivePreview(state: EditorStateType, basePath: string): DecorationSet {
		const ranges: { from: number; to: number; deco: Decoration }[] = [];
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
						const focused = overlaps(state, line.from, line.to);
						const mark = node.node.getChild('HeaderMark');
						if (mark) {
							let end = mark.to;
							if (state.doc.sliceString(end, end + 1) === ' ') end += 1;
							if (focused) markDiscreet(mark.from, end);
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
						push(node.from, node.to, Decoration.mark({ class: 'cm-md-link' }));
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
							else push(mark.from, mark.to, Decoration.replace({ widget: new BulletWidget() }));
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
						for (let n = firstLine.number; n <= lastLine.number; n++) {
							push(state.doc.line(n).from, state.doc.line(n).from, Decoration.line({ class: 'cm-md-code-line' }));
						}
						if (!overlaps(state, node.from, node.to) && firstLine.number !== lastLine.number) {
							// Esconde a cerca de abertura (``` + linguagem) e a de fechamento —
							// sobra só o código, como um bloco visual, igual ao Typora.
							const afterOpenLine = state.doc.line(firstLine.number + 1).from;
							hide(firstLine.from, afterOpenLine, true);
							hide(lastLine.from, lastLine.to, true);
						}
						break;
					}
					case 'Table': {
						if (!overlaps(state, node.from, node.to)) {
							const rows: string[][] = [];
							let headerRowCount = 0;
							for (const child of node.node.getChildren('TableHeader')) {
								rows.push(cellsOf(child, state));
								headerRowCount++;
							}
							for (const child of node.node.getChildren('TableRow')) {
								rows.push(cellsOf(child, state));
							}
							if (rows.length > 0) {
								push(
									node.from,
									node.to,
									Decoration.replace({ widget: new TableWidget(rows, headerRowCount), block: true })
								);
							}
						}
						break;
					}
				}
			}
		});

		return Decoration.set(
			ranges.map((r) => r.deco.range(r.from, r.to)),
			true
		);
	}

	/**
	 * Precisa ser um StateField, não um ViewPlugin: decorações de bloco
	 * (as da tabela e do bloco de código cercado) só são aceitas quando
	 * vêm de um StateField — um ViewPlugin lança "Block decorations may
	 * not be specified via plugins".
	 */
	function livePreviewField(basePath: string) {
		return StateField.define<DecorationSet>({
			create(state) {
				return buildLivePreview(state, basePath);
			},
			update(deco, tr) {
				// O parser de markdown roda em segundo plano para documentos
				// maiores: a árvore sintática pode continuar incompleta bem
				// depois do `create()`, e vai terminando em transações que não
				// mudam o texto nem a seleção. Sem essa comparação, blocos mais
				// abaixo no arquivo (tabelas, links, "---"...) só ganhavam
				// formatação quando algo mais disparava um recálculo (como
				// clicar e mover o cursor).
				const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
				if (tr.docChanged || tr.selection || treeChanged) {
					return buildLivePreview(tr.state, basePath);
				}
				return deco.map(tr.changes);
			},
			provide: (field) => EditorView.decorations.from(field)
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

	/** Clique simples num link/imagem navega — como um link de verdade.
	 *  Ctrl/Cmd+clique entra em edição (deixa o cursor ser posicionado ali). */
	function linkClickHandler(basePath: string) {
		return (e: MouseEvent, editorView: EditorView) => {
			if (e.ctrlKey || e.metaKey) return false;
			const target = e.target instanceof Element ? e.target.closest('.cm-md-link, .cm-md-image') : null;
			if (!target) return false;
			const pos = editorView.posAtDOM(target, 0);
			const node = linkNodeAt(editorView, pos);
			if (!node) return false;
			const urlNode = node.name === 'URL' ? node : node.node.getChild('URL');
			if (!urlNode) return false;
			const href = editorView.state.doc.sliceString(urlNode.from, urlNode.to);
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

	// Num Compartment para poder trocar fonte/tamanho/espaçamento em tempo
	// real (configurações) sem recriar o editor — preserva cursor, seleção
	// e histórico de undo/redo.
	const fontCompartment = new Compartment();

	function buildEditorTheme() {
		return EditorView.theme({
			'&': { color: 'var(--text)', backgroundColor: 'transparent', fontSize: `${settings.fontSize}px` },
			'.cm-content': {
				padding: '32px 40px 80px',
				fontFamily: FONT_STACKS[settings.fontFamily],
				caretColor: 'var(--text)'
			},
			'.cm-line': { padding: '0' },
			'.cm-scroller': { fontFamily: 'inherit', lineHeight: String(LINE_HEIGHTS[settings.lineHeight]) },
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
					keymap.of([...markdownKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
					markdown({ extensions: GFM }),
					livePreviewField(basePath),
					EditorView.lineWrapping,
					fontCompartment.of(buildEditorTheme()),
					EditorView.updateListener.of((u) => {
						if (u.docChanged) scheduleSave();
						if (u.docChanged || u.selectionSet) scheduleStats();
					}),
					EditorView.domEventHandlers({ mousedown: linkClickHandler(basePath) })
				]
			})
		});
		onStats?.(computeStats(view.state));
	}

	$effect(() => {
		// Só recria o editor ao trocar de arquivo — `content` é lido "fora" da
		// reatividade (untrack) para o auto-save (que reescreve essa prop no
		// componente pai) não fazer o editor recomeçar do zero a cada save.
		path;
		createEditor(untrack(() => content), path);
	});

	$effect(() => {
		return () => destroyEditor();
	});

	// Fonte/tamanho/espaçamento das configurações mudam em tempo real, sem
	// recriar o editor (preserva cursor, seleção e histórico de undo).
	$effect(() => {
		settings.fontFamily;
		settings.fontSize;
		settings.lineHeight;
		view?.dispatch({ effects: fontCompartment.reconfigure(buildEditorTheme()) });
	});

	function onBodyClick(e: MouseEvent) {
		if (!view) return;
		if ((e.target as HTMLElement)?.closest('.cm-editor')) return;
		view.focus();
		view.dispatch({ selection: { anchor: view.state.doc.length } });
	}
</script>

<svelte:window onkeydown={onWindowKeydown} onkeyup={onWindowKeyup} onblur={onWindowBlur} />

<div class="view">
	<span class="status" hidden={!saving}>{t('editor.saving')}</span>
	<div class="body" onclick={onBodyClick} onkeydown={() => {}} role="presentation">
		<div
			class="doc-host"
			style="zoom: {zoom}%; max-width: {CONTENT_WIDTHS[settings.contentWidth]};"
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
		cursor: pointer;
	}

	/* Com Ctrl/Cmd pressionado o link vira "editável" em vez de "clicável". */
	:global(.modifier-down .cm-md-link),
	:global(.modifier-down .cm-md-image) {
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

	:global(.cm-md-quote-line) {
		border-left: 3px solid var(--border);
		padding-left: 0.75em !important;
		color: var(--text-muted);
	}

	:global(.cm-md-code-line) {
		background: var(--surface);
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.9em;
	}

	:global(.cm-md-image) {
		display: block;
		max-width: 100%;
		border-radius: 4px;
		margin: 0.4em 0;
		cursor: pointer;
	}

	:global(.cm-md-table) {
		border-collapse: collapse;
		margin: 0.75em 0;
		font-size: 0.95em;
	}

	:global(.cm-md-table th),
	:global(.cm-md-table td) {
		border: 1px solid var(--border);
		padding: 6px 10px;
		text-align: left;
	}

	:global(.cm-md-table th) {
		background: var(--surface);
		font-weight: 700;
	}

	:global(.cm-md-hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 1.5em 0;
	}
</style>
