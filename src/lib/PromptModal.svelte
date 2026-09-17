<script lang="ts">
	import { untrack } from 'svelte';

	let {
		title,
		label,
		initialValue,
		confirmLabel = 'Confirmar',
		onConfirm,
		onCancel
	}: {
		title: string;
		label: string;
		initialValue: string;
		confirmLabel?: string;
		onConfirm: (value: string) => void;
		onCancel: () => void;
	} = $props();

	let value = $state(untrack(() => initialValue));
	let inputEl = $state<HTMLInputElement | null>(null);

	// Seleciona só o "nome" (sem a extensão) quando há um `.`, para renomear
	// ser rápido — como no Explorer/VSCode. Só deve rodar uma vez, ao montar
	// o input: ler `value` sem `untrack` faria o efeito rodar de novo a cada
	// tecla digitada, reselecionando o texto e "comendo" o próximo caractere.
	$effect(() => {
		if (!inputEl) return;
		inputEl.focus();
		const current = untrack(() => value);
		const dot = current.lastIndexOf('.');
		if (dot > 0) inputEl.setSelectionRange(0, dot);
		else inputEl.select();
	});

	function submit() {
		const trimmed = value.trim();
		if (trimmed) onConfirm(trimmed);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

<div class="overlay" role="presentation" onclick={onCancel} onkeydown={onKeydown}>
	<div
		class="dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={title}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<h2>{title}</h2>
		<label>
			{label}
			<input bind:value bind:this={inputEl} onkeydown={onKeydown} />
		</label>
		<div class="actions">
			<button class="secondary" onclick={onCancel}>Cancelar</button>
			<button class="primary" onclick={submit}>{confirmLabel}</button>
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
		width: min(380px, calc(100vw - 32px));
		padding: 20px 24px;
	}

	h2 {
		font-size: 15px;
		margin: 0 0 14px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}

	input {
		font-size: 14px;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 8px 10px;
		font-family: inherit;
	}

	input:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 18px;
	}

	.actions button {
		border-radius: 4px;
		padding: 7px 14px;
		font-size: 13px;
		cursor: pointer;
		border: 1px solid var(--border);
	}

	.secondary {
		background: var(--surface);
		color: var(--text);
	}

	.secondary:hover {
		background: var(--hover);
	}

	.primary {
		background: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	}
</style>
