<script lang="ts">
	import Icon from './Icon.svelte';

	let { onClose }: { onClose: () => void } = $props();

	const shortcuts: { keys: string; desc: string }[] = [
		{ keys: 'Clique no texto', desc: 'Edita o parágrafo, título ou item de lista clicado (estilo Typora)' },
		{ keys: 'Clique em link', desc: 'Abre no navegador (externo) ou navega até o arquivo (interno)' },
		{ keys: 'Esc', desc: 'Cancela a edição do bloco atual' },
		{ keys: 'Ctrl + Tab', desc: 'Vai para a próxima aba' },
		{ keys: 'Ctrl + Shift + Tab', desc: 'Vai para a aba anterior' },
		{ keys: 'Ctrl + 1 … 9', desc: 'Vai direto para a aba correspondente' },
		{ keys: 'Ctrl + W', desc: 'Fecha a aba atual' },
		{ keys: 'Arrastar aba', desc: 'Reordena as abas' },
		{ keys: 'Arrastar aba para fora', desc: 'Abre a aba em uma nova janela' },
		{ keys: 'Ctrl + / Ctrl -', desc: 'Aumenta ou diminui o zoom da visualização' },
		{ keys: 'Ctrl + roda do mouse', desc: 'Também ajusta o zoom' },
		{ keys: 'Ctrl + 0', desc: 'Restaura o zoom para 100%' },
		{ keys: 'Ctrl + B', desc: 'Fixa ou oculta automaticamente a barra lateral' },
		{
			keys: 'Clique direito na árvore',
			desc: 'Nova pasta, novo arquivo, renomear, excluir ou arrastar para mover'
		},
		{ keys: '?', desc: 'Abre esta janela de ajuda' }
	];

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
		aria-label="Ajuda e atalhos"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="header">
			<h2>Ajuda e atalhos</h2>
			<button class="close" onclick={onClose} title="Fechar (Esc)"><Icon name="close" size={16} /></button>
		</div>

		<table class="shortcuts">
			<tbody>
				{#each shortcuts as s (s.keys)}
					<tr>
						<td class="keys"><kbd>{s.keys}</kbd></td>
						<td class="desc">{s.desc}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="note">Mais documentação sobre o MD Reader chega por aqui em breve.</p>
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
		border-radius: 10px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
		width: min(440px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		overflow-y: auto;
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
