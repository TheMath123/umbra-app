<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import { settings, persistSettings, resetSettings } from './settings.svelte';
	import type { FontChoice, ContentWidth, LineHeightChoice, SidebarModePref } from './settings.svelte';
	import { t, i18n, LOCALE_LIST, setLocale } from './i18n.svelte';

	let { onClose, onOpenThemes }: { onClose: () => void; onOpenThemes: () => void } = $props();

	interface IntegrationStatus {
		supported: boolean;
		contextMenu: boolean;
		fileAssociation: boolean;
	}

	let integration = $state<IntegrationStatus | null>(null);
	let integrationBusy = $state<'contextMenu' | 'fileAssociation' | null>(null);
	let integrationError = $state<string | null>(null);

	$effect(() => {
		invoke<IntegrationStatus>('get_integration_status')
			.then((s) => (integration = s))
			.catch(() => (integration = { supported: false, contextMenu: false, fileAssociation: false }));
	});

	async function toggleIntegration(key: 'contextMenu' | 'fileAssociation') {
		if (!integration || integrationBusy) return;
		const next = !integration[key];
		integrationBusy = key;
		integrationError = null;
		try {
			const command = key === 'contextMenu' ? 'set_context_menu_integration' : 'set_file_association';
			await invoke(command, { enabled: next });
			integration = { ...integration, [key]: next };
		} catch (e) {
			integrationError = String(e);
		} finally {
			integrationBusy = null;
		}
	}

	function onSegmentedKeydown(e: KeyboardEvent) {
		navigateWithArrows(e, e.currentTarget as HTMLElement, 'button', 'horizontal');
	}

	function set<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
		settings[key] = value;
		persistSettings();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function openThemes() {
		onClose();
		onOpenThemes();
	}

	let fontOptions = $derived<{ value: FontChoice; label: string }[]>([
		{ value: 'system', label: t('settings.fontSystem') },
		{ value: 'serif', label: t('settings.fontSerif') },
		{ value: 'mono', label: t('settings.fontMono') }
	]);

	let widthOptions = $derived<{ value: ContentWidth; label: string }[]>([
		{ value: 'narrow', label: t('settings.widthNarrow') },
		{ value: 'normal', label: t('settings.widthNormal') },
		{ value: 'wide', label: t('settings.widthWide') },
		{ value: 'full', label: t('settings.widthFull') }
	]);

	let lineHeightOptions = $derived<{ value: LineHeightChoice; label: string }[]>([
		{ value: 'compact', label: t('settings.lineHeightCompact') },
		{ value: 'normal', label: t('settings.lineHeightNormal') },
		{ value: 'relaxed', label: t('settings.lineHeightRelaxed') }
	]);

	let sidebarOptions = $derived<{ value: SidebarModePref; label: string }[]>([
		{ value: 'fixed', label: t('settings.sidebarFixed') },
		{ value: 'auto', label: t('settings.sidebarAuto') }
	]);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onclick={onClose} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={t('settings.title')}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="header">
			<h2><Icon name="settings" size={18} /> {t('settings.title')}</h2>
			<button class="close" onclick={onClose} title={t('settings.close')}>
				<Icon name="close" size={16} />
			</button>
		</div>

		<div class="body">
			<section>
				<h3><Icon name="language" size={15} /> {t('settings.language')}</h3>
				<div class="row">
					<span class="row-label">{t('settings.language')}</span>
					<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
						{#each LOCALE_LIST as loc (loc.id)}
							<button class:active={i18n.locale === loc.id} onclick={() => setLocale(loc.id)}>
								{loc.name}
							</button>
						{/each}
					</div>
				</div>
			</section>

			<section>
				<h3><Icon name="palette" size={15} /> {t('settings.appearance')}</h3>

				<div class="row">
					<span class="row-label">{t('settings.theme')}</span>
					<button class="theme-link" onclick={openThemes}>{t('settings.chooseTheme')}</button>
				</div>

				<div class="row">
					<span class="row-label"><Icon name="text-format" size={14} /> {t('settings.fontLabel')}</span>
					<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
						{#each fontOptions as opt (opt.value)}
							<button
								class:active={settings.fontFamily === opt.value}
								onclick={() => set('fontFamily', opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="row">
					<span class="row-label"><Icon name="format-size" size={14} /> {t('settings.fontSize')}</span>
					<div class="slider-row">
						<input
							type="range"
							min="12"
							max="22"
							step="1"
							value={settings.fontSize}
							oninput={(e) => set('fontSize', Number(e.currentTarget.value))}
						/>
						<span class="slider-value">{settings.fontSize}px</span>
					</div>
				</div>

				<div class="row">
					<span class="row-label">{t('settings.contentWidth')}</span>
					<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
						{#each widthOptions as opt (opt.value)}
							<button
								class:active={settings.contentWidth === opt.value}
								onclick={() => set('contentWidth', opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="row">
					<span class="row-label">{t('settings.lineHeight')}</span>
					<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
						{#each lineHeightOptions as opt (opt.value)}
							<button
								class:active={settings.lineHeight === opt.value}
								onclick={() => set('lineHeight', opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>
			</section>

			<section>
				<h3>{t('settings.sidebar')}</h3>
				<div class="row">
					<span class="row-label">{t('settings.sidebarBehavior')}</span>
					<div class="segmented" role="toolbar" tabindex="-1" onkeydown={onSegmentedKeydown}>
						{#each sidebarOptions as opt (opt.value)}
							<button
								class:active={settings.sidebarMode === opt.value}
								onclick={() => set('sidebarMode', opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>
			</section>

			{#if integration?.supported}
				<section>
					<h3><Icon name="desktop-windows" size={15} /> {t('settings.windowsIntegration')}</h3>

					{#if integrationError}
						<p class="integration-error">{integrationError}</p>
					{/if}

					<div class="row stacked">
						<span class="row-label">
							{t('settings.contextMenuLabel')}
							<span class="row-desc">{t('settings.contextMenuDesc')}</span>
						</span>
						<button
							class="toggle"
							class:active={integration.contextMenu}
							disabled={integrationBusy === 'contextMenu'}
							onclick={() => toggleIntegration('contextMenu')}
						>
							{t(integration.contextMenu ? 'settings.activated' : 'settings.activate')}
						</button>
					</div>

					<div class="row stacked">
						<span class="row-label">
							{t('settings.fileAssocLabel')}
							<span class="row-desc">{t('settings.fileAssocDesc')}</span>
						</span>
						<button
							class="toggle"
							class:active={integration.fileAssociation}
							disabled={integrationBusy === 'fileAssociation'}
							onclick={() => toggleIntegration('fileAssociation')}
						>
							{t(integration.fileAssociation ? 'settings.activated' : 'settings.activate')}
						</button>
					</div>
				</section>
			{/if}
		</div>

		<div class="footer">
			<button class="reset" onclick={resetSettings}>{t('settings.resetDefaults')}</button>
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
		width: min(460px, calc(100vw - 32px));
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

	.body {
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 20px 8px;
	}

	section {
		padding: 16px 0;
	}

	section + section {
		border-top: 1px solid var(--border);
	}

	section h3 {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin: 0 0 14px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		flex-wrap: wrap;
	}

	.row-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text);
	}

	.row.stacked {
		align-items: flex-start;
	}

	.row.stacked .row-label {
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		flex: 1;
		min-width: 0;
	}

	.row-desc {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.toggle {
		flex-shrink: 0;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		border-radius: 4px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
	}

	.toggle:hover:not(:disabled) {
		background: var(--hover);
	}

	.toggle.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.toggle:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.integration-error {
		background: color-mix(in srgb, var(--danger) 15%, transparent);
		color: var(--danger);
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 12px;
		margin: 0 0 10px;
	}

	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.segmented button {
		border: none;
		background: var(--surface);
		color: var(--text-muted);
		font-size: 12px;
		padding: 6px 11px;
		cursor: pointer;
		border-left: 1px solid var(--border);
	}

	.segmented button:first-child {
		border-left: none;
	}

	.segmented button:hover {
		background: var(--hover);
	}

	.segmented button.active {
		background: var(--accent);
		color: var(--accent-text);
	}

	.theme-link {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 4px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
	}

	.theme-link:hover {
		background: var(--hover);
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.slider-row input[type='range'] {
		width: 120px;
	}

	.slider-value {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		min-width: 32px;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.reset {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 4px;
		padding: 7px 14px;
		font-size: 13px;
		cursor: pointer;
	}

	.reset:hover {
		background: var(--hover);
	}
</style>
