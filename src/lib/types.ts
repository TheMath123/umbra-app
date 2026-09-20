export type FileKind = 'markdown' | 'image' | 'pdf';

export interface DirNode {
	name: string;
	path: string;
	isDir: boolean;
	kind: FileKind | null;
	children: DirNode[] | null;
}

/** Estatísticas do documento no editor — expostas pelo `MarkdownView`
 *  para a barra de status inferior. */
export interface DocStats {
	lines: number;
	currentLine: number;
	chars: number;
	selectedChars: number;
}

export interface Tab {
	/** Identidade estável da aba — nunca muda durante a vida da aba, mesmo
	 *  que `path` mude (arquivo renomeado/movido). É o que identifica a aba
	 *  pro Svelte (`{#each ... (tab.id)}`) e as referências de zoom de
	 *  imagem — usar `path` pra isso faria mover um arquivo destruir e
	 *  recriar o editor/visualizador (e travar a UI se várias abas afetadas
	 *  ao mesmo tempo, ex.: mover uma pasta inteira). */
	id: string;
	/** Caminho real no disco, ou um id sintético ("untitled:...") para abas
	 *  ainda não salvas — ver `untitled` abaixo e `scratchTabs.ts`. */
	path: string;
	kind: FileKind;
	/** Conteúdo textual do arquivo — só carregado/usado para markdown. */
	content: string;
	/** Zoom da leitura/edição, só usado (e persistido) para markdown — cada
	 *  aba guarda o seu. Imagem usa seu próprio "encaixe" interno; PDF usa o
	 *  zoom do visualizador nativo. */
	zoom: number;
	/** Aba "sem título": não existe em disco, o conteúdo vive só no
	 *  localStorage (ver scratchTabs.ts) até "Salvar como...". */
	untitled?: boolean;
}
