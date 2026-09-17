/**
 * Sistema de temas do MD Reader.
 *
 * Um tema é só um objeto com um punhado de cores — veja `ThemeColors`.
 * O formato de arquivo (para importar/exportar/compartilhar) está
 * documentado em THEMES.md, na raiz do projeto.
 */

export interface ThemeColors {
	/** Fundo principal (janela, painéis). */
	bg: string;
	/** Fundo de elementos "elevados": barra de abas, código, cabeçalhos de tabela. */
	surface: string;
	/** Bordas e divisórias. */
	border: string;
	/** Texto principal. */
	text: string;
	/** Texto secundário (rótulos, dicas, marcadores de sintaxe discretos). */
	textMuted: string;
	/** Fundo de hover em itens interativos. */
	hover: string;
	/** Cor de destaque: links, botões primários, aba ativa, seleção. */
	accent: string;
	/** Texto sobre a cor de destaque (geralmente branco ou preto). */
	accentText: string;
	/** Ações destrutivas e avisos (excluir, conflitos). */
	danger: string;
}

export interface ThemeDef {
	/** Identificador estável — usado para persistir a escolha do usuário. */
	id: string;
	/** Nome exibido no seletor. */
	name: string;
	colors: ThemeColors;
}

export const THEME_COLOR_KEYS = [
	'bg',
	'surface',
	'border',
	'text',
	'textMuted',
	'hover',
	'accent',
	'accentText',
	'danger'
] as const satisfies readonly (keyof ThemeColors)[];

const CSS_VAR_NAMES: Record<keyof ThemeColors, string> = {
	bg: '--bg',
	surface: '--surface',
	border: '--border',
	text: '--text',
	textMuted: '--text-muted',
	hover: '--hover',
	accent: '--accent',
	accentText: '--accent-text',
	danger: '--danger'
};

/** Os dois temas de sempre — também servem de base para o modo "Sistema"
 *  (o CSS estático do app já sabe alternar entre eles pelo SO). */
export const LIGHT_THEME: ThemeDef = {
	id: 'light',
	name: 'Claro',
	colors: {
		bg: '#ffffff',
		surface: '#f4f4f5',
		border: '#e2e2e5',
		text: '#1a1a1e',
		textMuted: '#6b6b70',
		hover: '#ececef',
		accent: '#4f46e5',
		accentText: '#ffffff',
		danger: '#dc2626'
	}
};

export const DARK_THEME: ThemeDef = {
	id: 'dark',
	name: 'Escuro',
	colors: {
		bg: '#1e1e22',
		surface: '#29292e',
		border: '#38383e',
		text: '#eaeaec',
		textMuted: '#9a9aa0',
		hover: '#333338',
		accent: '#6366f1',
		accentText: '#ffffff',
		danger: '#f87171'
	}
};

/** Alguns temas extras de exemplo — e para dar variedade de cara. */
export const BUILTIN_THEMES: ThemeDef[] = [
	{
		id: 'nord',
		name: 'Nord',
		colors: {
			bg: '#2e3440',
			surface: '#3b4252',
			border: '#434c5e',
			text: '#eceff4',
			textMuted: '#a9b2c3',
			hover: '#434c5e',
			accent: '#88c0d0',
			accentText: '#2e3440',
			danger: '#bf616a'
		}
	},
	{
		id: 'dracula',
		name: 'Dracula',
		colors: {
			bg: '#282a36',
			surface: '#343746',
			border: '#44475a',
			text: '#f8f8f2',
			textMuted: '#9ea0b0',
			hover: '#44475a',
			accent: '#bd93f9',
			accentText: '#282a36',
			danger: '#ff5555'
		}
	},
	{
		id: 'solarized-dark',
		name: 'Solarized Dark',
		colors: {
			bg: '#002b36',
			surface: '#073642',
			border: '#0d5164',
			text: '#eee8d5',
			textMuted: '#93a1a1',
			hover: '#0d5164',
			accent: '#268bd2',
			accentText: '#002b36',
			danger: '#dc322f'
		}
	},
	{
		id: 'sepia',
		name: 'Sépia',
		colors: {
			bg: '#f4ecd8',
			surface: '#ebe0c8',
			border: '#d8c9a3',
			text: '#433422',
			textMuted: '#7a6a52',
			hover: '#e2d5ae',
			accent: '#a0522d',
			accentText: '#ffffff',
			danger: '#b03a2e'
		}
	},
	{
		// Baseado nas cores reais do Bearded Theme (bg, roxo e vermelho vêm
		// direto do código-fonte oficial: github.com/BeardedBear/bearded-theme).
		id: 'bearded-black-amethyst',
		name: 'Bearded — Black & Amethyst',
		colors: {
			bg: '#111418',
			surface: '#1a1e24',
			border: '#262b33',
			text: '#e4e6ea',
			textMuted: '#8b8f99',
			hover: '#20242c',
			accent: '#a85ff1',
			accentText: '#ffffff',
			danger: '#e35535'
		}
	}
];

