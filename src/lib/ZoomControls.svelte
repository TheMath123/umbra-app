<script lang="ts">
	import Icon from './Icon.svelte';
	import { t } from './i18n.svelte';

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
	<button onclick={onZoomOut} title={t('zoom.decrease')}><Icon name="remove" size={13} /></button>
	<button class="level" onclick={onReset} title={t('zoom.reset')}>{zoom}%</button>
	<button onclick={onZoomIn} title={t('zoom.increase')}><Icon name="add" size={13} /></button>
</div>

<style>
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.zoom-controls button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-muted);
		padding: 3px 6px;
		font-size: 12px;
		border-radius: 4px;
		cursor: pointer;
	}

	.zoom-controls button:hover {
		background: var(--hover);
		color: var(--text);
	}

	.level {
		min-width: 38px;
		font-variant-numeric: tabular-nums;
	}
</style>
