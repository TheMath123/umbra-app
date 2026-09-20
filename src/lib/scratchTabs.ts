/**
 * Persistência das abas "sem título" — arquivos ainda não salvos em disco.
 * O conteúdo fica só no localStorage (nunca vira arquivo de verdade) até a
 * pessoa escolher "Salvar como...". Fechar a aba sem salvar apaga a entrada
 * daqui pra sempre; enquanto ela ficar aberta, sobrevive a fechar e reabrir
 * o app inteiro.
 */

export interface ScratchTab {
	/** Mesmo valor usado como `Tab.path` — só um identificador, nunca um
	 *  caminho real no disco. */
	id: string;
	content: string;
}

const STORAGE_KEY = 'umbra.scratchTabs';

export function loadScratchTabs(): ScratchTab[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(t): t is ScratchTab => typeof t?.id === 'string' && typeof t?.content === 'string'
		);
	} catch {
		return [];
	}
}

export function persistScratchTabs(tabs: ScratchTab[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
	} catch {
		// não é crítico persistir — a sessão atual continua funcionando.
	}
}

export function nextUntitledId(): string {
	return `untitled:${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
