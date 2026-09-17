export type FontChoice = 'system' | 'serif' | 'mono';
export type ContentWidth = 'narrow' | 'normal' | 'wide' | 'full';
export type LineHeightChoice = 'compact' | 'normal' | 'relaxed';
export type SidebarModePref = 'fixed' | 'auto';

export interface AppSettings {
	/** "system" segue o SO (entre os temas Claro/Escuro padrão); qualquer
	 *  outro valor é o id de um ThemeDef (embutido extra ou customizado). */
	themeId: string;
	fontFamily: FontChoice;
	fontSize: number;
	contentWidth: ContentWidth;
	lineHeight: LineHeightChoice;
	sidebarMode: SidebarModePref;
}

export const FONT_STACKS: Record<FontChoice, string> = {
	system: `-apple-system, 'Segoe UI', Inter, Roboto, sans-serif`,
	serif: `Georgia, 'Iowan Old Style', 'Times New Roman', serif`,
	mono: `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`
};

export const CONTENT_WIDTHS: Record<ContentWidth, string> = {
	narrow: '620px',
	normal: '780px',
	wide: '960px',
	full: '100%'
};

export const LINE_HEIGHTS: Record<LineHeightChoice, number> = {
	compact: 1.45,
	normal: 1.65,
	relaxed: 1.9
};

export const DEFAULT_SETTINGS: AppSettings = {
	themeId: 'system',
	fontFamily: 'system',
	fontSize: 15,
	contentWidth: 'normal',
	lineHeight: 'normal',
	sidebarMode: 'fixed'
};

const STORAGE_KEY = 'umbra.settings';

function load(): AppSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			// Migração: versões antigas guardavam "theme": 'light'|'dark'|'system'.
			if (parsed.themeId === undefined && typeof parsed.theme === 'string') {
				parsed.themeId = parsed.theme;
			}
			return { ...DEFAULT_SETTINGS, ...parsed };
		}
	} catch {
		// localStorage indisponível ou dado corrompido — segue com os padrões.
	}
	return { ...DEFAULT_SETTINGS };
}

/** Estado global único (singleton do módulo) — qualquer componente que
 *  importar `settings` lê/escreve o mesmo objeto reativo. */
export const settings = $state<AppSettings>(load());

export function persistSettings() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// não é crítico persistir — a sessão atual continua funcionando.
	}
}

export function resetSettings() {
	Object.assign(settings, DEFAULT_SETTINGS);
	persistSettings();
}
