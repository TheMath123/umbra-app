<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';

	let { path, onZoomChange }: { path: string; onZoomChange?: (percent: number) => void } = $props();

	let src = $derived(convertFileSrc(path));
	let name = $derived(path.split(/[\\/]/).pop() ?? path);

	// A imagem nunca muda de tamanho real — só sua transformação. Isso deixa
	// o browser decodificar/rasterizar o bitmap uma única vez e compor o
	// zoom na GPU a cada frame, em vez de recalcular layout (reflow) a cada
	// tick da roda do mouse, que travava a janela em imagens grandes.
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);
	let containerEl = $state<HTMLDivElement | null>(null);

	// scale 1 = tamanho real (100%); fitScale = escala que encaixa a imagem
	// inteira na área visível — é o ponto de partida padrão e o valor do
	// "reset", como em qualquer visualizador de imagem.
	let scale = $state(1);
	let fitScale = $state(1);

	function computeFit() {
		if (!containerEl || !naturalWidth || !naturalHeight) return fitScale;
		const { clientWidth, clientHeight } = containerEl;
		if (!clientWidth || !clientHeight) return fitScale;
		return Math.min(clientWidth / naturalWidth, clientHeight / naturalHeight, 1);
	}

	function setScale(next: number) {
		scale = Math.min(Math.max(next, fitScale / 4), fitScale * 8);
		onZoomChange?.(Math.round((scale / fitScale) * 100));
	}

	function onLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		naturalWidth = img.naturalWidth;
		naturalHeight = img.naturalHeight;
		fitScale = computeFit();
		setScale(fitScale);
	}

	$effect(() => {
		if (!containerEl) return;
		// Recalcula o encaixe se a área visível mudar (sidebar, redimensionar
		// a janela) — só reajusta a escala se ainda estiver no zoom de
		// encaixe, para não atrapalhar um zoom manual do usuário.
		const observer = new ResizeObserver(() => {
			const wasAtFit = scale === fitScale;
			fitScale = computeFit();
			if (wasAtFit) setScale(fitScale);
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	export function zoomIn() {
		setScale(scale * 1.25);
	}
	export function zoomOut() {
		setScale(scale / 1.25);
	}
	export function zoomReset() {
		setScale(fitScale);
	}

	let hasSize = $derived(naturalWidth > 0 && naturalHeight > 0);
</script>

<div class="image-view" bind:this={containerEl}>
	<div
		class="spacer"
		style={hasSize ? `width:${naturalWidth * scale}px; height:${naturalHeight * scale}px;` : ''}
	>
		<img {src} alt={name} onload={onLoad} style="transform: scale({scale});" />
	</div>
</div>

<style>
	.image-view {
		height: 100%;
		overflow: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
	}

	.spacer {
		position: relative;
		flex-shrink: 0;
	}

	img {
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: top left;
	}
</style>
