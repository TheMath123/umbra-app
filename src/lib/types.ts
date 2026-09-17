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
	path: string;
	kind: FileKind;
	/** Conteúdo textual do arquivo — só carregado/usado para markdown. */
	content: string;
	/** Zoom da leitura/edição, só usado (e persistido) para markdown — cada
	 *  aba guarda o seu. Imagem usa seu próprio "encaixe" interno; PDF usa o
	 *  zoom do visualizador nativo. */
	zoom: number;
}
