<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';

	let { path }: { path: string } = $props();

	// O visualizador de PDF nativo do WebView2/Chromium já tem sua própria
	// barra de ferramentas com zoom, busca, impressão e download — não
	// duplicamos esses controles por cima.
	let src = $derived(convertFileSrc(path));
	let name = $derived(path.split(/[\\/]/).pop() ?? path);
</script>

<iframe class="pdf-frame" title={name} {src}></iframe>

<style>
	.pdf-frame {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--surface);
	}
</style>
