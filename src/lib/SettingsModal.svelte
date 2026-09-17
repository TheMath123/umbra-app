<script lang="ts">
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import { settings, persistSettings, resetSettings } from './settings.svelte';
	import type { FontChoice, ContentWidth, LineHeightChoice, SidebarModePref } from './settings.svelte';

	let { onClose, onOpenThemes }: { onClose: () => void; onOpenThemes: () => void } = $props();

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

	const fontOptions: { value: FontChoice; label: string }[] = [
		{ value: 'system', label: 'Padrão' },
		{ value: 'serif', label: 'Serifada' },
		{ value: 'mono', label: 'Monoespaçada' }
	];

	const widthOptions: { value: ContentWidth; label: string }[] = [
		{ value: 'narrow', label: 'Estreita' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'wide', label: 'Larga' },
		{ value: 'full', label: 'Tela cheia' }
	];

	const lineHeightOptions: { value: LineHeightChoice; label: string }[] = [
		{ value: 'compact', label: 'Compacto' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'relaxed', label: 'Relaxado' }
	];

	const sidebarOptions: { value: SidebarModePref; label: string }[] = [
		{ value: 'fixed', label: 'Sempre fixa' },
		{ value: 'auto', label: 'Ocultar automaticamente' }
	];
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onclick={onClose} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Configurações"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="header">
			<h2><Icon name="settings" size={18} /> Configurações</h2>
			<button class="close" onclick={onClose} title="Fechar (Esc)">
				<Icon name="close" size={16} />
			</button>
		</div>

		<div class="body">
			<section>
				<h3><Icon name="palette" size={15} /> Aparência</h3>

				<div class="row">
					<span class="row-label">Tema</span>
					<button class="theme-link" onclick={openThemes}>Escolher tema…</button>
				</div>

				<div class="row">
					<span class="row-label"><Icon name="text-format" size={14} /> Fonte do texto</span>
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
					<span class="row-label"><Icon name="format-size" size={14} /> Tamanho da fonte</span>
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
					<span class="row-label">Largura do conteúdo</span>
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
					<span class="row-label">Espaçamento entre linhas</span>
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
				<h3>Barra lateral</h3>
				<div class="row">
					<span class="row-label">Comportamento padrão</span>
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
		</div>

		<div class="footer">
			<button class="reset" onclick={resetSettings}>Restaurar padrões</button>
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
