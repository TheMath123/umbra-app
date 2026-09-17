<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	interface MenuItem {
		label: string;
		icon?: IconName;
		onClick: () => void;
		danger?: boolean;
	}

	let { x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void } = $props();

	let menuEl = $state<HTMLElement | null>(null);

	// Mantém o menu dentro da janela, mesmo clicando perto da borda.
	let style = $derived.by(() => {
		if (!menuEl) return `left:${x}px; top:${y}px;`;
		const { innerWidth, innerHeight } = window;
		const left = Math.min(x, innerWidth - menuEl.offsetWidth - 8);
		const top = Math.min(y, innerHeight - menuEl.offsetHeight - 8);
		return `left:${Math.max(8, left)}px; top:${Math.max(8, top)}px;`;
	});

	function runAndClose(action: () => void) {
		action();
		onClose();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
/>

<div class="backdrop" role="presentation" onclick={onClose} oncontextmenu={(e) => e.preventDefault()}></div>

<ul class="menu" bind:this={menuEl} {style} role="menu">
	{#each items as item (item.label)}
		<li role="none">
			<button role="menuitem" class:danger={item.danger} onclick={() => runAndClose(item.onClick)}>
				{#if item.icon}<Icon name={item.icon} size={16} />{/if}
				<span>{item.label}</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.menu {
		position: fixed;
		z-index: 51;
		list-style: none;
		margin: 0;
		padding: 4px;
		min-width: 180px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
	}

	.menu button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		border: none;
		background: none;
		color: var(--text);
		font-size: 13px;
		padding: 7px 10px;
		border-radius: 5px;
		cursor: pointer;
	}

	.menu button:hover {
		background: var(--hover);
	}

	.menu button.danger {
		color: #dc2626;
	}
</style>
