<script lang="ts">
	import Icon from './Icon.svelte';
	import { navigateWithArrows } from './keyboardNav';
	import {
		shortcuts,
		SHORTCUT_DEFS,
		persistShortcuts,
		resetShortcuts,
		resetShortcut,
		eventToShortcutString,
		recordingState
	} from './shortcuts.svelte';
	import type { CommandId } from './shortcuts.svelte';
	import { t } from './i18n.svelte';

	let { onClose }: { onClose: () => void } = $props();

	let recordingId = $state<CommandId | null>(null);
	let bodyEl = $state<HTMLDivElement | null>(null);

	function startRecording(id: CommandId) {
		recordingId = id;
		recordingState.active = true;
	}

	function stopRecording() {
		recordingId = null;
		recordingState.active = false;
	}

	function conflictFor(id: CommandId): string | null {
		const value = shortcuts[id];
		const other = SHORTCUT_DEFS.find((d) => d.id !== id && shortcuts[d.id] === value);
		return other ? t(other.labelKey) : null;
	}

	/** Captura globalmente enquanto grava, para pegar a combinação mesmo que
	 *  o foco não esteja no botão (ex.: o usuário clicou e já solta o mouse). */
	function onWindowKeydown(e: KeyboardEvent) {
		if (recordingId === null) {
			if (e.key === 'Escape') onClose();
			else if (bodyEl) navigateWithArrows(e, bodyEl, '.shortcut-btn');
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (e.key === 'Escape') {
			stopRecording();
			return;
		}
		// Ainda não formou um atalho — só um modificador foi pressionado.
		if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

		shortcuts[recordingId] = eventToShortcutString(e);
		persistShortcuts();
		stopRecording();
	}

	$effect(() => {
		return () => {
			recordingState.active = false;
		};
	});

	$effect(() => {
		bodyEl?.querySelector<HTMLElement>('.shortcut-btn')?.focus();
	});

	// `.dialog` abaixo tem um onkeydown vazio só para satisfazer o linter de
	// acessibilidade — de propósito, sem stopPropagation: o keydown precisa
	// borbulhar até o <svelte:window> para a gravação de atalho funcionar.
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="overlay" role="presentation" onclick={onClose} onkeydown={onWindowKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={t('shortcuts.title')}
		onclick={(e) => e.stopPropagation()}
		onkeydown={() => {}}
	>
		<div class="header">
			<h2><Icon name="keyboard" size={18} /> {t('shortcuts.title')}</h2>
			<button class="close" onclick={onClose} title={t('shortcuts.close')}>
				<Icon name="close" size={16} />
			</button>
		</div>

		<div class="body" bind:this={bodyEl}>
			{#each SHORTCUT_DEFS as def (def.id)}
				{@const conflict = conflictFor(def.id)}
				<div class="row">
					<div class="row-label">
						<span>{t(def.labelKey)}</span>
						{#if conflict}
							<span class="conflict-note">{t('shortcuts.alsoUsedIn', { label: conflict })}</span>
						{/if}
					</div>
					<div class="shortcut-controls">
						<button
							class="shortcut-btn"
							class:recording={recordingId === def.id}
							class:conflict={conflict !== null}
							onclick={() => startRecording(def.id)}
						>
							{recordingId === def.id ? t('shortcuts.pressKey') : shortcuts[def.id]}
						</button>
						<button class="icon-btn" onclick={() => resetShortcut(def.id)} title={t('shortcuts.restoreDefault')}>
							<Icon name="restore" size={14} />
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div class="footer">
			<button class="reset" onclick={resetShortcuts}>{t('shortcuts.restoreAll')}</button>
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
		padding: 8px 20px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px 12px;
		padding: 9px 0;
		border-bottom: 1px solid var(--border);
	}

	.row:last-child {
		border-bottom: none;
	}

	.row-label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 13px;
		color: var(--text);
		min-width: 0;
	}

	.conflict-note {
		font-size: 11px;
		color: var(--danger);
	}

	.shortcut-controls {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.shortcut-btn {
		min-width: 128px;
		text-align: center;
		font-family:
			ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 12px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
	}

	.shortcut-btn:hover {
		background: var(--hover);
	}

	.shortcut-btn.recording {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--hover);
	}

	.shortcut-btn.conflict {
		border-color: var(--danger);
	}

	.icon-btn {
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

	.icon-btn:hover {
		background: var(--hover);
		color: var(--text);
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
