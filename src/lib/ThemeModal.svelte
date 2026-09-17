<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { open, save } from '@tauri-apps/plugin-dialog';
	import { writeText } from '@tauri-apps/plugin-clipboard-manager';
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import { settings, persistSettings } from './settings.svelte';
	import {
		allThemes,
		isCustomTheme,
		addCustomTheme,
		removeCustomTheme,
		parseThemeJson,
		themeToJson,
		ThemeValidationError,
		type ThemeDef
	} from './themes.svelte';

	let { onClose }: { onClose: () => void } = $props();

	let error = $state<string | null>(null);
	let copied = $state(false);

	const THEME_TEMPLATE = JSON.stringify(
		{
			name: 'Meu Tema',
			colors: {
				bg: '#0d1117',
				surface: '#161b22',
				border: '#30363d',
				text: '#c9d1d9',
				textMuted: '#8b949e',
				hover: '#21262d',
				accent: '#58a6ff',
				accentText: '#ffffff',
				danger: '#f85149'
			}
		},
		null,
		2
	);

	async function copyTemplate() {
		try {
			await writeText(THEME_TEMPLATE);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			error = 'Não foi possível copiar — copie manualmente pelo THEMES.md.';
		}
	}

	function selectTheme(id: string) {
		settings.themeId = id;
		persistSettings();
		error = null;
	}

	async function importTheme() {
		error = null;
		const path = await open({ filters: [{ name: 'Tema do MD Reader', extensions: ['json'] }] });
		if (typeof path !== 'string') return;
		try {
			const raw = await invoke<string>('read_markdown_file', { path });
			const theme = parseThemeJson(raw);
			addCustomTheme(theme);
			selectTheme(theme.id);
		} catch (e) {
			error = e instanceof ThemeValidationError ? e.message : String(e);
		}
	}

	async function exportTheme(theme: ThemeDef, e: MouseEvent) {
		e.stopPropagation();
		const path = await save({
			defaultPath: `${theme.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
			filters: [{ name: 'Tema do MD Reader', extensions: ['json'] }]
		});
		if (!path) return;
		try {
			await invoke('write_markdown_file', { path, content: themeToJson(theme) });
		} catch (e2) {
			error = String(e2);
		}
	}

	function deleteTheme(id: string, e: MouseEvent) {
		e.stopPropagation();
		if (settings.themeId === id) selectTheme('system');
		removeCustomTheme(id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	let bodyEl = $state<HTMLDivElement | null>(null);

	function onBodyKeydown(e: KeyboardEvent) {
		if (bodyEl) navigateWithArrows(e, bodyEl, '[role="option"]');
	}

	// Abre com o foco já no tema atualmente selecionado, para dar para
	// navegar com as setas sem precisar de Tab antes.
	$effect(() => {
		bodyEl?.querySelector<HTMLElement>('[role="option"].active')?.focus();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onclick={onClose} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Temas"
		onclick={(e) => e.stopPropagation()}
		onkeydown={() => {}}
	>
		<div class="header">
			<h2><Icon name="palette" size={18} /> Temas</h2>
			<button class="close" onclick={onClose} title="Fechar (Esc)">
				<Icon name="close" size={16} />
			</button>
		</div>

		<div
			class="body"
			role="listbox"
			tabindex="-1"
			aria-label="Temas disponíveis"
			bind:this={bodyEl}
			onkeydown={onBodyKeydown}
		>
			{#if error}
				<div class="error">{error}</div>
			{/if}

			<div
				class="theme-card"
				role="option"
				aria-selected={settings.themeId === 'system'}
				tabindex="0"
				class:active={settings.themeId === 'system'}
				onclick={() => selectTheme('system')}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') selectTheme('system');
				}}
			>
				<span class="swatch-row system-swatch">
					<Icon name="settings" size={16} />
				</span>
				<span class="theme-name">Sistema</span>
				{#if settings.themeId === 'system'}<Icon name="check" size={16} />{/if}
			</div>

			{#each allThemes() as theme (theme.id)}
				<div
					class="theme-card"
					role="option"
					aria-selected={settings.themeId === theme.id}
					tabindex="0"
					class:active={settings.themeId === theme.id}
					onclick={() => selectTheme(theme.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') selectTheme(theme.id);
					}}
				>
					<span class="swatch-row" style="background: {theme.colors.bg};">
						<span class="swatch" style="background: {theme.colors.surface};"></span>
						<span class="swatch" style="background: {theme.colors.accent};"></span>
						<span class="swatch swatch-text" style="color: {theme.colors.text};">Aa</span>
					</span>
					<span class="theme-name">{theme.name}</span>
					<span class="theme-actions">
						{#if settings.themeId === theme.id}<Icon name="check" size={16} />{/if}
						<button class="icon-btn" title="Exportar tema" onclick={(e) => exportTheme(theme, e)}>
							<Icon name="download" size={14} />
						</button>
						{#if isCustomTheme(theme.id)}
							<button class="icon-btn danger" title="Excluir tema" onclick={(e) => deleteTheme(theme.id, e)}>
								<Icon name="delete-outline" size={14} />
							</button>
						{/if}
					</span>
				</div>
			{/each}
		</div>

		<div class="footer">
			<p class="note">Crie o seu tema: 9 cores em um JSON. Detalhes em <code>THEMES.md</code>.</p>
			<div class="footer-actions">
				<button class="import" onclick={copyTemplate}>
					<Icon name={copied ? 'check' : 'download'} size={15} />
					{copied ? 'Copiado!' : 'Copiar modelo'}
				</button>
				<button class="import" onclick={importTheme}>
					<Icon name="upload-file" size={15} /> Importar tema…
				</button>
			</div>
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
		width: min(500px, calc(100vw - 32px));
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
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.error {
		background: color-mix(in srgb, var(--danger) 15%, transparent);
		color: var(--danger);
		border-radius: 6px;
		padding: 8px 10px;
		font-size: 12px;
		margin-bottom: 4px;
	}

	.theme-card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		border: 1px solid transparent;
		background: none;
		border-radius: 4px;
		padding: 8px 12px;
		cursor: pointer;
		text-align: left;
	}

	.theme-card:hover {
		background: var(--hover);
	}

	.theme-card.active {
		border-color: var(--accent);
		background: var(--hover);
	}

	.swatch-row {
		display: flex;
		align-items: center;
		gap: 3px;
		width: 56px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 4px;
		border: 1px solid var(--border);
		padding: 4px;
		overflow: hidden;
	}

	.system-swatch {
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.swatch-text {
		width: auto;
		height: auto;
		font-size: 11px;
		font-weight: 700;
		border-radius: 0;
	}

	.theme-name {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.theme-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		color: var(--accent);
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-muted);
		padding: 5px;
		border-radius: 4px;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: var(--border);
		color: var(--text);
	}

	.icon-btn.danger:hover {
		color: var(--danger);
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px 12px;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.note {
		margin: 0;
		font-size: 11px;
		color: var(--text-muted);
		min-width: 160px;
	}

	.note code {
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
	}

	.footer-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.import {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 4px;
		padding: 7px 12px;
		font-size: 13px;
		cursor: pointer;
	}

	.import:hover {
		background: var(--hover);
	}
</style>
