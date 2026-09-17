<script lang="ts">
	import { untrack } from 'svelte';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import { exportFolder, exportSingleFile, preparePrintPayload } from './exportRunner';
	import { exportMarkdownToHtml } from './markdownExport';
	import { baseName } from './paths';
	import type { DirNode, Tab } from './types';

	let {
		activeTab,
		tree,
		rootDir,
		onClose
	}: {
		activeTab: Tab | null;
		tree: DirNode[];
		rootDir: string | null;
		onClose: () => void;
	} = $props();

	type Scope = 'file' | 'folder';
	type Format = 'md' | 'txt' | 'html' | 'docx' | 'pdf';

	const canExportFile = $derived(activeTab?.kind === 'markdown');

	// Só a escolha inicial de escopo acompanha a aba ativa — depois de aberto,
	// o modal não deve pular de escopo sozinho se o usuário trocar de aba.
	let scope = $state<Scope>(untrack(() => (activeTab?.kind === 'markdown' ? 'file' : 'folder')));
	let format = $state<Format>('md');
	let busy = $state(false);
	let progress = $state<{ done: number; total: number } | null>(null);
	let error = $state<string | null>(null);
	let doneMessage = $state<string | null>(null);

	const scopeOptions = $derived([
		{ value: 'file' as const, label: 'Arquivo atual', disabled: !canExportFile },
		{ value: 'folder' as const, label: 'Pasta inteira', disabled: !rootDir }
	]);
	const formatOptions: { value: Format; label: string }[] = [
		{ value: 'md', label: 'Markdown' },
		{ value: 'txt', label: 'Texto' },
		{ value: 'html', label: 'HTML' },
		{ value: 'docx', label: 'Word' },
		{ value: 'pdf', label: 'PDF' }
	];

	const EXT: Record<'md' | 'txt' | 'html' | 'docx', string> = { md: 'md', txt: 'txt', html: 'html', docx: 'docx' };

	function selectScope(value: Scope) {
		scope = value;
		if (value === 'folder' && format === 'pdf') format = 'md';
	}

	function onSegmentedKeydown(e: KeyboardEvent) {
		navigateWithArrows(e, e.currentTarget as HTMLElement, 'button:not(:disabled)', 'horizontal');
	}

	function titleOf(path: string): string {
		return baseName(path).replace(/\.[^./\\]+$/, '');
	}

	async function exportActiveAsPdf() {
		if (!activeTab) return;
		const title = titleOf(activeTab.path);
		const html = await exportMarkdownToHtml(activeTab.content, activeTab.path, title);
		preparePrintPayload(html);
		new WebviewWindow(`print-${Date.now()}`, {
			url: '/?print=1',
			title: `Imprimir — ${title}`,
			width: 900,
			height: 1000
		});
		doneMessage = 'Janela de impressão aberta — escolha "Salvar como PDF" no diálogo do Windows.';
	}

	async function runExport() {
		error = null;
		doneMessage = null;

		if (format === 'pdf') {
			if (scope !== 'file') return;
			busy = true;
			try {
				await exportActiveAsPdf();
			} catch (e) {
				error = String(e);
			} finally {
				busy = false;
			}
			return;
		}

		const realFormat = format as 'md' | 'txt' | 'html' | 'docx';

		if (scope === 'file') {
			if (!activeTab) return;
			const ext = EXT[realFormat];
			const suggested = baseName(activeTab.path).replace(/\.[^./\\]+$/, `.${ext}`);
			const destPath = await save({ defaultPath: suggested, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
			if (!destPath) return;
			busy = true;
			try {
				await exportSingleFile(realFormat, activeTab.path, activeTab.content, destPath);
				doneMessage = 'Arquivo exportado.';
			} catch (e) {
				error = String(e);
			} finally {
				busy = false;
			}
			return;
		}

		if (!rootDir) return;
		const destDir = await open({ directory: true, title: 'Escolha a pasta de destino' });
		if (typeof destDir !== 'string') return;
		busy = true;
		progress = { done: 0, total: 0 };
		try {
			const result = await exportFolder(tree, rootDir, destDir, realFormat, (p) => {
				progress = { done: p.done, total: p.total };
			});
			doneMessage =
				result.failed.length > 0
					? `${result.written} arquivo(s) exportado(s), ${result.failed.length} com erro.`
					: `${result.written} arquivo(s) exportado(s) com sucesso.`;
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
			progress = null;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !busy) onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onclick={() => !busy && onClose()} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Exportar"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="header">
			<h2><Icon name="download" size={18} /> Exportar</h2>
			<button class="close" onclick={onClose} title="Fechar (Esc)" disabled={busy}>
				<Icon name="close" size={16} />
			</button>
		</div>

		<div class="body">
			{#if error}
				<div class="banner error">{error}</div>
			{/if}
			{#if doneMessage}
				<div class="banner success">{doneMessage}</div>
			{/if}

			<div class="row">
				<span class="row-label">Escopo</span>
				<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
					{#each scopeOptions as opt (opt.value)}
						<button
							class:active={scope === opt.value}
							disabled={opt.disabled || busy}
							title={opt.disabled ? (opt.value === 'file' ? 'Abra um arquivo markdown para exportar só ele' : 'Nenhuma pasta aberta') : ''}
							onclick={() => selectScope(opt.value)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="row">
				<span class="row-label">Formato</span>
				<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
					{#each formatOptions as opt (opt.value)}
						<button
							class:active={format === opt.value}
							disabled={busy || (opt.value === 'pdf' && scope === 'folder')}
							title={opt.value === 'pdf' && scope === 'folder'
								? 'PDF de pasta inteira abriria um diálogo de impressão por arquivo — exporte um arquivo de cada vez, ou use HTML/DOCX para a pasta toda'
								: ''}
							onclick={() => (format = opt.value)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			{#if format === 'pdf'}
				<p class="hint">
					PDF usa o diálogo de impressão do Windows ("Salvar como PDF") — mesma formatação da pré-via, sem depender de
					nenhuma biblioteca extra.
				</p>
			{:else if scope === 'folder'}
				<p class="hint">
					{#if format === 'md'}
						Espelha a pasta inteira no destino, incluindo imagens e PDFs referenciados — os links relativos continuam
						funcionando.
					{:else}
						Cada arquivo markdown vira um <strong>.{EXT[format as 'txt' | 'html' | 'docx']}</strong> no destino, na mesma
						estrutura de pastas; imagens ficam embutidas no próprio arquivo convertido.
					{/if}
				</p>
			{/if}

			{#if progress}
				<div class="progress">
					<div class="progress-bar">
						<div
							class="progress-fill"
							style="transform: scaleX({progress.total ? progress.done / progress.total : 0})"
						></div>
					</div>
					<span class="progress-label">{progress.done} / {progress.total || '…'}</span>
				</div>
			{/if}
		</div>

		<div class="footer">
			<button class="export" onclick={runExport} disabled={busy}>
				{#if busy}
					Exportando…
				{:else}
					<Icon name="download" size={15} /> Exportar
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		width: min(440px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.header h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		margin: 0;
	}

	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 6px;
		border-radius: 4px;
	}

	.close:hover {
		background: var(--hover);
		color: var(--text);
	}

	.close:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.body {
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.banner {
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 12px;
	}

	.banner.error {
		background: color-mix(in srgb, var(--danger) 15%, transparent);
		color: var(--danger);
	}

	.banner.success {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row-label {
		font-size: 12px;
		color: var(--text-muted);
	}

	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.segmented button {
		flex: 1;
		border: none;
		background: var(--surface);
		color: var(--text-muted);
		font-size: 13px;
		padding: 7px 10px;
		cursor: pointer;
		border-left: 1px solid var(--border);
	}

	.segmented button:first-child {
		border-left: none;
	}

	.segmented button:hover:not(:disabled) {
		background: var(--hover);
	}

	.segmented button.active {
		background: var(--accent);
		color: var(--accent-text);
	}

	.segmented button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		border-radius: 4px;
		background: var(--surface);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		width: 100%;
		background: var(--accent);
		transform-origin: left;
		transition: transform 0.15s ease;
	}

	.progress-label {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.export {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 4px;
		padding: 7px 14px;
		font-size: 13px;
		cursor: pointer;
	}

	.export:hover:not(:disabled) {
		opacity: 0.92;
	}

	.export:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
