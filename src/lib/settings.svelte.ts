import { findTheme } from './themes.svelte';

export type FontChoice = 'system' | 'serif' | 'mono' | 'custom';
export type ContentWidth = 'narrow' | 'normal' | 'wide' | 'full' | 'custom';
export type LineHeightChoice = 'compact' | 'normal' | 'relaxed';
export type SidebarModePref = 'fixed' | 'auto';

export interface AppSettings {
	/** "system" segue o SO (entre os temas Claro/Escuro padrão); qualquer
	 *  outro valor é o id de um ThemeDef (embutido extra ou customizado). */
	themeId: string;
	fontFamily: FontChoice;
	/** Usada quando `fontFamily` é "custom" — uma font-family CSS qualquer,
	 *  ex.: "'Fira Code', monospace". */
	customFontFamily: string;
	fontSize: number;
	contentWidth: ContentWidth;
	/** Usada quando `contentWidth` é "custom", em pixels. */
	customContentWidthPx: number;
	lineHeight: LineHeightChoice;
	sidebarMode: SidebarModePref;
	/** Opacidade do fundo da janela (0-100). 100 = opaco (padrão, sem efeito
	 *  algum); valores menores deixam a janela translúcida. */
	windowOpacity: number;
}

export const FONT_STACKS: Record<Exclude<FontChoice, 'custom'>, string> = {
	system: `-apple-system, 'Segoe UI', Inter, Roboto, sans-serif`,
	serif: `Georgia, 'Iowan Old Style', 'Times New Roman', serif`,
	mono: `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`
};

export const CONTENT_WIDTHS: Record<Exclude<ContentWidth, 'custom'>, string> = {
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
	customFontFamily: '',
	fontSize: 15,
	contentWidth: 'normal',
	customContentWidthPx: 780,
	lineHeight: 'normal',
	sidebarMode: 'fixed',
	windowOpacity: 100
};

/** Fonte e largura de conteúdo efetivas — o tema ativo pode definir as
 *  suas próprias (ver `ThemeDef.typography` em themes.svelte.ts) e nesse
 *  caso elas têm prioridade sobre a escolha em Configurações. */
export function effectiveFontFamily(): string {
	const theme = findTheme(settings.themeId);
	if (theme?.typography?.fontFamily) return theme.typography.fontFamily;
	if (settings.fontFamily === 'custom') return settings.customFontFamily.trim() || FONT_STACKS.system;
	return FONT_STACKS[settings.fontFamily];
}

export function effectiveContentWidth(): string {
	const theme = findTheme(settings.themeId);
	if (theme?.typography?.contentWidth) return theme.typography.contentWidth;
	if (settings.contentWidth === 'custom') return `${Math.max(320, settings.customContentWidthPx)}px`;
	return CONTENT_WIDTHS[settings.contentWidth];
}

export function effectiveFontSize(): number {
	return findTheme(settings.themeId)?.typography?.fontSize ?? settings.fontSize;
}

export function effectiveLineHeight(): number {
	const theme = findTheme(settings.themeId);
	return theme?.typography?.lineHeight ?? LINE_HEIGHTS[settings.lineHeight];
}

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
