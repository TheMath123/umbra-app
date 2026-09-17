<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		zoom,
		onZoomIn,
		onZoomOut,
		onReset
	}: {
		zoom: number;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onReset: () => void;
	} = $props();
</script>

<div class="zoom-controls">
	<button onclick={onZoomOut} title="Diminuir zoom (Ctrl -)"><Icon name="remove" size={15} /></button>
	<button class="level" onclick={onReset} title="Restaurar 100% (Ctrl 0)">{zoom}%</button>
	<button onclick={onZoomIn} title="Aumentar zoom (Ctrl +)"><Icon name="add" size={15} /></button>
</div>

<style>
	.zoom-controls {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: flex;
		align-items: stretch;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
		overflow: hidden;
		z-index: 5;
	}

	.zoom-controls button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text);
		padding: 6px 12px;
		font-size: 13px;
		line-height: 1.4;
		cursor: pointer;
	}

	.zoom-controls button:hover {
		background: var(--hover);
	}

	.level {
		min-width: 46px;
		border-left: 1px solid var(--border);
		border-right: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
</style>
