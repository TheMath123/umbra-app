<script lang="ts">
	import Icon from './Icon.svelte';
	import { shortcuts } from './shortcuts.svelte';
	import { t } from './i18n.svelte';
	import pkg from '../../package.json';

	let { onClose }: { onClose: () => void } = $props();

	// Os atalhos de teclado são lidos do estado configurável (Menu "..." →
	// Personalizar atalhos), então esta lista sempre reflete o que está
	// valendo de fato, mesmo se o usuário tiver mudado algo.
	let entries = $derived<{ keys: string; desc: string }[]>([
		{ keys: t('help.clickText'), desc: t('help.clickTextDesc') },
		{ keys: t('help.clickLink'), desc: t('help.clickLinkDesc') },
		{ keys: t('help.esc'), desc: t('help.escDesc') },
		{ keys: shortcuts.nextTab, desc: t('help.nextTabDesc') },
		{ keys: shortcuts.prevTab, desc: t('help.prevTabDesc') },
		{ keys: t('help.tabNumbers'), desc: t('help.tabNumbersDesc') },
		{ keys: shortcuts.closeTab, desc: t('help.closeTabDesc') },
		{ keys: t('help.dragTab'), desc: t('help.dragTabDesc') },
		{ keys: t('help.dragTabOut'), desc: t('help.dragTabOutDesc') },
		{ keys: `${shortcuts.zoomIn} / ${shortcuts.zoomOut}`, desc: t('help.zoomDesc') },
		{ keys: t('help.wheelZoom'), desc: t('help.wheelZoomDesc') },
		{ keys: shortcuts.zoomReset, desc: t('help.zoomResetDesc') },
		{ keys: shortcuts.toggleSidebar, desc: t('help.toggleSidebarDesc') },
		{ keys: t('help.rightClickTree'), desc: t('help.rightClickTreeDesc') },
		{ keys: shortcuts.toggleHelp, desc: t('help.toggleHelpDesc') }
	]);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onclick={onClose} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={t('help.title')}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="header">
			<h2>{t('help.title')}</h2>
			<button class="close" onclick={onClose} title={t('help.close')}><Icon name="close" size={16} /></button>
		</div>

		<p class="version">{t('help.version', { version: pkg.version })}</p>

		<table class="shortcuts">
			<tbody>
				{#each entries as s, i (i)}
					<tr>
						<td class="keys"><kbd>{s.keys}</kbd></td>
						<td class="desc">{s.desc}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="note">{t('help.moreComingSoon')}</p>
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
		overflow-y: auto;
		overflow-x: hidden;
		padding: 20px 24px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.header h2 {
		font-size: 16px;
		margin: 0;
	}

	.version {
		margin: -6px 0 12px;
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
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

	.shortcuts {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.shortcuts td {
		padding: 7px 0;
		border-bottom: 1px solid var(--border);
	}

	.shortcuts tr:last-child td {
		border-bottom: none;
	}

	.keys {
		white-space: nowrap;
		padding-right: 16px;
		width: 1%;
	}

	kbd {
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px 6px;
	}

	.desc {
		color: var(--text-muted);
	}

	.note {
		margin: 16px 0 0;
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
