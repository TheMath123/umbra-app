<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { open, confirm } from '@tauri-apps/plugin-dialog';
	import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
	import FileTree from '$lib/FileTree.svelte';
	import MarkdownView from '$lib/MarkdownView.svelte';
	import ImageView from '$lib/ImageView.svelte';
	import PdfView from '$lib/PdfView.svelte';
	import TabBar from '$lib/TabBar.svelte';
	import HelpModal from '$lib/HelpModal.svelte';
	import ZoomControls from '$lib/ZoomControls.svelte';
	import ContextMenu from '$lib/ContextMenu.svelte';
	import PromptModal from '$lib/PromptModal.svelte';
	import SettingsModal from '$lib/SettingsModal.svelte';
	import ShortcutsModal from '$lib/ShortcutsModal.svelte';
	import ThemeModal from '$lib/ThemeModal.svelte';
	import ExportModal from '$lib/ExportModal.svelte';
	import Icon from '$lib/Icon.svelte';
	import { kindForPath, parentDir, baseName, joinPath } from '$lib/paths';
	import { settings, persistSettings } from '$lib/settings.svelte';
	import { matchesShortcut, recordingState } from '$lib/shortcuts.svelte';
	import { findTheme, applyThemeOverride } from '$lib/themes.svelte';
	import { navigateWithArrows } from '$lib/keyboardNav';
	import { consumePrintPayload } from '$lib/exportRunner';
	import type { DirNode, Tab } from '$lib/types';

	// Janela "invisível" aberta só para imprimir o HTML exportado (ver
	// ExportModal → PDF): sem árvore, sem abas, sem efeitos do app normal —
	// só troca o documento inteiro pelo HTML recebido e chama window.print().
	const isPrintMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('print') === '1';

	let rootDir = $state<string | null>(null);
	let tree = $state<DirNode[]>([]);
	let tabs = $state<Tab[]>([]);
	let activeTabIndex = $state<number | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let showHelp = $state(false);
	let showSettings = $state(false);
	let showShortcuts = $state(false);
	let showThemes = $state(false);
	let showExport = $state(false);
	let overflowMenu = $state<{ x: number; y: number } | null>(null);

	type PromptState =
		| { kind: 'create-folder'; parentPath: string }
		| { kind: 'create-file'; parentPath: string }
		| { kind: 'rename'; node: DirNode }
		| null;
	let contextMenu = $state<{ x: number; y: number; node: DirNode | null } | null>(null);
	let prompt = $state<PromptState>(null);

	// Fixa (sempre visível) ou "automática" (desliza para fora ao tirar o
	// mouse, volta ao encostar na borda) — o modo padrão vem das
	// configurações; a visibilidade momentânea é só desta sessão.
	let sidebarVisible = $state(settings.sidebarMode === 'fixed');
	let sidebarHideTimer: ReturnType<typeof setTimeout> | undefined;

	function toggleSidebarMode() {
		settings.sidebarMode = settings.sidebarMode === 'fixed' ? 'auto' : 'fixed';
		sidebarVisible = settings.sidebarMode === 'fixed';
		persistSettings();
	}

	function onSidebarMouseEnter() {
		clearTimeout(sidebarHideTimer);
		if (settings.sidebarMode === 'auto') sidebarVisible = true;
	}

	function onSidebarMouseLeave() {
		if (settings.sidebarMode !== 'auto') return;
		sidebarHideTimer = setTimeout(() => (sidebarVisible = false), 500);
	}

	// A imagem controla seu próprio zoom (encaixe automático) — o app só
	// dispara comandos e espelha o percentual atual para os controles.
	let imageViewRef = $state<{ zoomIn: () => void; zoomOut: () => void; zoomReset: () => void } | null>(null);
	let imageZoomPercent = $state(100);

	let activeTab = $derived(activeTabIndex !== null ? tabs[activeTabIndex] : null);
	// PDF usa o zoom do visualizador nativo — não exibimos nem controlamos.
	let zoomable = $derived(activeTab && activeTab.kind !== 'pdf');
	let displayZoom = $derived(
		activeTab?.kind === 'markdown' ? activeTab.zoom : activeTab?.kind === 'image' ? imageZoomPercent : 100
	);

	async function loadTree(dir: string) {
		error = null;
		try {
			tree = await invoke<DirNode[]>('list_workspace_tree', { root: dir });
			rootDir = dir;
		} catch (e) {
			error = String(e);
		}
	}

	async function openPath(path: string) {
		const existing = tabs.findIndex((t) => t.path === path);
		if (existing !== -1) {
			activeTabIndex = existing;
			return;
		}
		const kind = kindForPath(path);
		if (!kind) {
			error = `Tipo de arquivo não suportado: ${path}`;
			return;
		}
		try {
			// Imagem/PDF só precisam do caminho (o visualizador resolve a URL);
			// markdown carrega o texto para o editor/preview.
			const content = kind === 'markdown' ? await invoke<string>('read_markdown_file', { path }) : '';
			tabs = [...tabs, { path, kind, content, zoom: 100 }];
			activeTabIndex = tabs.length - 1;
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function selectFile(node: DirNode) {
		openPath(node.path);
	}

	function closeTab(index: number) {
		const wasActive = activeTabIndex === index;
		tabs = [...tabs.slice(0, index), ...tabs.slice(index + 1)];
		if (tabs.length === 0) {
			activeTabIndex = null;
		} else if (wasActive) {
			activeTabIndex = Math.min(index, tabs.length - 1);
		} else if (activeTabIndex !== null && activeTabIndex > index) {
			activeTabIndex -= 1;
		}
	}

	function reorderTabs(from: number, to: number) {
		const newTabs = [...tabs];
		const [moved] = newTabs.splice(from, 1);
		newTabs.splice(to, 0, moved);
		tabs = newTabs;

		if (activeTabIndex === from) {
			activeTabIndex = to;
		} else if (activeTabIndex !== null) {
			if (from < activeTabIndex && to >= activeTabIndex) activeTabIndex -= 1;
			else if (from > activeTabIndex && to <= activeTabIndex) activeTabIndex += 1;
		}
	}

	/** Arrastou a aba para fora da janela: abre uma janela nova só com ela. */
	async function tearOffTab(index: number) {
		const tab = tabs[index];
		if (!tab || !rootDir) return;
		closeTab(index);

		const label = `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
		const url = `/?root=${encodeURIComponent(rootDir)}&file=${encodeURIComponent(tab.path)}`;
		const win = new WebviewWindow(label, {
			url,
			title: tab.path.split(/[\\/]/).pop() ?? 'MD Reader',
			width: 900,
			height: 700
		});
		win.once('tauri://error', (e) => {
			error = `Falha ao abrir nova janela: ${String(e.payload)}`;
		});
	}

	async function saveByPath(path: string, newContent: string) {
		const index = tabs.findIndex((t) => t.path === path);
		if (index === -1) return;
		try {
			await invoke('write_markdown_file', { path, content: newContent });
			tabs[index] = { ...tabs[index], content: newContent };
		} catch (e) {
			error = String(e);
		}
	}

	async function pickFolder() {
		const dir = await open({ directory: true, multiple: false });
		if (typeof dir === 'string') {
			await loadTree(dir);
		}
	}

	function openContextMenu(node: DirNode | null, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY, node };
	}

	/** Onde um "novo item" deve nascer: dentro da pasta clicada, ao lado do
	 *  arquivo clicado, ou na raiz quando o clique foi na área vazia. */
	function contextMenuTargetDir(node: DirNode | null): string {
		if (!node) return rootDir ?? '';
		return node.isDir ? node.path : parentDir(node.path);
	}

	function contextMenuItems(node: DirNode | null): ComponentProps<typeof ContextMenu>['items'] {
		const parent = contextMenuTargetDir(node);
		const items: ComponentProps<typeof ContextMenu>['items'] = [
			{
				label: 'Nova pasta',
				icon: 'folder',
				onClick: () => (prompt = { kind: 'create-folder', parentPath: parent })
			},
			{
				label: 'Novo arquivo markdown',
				icon: 'description',
				onClick: () => (prompt = { kind: 'create-file', parentPath: parent })
			}
		];
		if (node) {
			items.push({ label: 'Renomear', icon: 'edit', onClick: () => (prompt = { kind: 'rename', node }) });
			items.push({ label: 'Excluir', icon: 'delete-outline', danger: true, onClick: () => deleteItem(node) });
		}
		return items;
	}

	async function deleteItem(node: DirNode) {
		const kindLabel = node.isDir ? 'a pasta' : 'o arquivo';
		const ok = await confirm(`Enviar ${kindLabel} "${node.name}" para a lixeira?`, {
			title: 'Excluir',
			kind: 'warning'
		});
		if (!ok || !rootDir) return;
		try {
			await invoke('delete_path', { path: node.path });
			const activePath = activeTab?.path ?? null;
			// Fecha abas do próprio item ou de qualquer coisa dentro dele (pasta).
			tabs = tabs.filter(
				(t) => t.path !== node.path && !t.path.startsWith(node.path + '\\') && !t.path.startsWith(node.path + '/')
			);
			if (tabs.length === 0) {
				activeTabIndex = null;
			} else {
				const stillOpenIndex = activePath ? tabs.findIndex((t) => t.path === activePath) : -1;
				activeTabIndex = stillOpenIndex !== -1 ? stillOpenIndex : tabs.length - 1;
			}
			await loadTree(rootDir);
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function submitPrompt(value: string) {
		if (!prompt || !rootDir) return;
		const current = prompt;
		prompt = null;
		try {
			if (current.kind === 'create-folder') {
				await invoke('create_directory', { path: joinPath(current.parentPath, value) });
			} else if (current.kind === 'create-file') {
				const name = /\.(md|markdown)$/i.test(value) ? value : `${value}.md`;
				const path = joinPath(current.parentPath, name);
				await invoke('create_markdown_file', { path });
				await loadTree(rootDir);
				await openPath(path);
				return;
			} else if (current.kind === 'rename') {
				const newPath = joinPath(parentDir(current.node.path), value);
				await invoke('rename_path', { oldPath: current.node.path, newPath });
				// Se o item renomeado (ou algo dentro dele) estava aberto, atualiza a aba.
				tabs = tabs.map((t) =>
					t.path === current.node.path || t.path.startsWith(current.node.path + '\\') || t.path.startsWith(current.node.path + '/')
						? { ...t, path: newPath + t.path.slice(current.node.path.length) }
						: t
				);
			}
			await loadTree(rootDir);
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function moveItem(sourcePath: string, targetFolderPath: string) {
		if (!rootDir) return;
		const newPath = joinPath(targetFolderPath, baseName(sourcePath));
		if (newPath === sourcePath) return;
		try {
			await invoke('rename_path', { oldPath: sourcePath, newPath });
			tabs = tabs.map((t) =>
				t.path === sourcePath || t.path.startsWith(sourcePath + '\\') || t.path.startsWith(sourcePath + '/')
					? { ...t, path: newPath + t.path.slice(sourcePath.length) }
					: t
			);
			await loadTree(rootDir);
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function setMarkdownZoom(value: number) {
		if (activeTabIndex === null) return;
		tabs[activeTabIndex] = { ...tabs[activeTabIndex], zoom: Math.min(300, Math.max(30, value)) };
	}

	function zoomIn() {
		if (activeTab?.kind === 'markdown') setMarkdownZoom(activeTab.zoom + 10);
		else if (activeTab?.kind === 'image') imageViewRef?.zoomIn();
	}
	function zoomOut() {
		if (activeTab?.kind === 'markdown') setMarkdownZoom(activeTab.zoom - 10);
		else if (activeTab?.kind === 'image') imageViewRef?.zoomOut();
	}
	function zoomReset() {
		if (activeTab?.kind === 'markdown') setMarkdownZoom(100);
		else if (activeTab?.kind === 'image') imageViewRef?.zoomReset();
	}

	function handleKeydown(e: KeyboardEvent) {
		// O modal de atalhos está esperando uma combinação nova — não executa
		// a ação antiga enquanto isso.
		if (recordingState.active) return;

		if (matchesShortcut(e, 'toggleHelp')) {
			// Não abrir enquanto o usuário digita em algum campo/editor.
			const target = e.target as HTMLElement | null;
			const typing = target?.closest('.cm-editor, input, textarea, [contenteditable="true"]');
			if (!typing) {
				e.preventDefault();
				showHelp = true;
				return;
			}
		}

		if (matchesShortcut(e, 'toggleSidebar')) {
			e.preventDefault();
			toggleSidebarMode();
			return;
		}

		if (zoomable && matchesShortcut(e, 'zoomIn')) {
			e.preventDefault();
			zoomIn();
			return;
		}
		if (zoomable && matchesShortcut(e, 'zoomOut')) {
			e.preventDefault();
			zoomOut();
			return;
		}
		if (zoomable && matchesShortcut(e, 'zoomReset')) {
			e.preventDefault();
			zoomReset();
			return;
		}

		if (tabs.length === 0) return;

		if (matchesShortcut(e, 'nextTab')) {
			e.preventDefault();
			activeTabIndex = ((activeTabIndex ?? 0) + 1) % tabs.length;
		} else if (matchesShortcut(e, 'prevTab')) {
			e.preventDefault();
			activeTabIndex = ((activeTabIndex ?? 0) - 1 + tabs.length) % tabs.length;
		} else if (matchesShortcut(e, 'closeTab')) {
			e.preventDefault();
			if (activeTabIndex !== null) closeTab(activeTabIndex);
		} else if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
			// Ir para a aba N não é customizável — é sempre Ctrl+1..9.
			e.preventDefault();
			const index = Number(e.key) - 1;
			if (index < tabs.length) activeTabIndex = index;
		}
	}

	/** Ctrl + roda do mouse também ajusta o zoom, como em browsers/editores. */
	// A roda do mouse dispara muitos eventos por segundo — sem agrupar,
	// cada um forçava um reflow imediato (pesado numa imagem grande) e a
	// fila de eventos se acumulava mais rápido do que o WebView conseguia
	// desenhar, travando a janela. Um único ajuste de zoom por frame resolve.
	let wheelZoomDelta = 0;
	let wheelZoomQueued = false;

	function handleWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey) || !zoomable) return;
		e.preventDefault();
		wheelZoomDelta += e.deltaY < 0 ? 1 : -1;
		if (wheelZoomQueued) return;
		wheelZoomQueued = true;
		requestAnimationFrame(() => {
			if (wheelZoomDelta > 0) zoomIn();
			else if (wheelZoomDelta < 0) zoomOut();
			wheelZoomDelta = 0;
			wheelZoomQueued = false;
		});
	}

	// Aplica o tema escolhido. "system" segue o SO (via media query, sem
	// nenhum override). "light"/"dark" usam as regras CSS estáticas do app
	// (via data-theme). Qualquer outro id (tema embutido extra ou
	// customizado) sobrescreve as variáveis de cor diretamente via JS.
	$effect(() => {
		const root = document.documentElement;
		const id = settings.themeId;
		if (id === 'system') {
			root.removeAttribute('data-theme');
			applyThemeOverride(null);
		} else if (id === 'light' || id === 'dark') {
			root.setAttribute('data-theme', id);
			applyThemeOverride(null);
		} else {
			root.removeAttribute('data-theme');
			applyThemeOverride(findTheme(id) ?? null);
		}
	});

	$effect(() => {
		if (isPrintMode) return;
		(async () => {
			const params = new URLSearchParams(window.location.search);
			const queryRoot = params.get('root');
			const queryFile = params.get('file');

			const initial = queryRoot ?? (await invoke<string | null>('get_initial_dir'));
			if (initial) {
				await loadTree(initial);
			}
			if (queryFile) {
				await openPath(queryFile);
			}
			loading = false;
		})();
	});

	// A troca de documento roda depois do mount (não durante a inicialização
	// do componente), para o `document.write` substituir a página só depois
	// que o Svelte já terminou de montar o pouco que essa janela renderiza.
	$effect(() => {
		if (!isPrintMode) return;
		const html = consumePrintPayload();
		if (!html) return;
		document.open();
		document.write(html);
		document.close();
		window.addEventListener('afterprint', () => window.close());
		requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
	});
</script>

<svelte:window onkeydown={isPrintMode ? undefined : handleKeydown} onwheel={isPrintMode ? undefined : handleWheel} />

{#if !isPrintMode}
<main>
	<button
		class="overflow-btn"
		onclick={(e) => (overflowMenu = { x: e.clientX, y: e.clientY })}
		title="Mais opções"
	>
		<Icon name="more-horiz" size={18} />
	</button>

	{#if loading}
		<div class="empty">Carregando…</div>
	{:else if !rootDir}
		<div class="empty">
			<p>Nenhuma pasta aberta.</p>
			<button onclick={pickFolder}>Abrir pasta…</button>
		</div>
	{:else}
		{#if settings.sidebarMode === 'auto' && !sidebarVisible}
			<div class="sidebar-trigger" role="presentation" onmouseenter={onSidebarMouseEnter}></div>
		{/if}

		<aside
			class="sidebar"
			class:auto={settings.sidebarMode === 'auto'}
			class:collapsed={settings.sidebarMode === 'auto' && !sidebarVisible}
			onmouseenter={onSidebarMouseEnter}
			onmouseleave={onSidebarMouseLeave}
			oncontextmenu={(e) => openContextMenu(null, e)}
		>
			<div class="sidebar-header">
				<button class="repo-name" onclick={pickFolder} title={`${rootDir}\n\nClique para trocar de pasta`}>
					{rootDir.split(/[\\/]/).pop()}
				</button>
				<div class="sidebar-actions">
					<button
						class="icon-btn"
						onclick={toggleSidebarMode}
						title={settings.sidebarMode === 'fixed'
							? 'Ocultar automaticamente (Ctrl+B)'
							: 'Fixar barra lateral (Ctrl+B)'}
					>
						<Icon name={settings.sidebarMode === 'fixed' ? 'push-pin-filled' : 'push-pin-outlined'} size={15} />
					</button>
					<button class="icon-btn" onclick={(e) => openContextMenu(null, e)} title="Nova pasta ou arquivo">
						<Icon name="add" size={16} />
					</button>
				</div>
			</div>
			<div
				class="tree-scroll"
				role="tree"
				tabindex="-1"
				onkeydown={(e) => navigateWithArrows(e, e.currentTarget as HTMLElement, '.entry')}
			>
				{#if tree.length === 0}
					<p class="empty-tree">Nenhum arquivo suportado encontrado.</p>
				{:else}
					<FileTree
						nodes={tree}
						selectedPath={activeTab?.path ?? null}
						onSelect={selectFile}
						onContextMenu={openContextMenu}
						onMove={moveItem}
					/>
				{/if}
			</div>
		</aside>

		<section class="content">
			{#if tabs.length > 0}
				<div class="content-topbar">
					<TabBar
						{tabs}
						activeIndex={activeTabIndex}
						onActivate={(i) => (activeTabIndex = i)}
						onClose={closeTab}
						onReorder={reorderTabs}
						onTearOff={tearOffTab}
					/>
					<!-- Espaço reservado para o botão "..." flutuante nunca cobrir uma aba. -->
					<div class="overflow-spacer"></div>
				</div>
			{/if}

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<div class="view-area">
				{#if activeTab}
					{@const tab = activeTab}
					{#key tab.path}
						{#if tab.kind === 'markdown'}
							<MarkdownView
								path={tab.path}
								content={tab.content}
								zoom={tab.zoom}
								onSave={(c) => saveByPath(tab.path, c)}
								onNavigate={openPath}
							/>
						{:else if tab.kind === 'image'}
							<ImageView
								bind:this={imageViewRef}
								path={tab.path}
								onZoomChange={(p) => (imageZoomPercent = p)}
							/>
						{:else if tab.kind === 'pdf'}
							<PdfView path={tab.path} />
						{/if}
					{/key}
					{#if zoomable}
						<ZoomControls zoom={Math.round(displayZoom)} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={zoomReset} />
					{/if}
				{:else}
					<div class="empty">Selecione um arquivo na barra lateral.</div>
				{/if}
			</div>
		</section>
	{/if}
</main>

{#if showHelp}
	<HelpModal onClose={() => (showHelp = false)} />
{/if}

{#if showSettings}
	<SettingsModal onClose={() => (showSettings = false)} onOpenThemes={() => (showThemes = true)} />
{/if}

{#if showShortcuts}
	<ShortcutsModal onClose={() => (showShortcuts = false)} />
{/if}

{#if showThemes}
	<ThemeModal onClose={() => (showThemes = false)} />
{/if}

{#if showExport}
	<ExportModal {activeTab} {tree} {rootDir} onClose={() => (showExport = false)} />
{/if}

{#if overflowMenu}
	<ContextMenu
		x={overflowMenu.x}
		y={overflowMenu.y}
		items={[
			{ label: 'Exportar…', icon: 'download', onClick: () => (showExport = true) },
			{ label: 'Tema', icon: 'palette', onClick: () => (showThemes = true) },
			{ label: 'Configurações', icon: 'settings', onClick: () => (showSettings = true) },
			{ label: 'Personalizar atalhos', icon: 'keyboard', onClick: () => (showShortcuts = true) },
			{ label: 'Ajuda e atalhos', icon: 'help-outline', onClick: () => (showHelp = true) }
		]}
		onClose={() => (overflowMenu = null)}
	/>
{/if}

{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={contextMenuItems(contextMenu.node)}
		onClose={() => (contextMenu = null)}
	/>
{/if}

{#if prompt}
	{#if prompt.kind === 'create-folder'}
		<PromptModal
			title="Nova pasta"
			label="Nome da pasta"
			initialValue="Nova pasta"
			confirmLabel="Criar"
			onConfirm={submitPrompt}
			onCancel={() => (prompt = null)}
		/>
	{:else if prompt.kind === 'create-file'}
		<PromptModal
			title="Novo arquivo markdown"
			label="Nome do arquivo"
			initialValue="Novo arquivo.md"
			confirmLabel="Criar"
			onConfirm={submitPrompt}
			onCancel={() => (prompt = null)}
		/>
	{:else if prompt.kind === 'rename'}
		<PromptModal
			title="Renomear"
			label="Novo nome"
			initialValue={prompt.node.name}
			confirmLabel="Renomear"
			onConfirm={submitPrompt}
			onCancel={() => (prompt = null)}
		/>
	{/if}
{/if}
{/if}

<style>
	:global(:root) {
		--bg: #ffffff;
		--surface: #f4f4f5;
		--border: #e2e2e5;
		--text: #1a1a1e;
		--text-muted: #6b6b70;
		--hover: #ececef;
		--accent: #4f46e5;
		--accent-text: #ffffff;
		--danger: #dc2626;
	}

	@media (prefers-color-scheme: dark) {
		/* "Sistema" (sem data-theme) segue o SO; "Claro" força as cores claras
		   mesmo com o SO em modo escuro. */
		:global(:root:not([data-theme='light'])) {
			--bg: #1e1e22;
			--surface: #29292e;
			--border: #38383e;
			--text: #eaeaec;
			--text-muted: #9a9aa0;
			--hover: #333338;
			--accent: #6366f1;
			--accent-text: #ffffff;
			--danger: #f87171;
		}
	}

	/* "Escuro" força as cores escuras mesmo com o SO em modo claro. */
	:global(:root[data-theme='dark']) {
		--bg: #1e1e22;
		--surface: #29292e;
		--border: #38383e;
		--text: #eaeaec;
		--text-muted: #9a9aa0;
		--hover: #333338;
		--accent: #6366f1;
		--accent-text: #ffffff;
		--danger: #f87171;
	}

	:global(html, body) {
		margin: 0;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
		font-family:
			-apple-system, 'Segoe UI', Inter, Roboto, sans-serif;
	}

	main {
		position: relative;
		display: flex;
		height: 100vh;
		width: 100%;
	}

	.overflow-btn {
		position: absolute;
		top: 4px;
		right: 8px;
		z-index: 30;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 5px;
		border-radius: 4px;
	}

	.overflow-btn:hover {
		background: var(--hover);
		color: var(--text);
	}

	.content-topbar {
		display: flex;
		align-items: stretch;
	}

	.overflow-spacer {
		width: 36px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.empty {
		margin: auto;
		text-align: center;
		color: var(--text-muted);
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
	}

	.empty button {
		border: 1px solid var(--border);
		background: var(--accent);
		color: var(--accent-text);
		border-radius: 4px;
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
	}

	.sidebar {
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		background: var(--bg);
	}

	.tree-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* Modo automático: a sidebar vira um overlay que desliza para fora em
	   vez de empurrar o conteúdo, e uma faixa fina na borda a traz de volta. */
	.sidebar.auto {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		z-index: 20;
		box-shadow: 2px 0 10px rgba(0, 0, 0, 0.14);
		transition: transform 0.18s ease;
	}

	.sidebar.auto.collapsed {
		transform: translateX(-100%);
	}

	.sidebar-trigger {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 10px;
		z-index: 19;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
	}

	.repo-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		text-align: left;
		padding: 2px 4px;
		margin: -2px -4px;
		border-radius: 4px;
		cursor: pointer;
	}

	.repo-name:hover {
		background: var(--hover);
		color: var(--text);
	}

	.sidebar-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}

	.icon-btn:hover {
		background: var(--hover);
	}

	.empty-tree {
		padding: 12px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.view-area {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.error {
		background: color-mix(in srgb, var(--danger) 18%, var(--bg));
		color: var(--danger);
		padding: 8px 14px;
		font-size: 13px;
	}
</style>
