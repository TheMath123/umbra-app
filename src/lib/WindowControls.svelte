<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import Icon from './Icon.svelte';
	import { t } from './i18n.svelte';

	const win = getCurrentWindow();

	let maximized = $state(false);

	$effect(() => {
		win.isMaximized().then((m) => (maximized = m));
		const unlisten = win.onResized(async () => {
			maximized = await win.isMaximized();
		});
		return () => {
			unlisten.then((f) => f());
		};
	});
</script>

<div class="window-controls">
	<button onclick={() => win.minimize()} title={t('window.minimize')} aria-label={t('window.minimize')}>
		<Icon name="remove" size={14} />
	</button>
	<button
		onclick={() => win.toggleMaximize()}
		title={t(maximized ? 'window.restore' : 'window.maximize')}
		aria-label={t(maximized ? 'window.restore' : 'window.maximize')}
	>
		<Icon name={maximized ? 'filter-none' : 'crop-square'} size={14} />
	</button>
	<button class="close" onclick={() => win.close()} title={t('window.close')} aria-label={t('window.close')}>
		<Icon name="close" size={14} />
	</button>
</div>

<style>
	.window-controls {
		display: flex;
		align-items: stretch;
		height: 100%;
		flex-shrink: 0;
	}

	.window-controls button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.window-controls button:hover {
		background: var(--hover);
		color: var(--text);
	}

	.window-controls button.close:hover {
		background: var(--danger);
		color: var(--accent-text);
	}
</style>