const CUSTOM_THEMES_KEY = 'mdreader.customThemes';

function loadCustomThemes(): ThemeDef[] {
	try {
		const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		// dado corrompido ou localStorage indisponível — começa vazio.
	}
	return [];
}

export const customThemes = $state<ThemeDef[]>(loadCustomThemes());

function persistCustomThemes() {
	try {
		localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
	} catch {
		// não é crítico persistir.
	}
}

export function allThemes(): ThemeDef[] {
	return [LIGHT_THEME, DARK_THEME, ...BUILTIN_THEMES, ...customThemes];
}

export function findTheme(id: string): ThemeDef | undefined {
	return allThemes().find((t) => t.id === id);
}

export function isCustomTheme(id: string): boolean {
	return customThemes.some((t) => t.id === id);
}

/** `key`/`params` são a chave de tradução (ver `i18n.svelte.ts`) e seus
 *  parâmetros — quem exibe o erro (ThemeModal) é quem chama `t()`, para o
 *  texto respeitar o idioma ativo no momento em que aparece na tela. */
export class ThemeValidationError extends Error {
	key: string;
	params?: Record<string, string>;
	constructor(key: string, params?: Record<string, string>) {
		super(key);
		this.key = key;
		this.params = params;
	}
}

/** Aceita o JSON de um arquivo de tema (ver THEMES.md) e devolve um
 *  ThemeDef válido, ou lança ThemeValidationError explicando o problema. */
export function parseThemeJson(raw: string): ThemeDef {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new ThemeValidationError('themes.errorNotJson');
	}
	if (typeof data !== 'object' || data === null) {
		throw new ThemeValidationError('themes.errorMustBeObject');
	}
	const obj = data as Record<string, unknown>;
	if (typeof obj.name !== 'string' || obj.name.trim() === '') {
		throw new ThemeValidationError('themes.errorMissingName');
	}
	if (typeof obj.colors !== 'object' || obj.colors === null) {
		throw new ThemeValidationError('themes.errorMissingColors');
	}
	const colorsIn = obj.colors as Record<string, unknown>;
	const colors = {} as ThemeColors;
	for (const key of THEME_COLOR_KEYS) {
		const value = colorsIn[key];
		if (typeof value !== 'string' || value.trim() === '') {
			throw new ThemeValidationError('themes.errorMissingColor', { key });
		}
		colors[key] = value;
	}
	const id =
		typeof obj.id === 'string' && obj.id.trim() !== ''
			? obj.id
			: `custom-${obj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
	return { id, name: obj.name, colors };
}

export function themeToJson(theme: ThemeDef): string {
	// Sem o `id` de propósito: um tema exportado para compartilhar deve
	// ganhar um id novo (do nome) quando outra pessoa importar, em vez de
	// arriscar colidir com o id de quem o criou.
	return JSON.stringify({ name: theme.name, colors: theme.colors }, null, 2);
}

export function addCustomTheme(theme: ThemeDef) {
	const index = customThemes.findIndex((t) => t.id === theme.id);
	if (index === -1) customThemes.push(theme);
	else customThemes[index] = theme;
	persistCustomThemes();
}

export function removeCustomTheme(id: string) {
	const index = customThemes.findIndex((t) => t.id === id);
	if (index !== -1) customThemes.splice(index, 1);
	persistCustomThemes();
}

/** Aplica (ou remove) overrides de cor diretamente no :root. Os temas
 *  "system" e os dois embutidos padrão (light/dark) não passam por aqui —
 *  eles já têm regras CSS estáticas próprias; qualquer outro tema
 *  (embutido extra ou customizado) sobrescreve essas variáveis via JS. */
export function applyThemeOverride(theme: ThemeDef | null) {
	const root = document.documentElement.style;
	if (!theme) {
		for (const key of THEME_COLOR_KEYS) root.removeProperty(CSS_VAR_NAMES[key]);
		return;
	}
	for (const key of THEME_COLOR_KEYS) {
		root.setProperty(CSS_VAR_NAMES[key], theme.colors[key]);
	}
}
