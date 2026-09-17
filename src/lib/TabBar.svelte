<script lang="ts">
	import type { Tab } from './types';
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import { t } from './i18n.svelte';

	let {
		tabs,
		activeIndex,
		onActivate,
		onClose,
		onReorder,
		onTearOff
	}: {
		tabs: Tab[];
		activeIndex: number | null;
		onActivate: (index: number) => void;
		onClose: (index: number) => void;
		onReorder: (from: number, to: number) => void;
		onTearOff: (index: number) => void;
	} = $props();

	let draggingIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);
	// Vira `true` assim que o ponteiro cruza a borda da janela durante o
	// arrasto — é o sinal de que o usuário quer "destacar" a aba.
	let draggedOutside = $state(false);

	function onDragStart(e: DragEvent, index: number) {
		draggingIndex = index;
		draggedOutside = false;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragOverTab(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverIndex = index;
	}

	function onDropTab(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggingIndex !== null && draggingIndex !== index) {
			onReorder(draggingIndex, index);
		}
		draggingIndex = null;
		dragOverIndex = null;
	}

	function onWindowDragOver(e: DragEvent) {
		if (draggingIndex === null) return;
		// dragover com coordenadas dentro da janela: ainda não saiu.
		const outside =
			e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
		if (outside) draggedOutside = true;
	}

	function onWindowDragLeave(e: DragEvent) {
		if (draggingIndex === null) return;
		// relatedTarget nulo (ou fora do viewport) == saiu do documento inteiro.
		if (
			e.relatedTarget === null ||
			e.clientX <= 0 ||
			e.clientY <= 0 ||
			e.clientX >= window.innerWidth ||
			e.clientY >= window.innerHeight
		) {
			draggedOutside = true;
		}
	}

	function onDragEnd() {
		if (draggingIndex !== null && draggedOutside) {
			onTearOff(draggingIndex);
		}
		draggingIndex = null;
		dragOverIndex = null;
		draggedOutside = false;
	}

	let tabbarEl = $state<HTMLDivElement | null>(null);

	/** A rodinha do mouse rola verticalmente por padrão; aqui vira scroll
	 *  horizontal, já que é a única direção que a barra de abas tem. */
	function onWheel(e: WheelEvent) {
		if (!tabbarEl || e.deltaY === 0) return;
		e.preventDefault();
		tabbarEl.scrollLeft += e.deltaY;
	}

	function onTabbarKeydown(e: KeyboardEvent) {
		if (tabbarEl) navigateWithArrows(e, tabbarEl, '.tab', 'horizontal');
	}
</script>

<svelte:window ondragover={onWindowDragOver} ondragleave={onWindowDragLeave} />

<div
	class="tabbar"
	role="tablist"
	tabindex="-1"
	data-tauri-drag-region
	bind:this={tabbarEl}
	onwheel={onWheel}
	onkeydown={onTabbarKeydown}
>
	{#each tabs as tab, i (tab.path)}
		<div
			class="tab"
			class:active={i === activeIndex}
			class:drag-over={dragOverIndex === i && draggingIndex !== i}
			class:dragging={draggingIndex === i}
			role="tab"
			tabindex="0"
			aria-selected={i === activeIndex}
			draggable="true"
			title={tab.path}
			ondragstart={(e) => onDragStart(e, i)}
			ondragover={(e) => onDragOverTab(e, i)}
			ondrop={(e) => onDropTab(e, i)}
			ondragend={onDragEnd}
			onclick={() => onActivate(i)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onActivate(i);
			}}
		>
			<span class="tab-name">{tab.path.split(/[\\/]/).pop()}</span>
			<button
				class="tab-close"
				title={t('tabs.close', { shortcut: 'Ctrl+W' })}
				onclick={(e) => {
					e.stopPropagation();
					onClose(i);
				}}
			>
				<Icon name="close" size={14} />
			</button>
		</div>
	{/each}
</div>

<style>
	.tabbar {
		display: flex;
		align-items: stretch;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		/* Scroll continua funcionando (roda do mouse, Ctrl+Tab) — só a barra
		   visual some, ela só ocupava espaço sem ajudar em nada aqui. */
		scrollbar-width: none;
	}

	.tabbar::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 8px 0 14px;
		height: 36px;
		font-size: 13px;
		border-right: 1px solid var(--border);
		cursor: pointer;
		white-space: nowrap;
		color: var(--text-muted);
		position: relative;
		user-select: none;
	}

	.tab:hover {
		background: var(--hover);
	}

	.tab.active {
		color: var(--text);
		background: var(--bg);
	}

	.tab.active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background: var(--accent);
	}

	.tab.dragging {
		opacity: 0.5;
	}

	.tab.drag-over {
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.tab-name {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 180px;
	}

	.tab-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: inherit;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.6;
	}

	.tab-close:hover {
		opacity: 1;
		background: var(--border);
	}
</style>
