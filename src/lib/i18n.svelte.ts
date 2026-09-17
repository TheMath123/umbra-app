/**
 * Sistema de idiomas (i18n) do MD Reader.
 *
 * Cada idioma é um arquivo JSON simples em `src/lib/locales/<código>.json`
 * — "chave": "texto", sem aninhamento. O formato (e como a comunidade
 * pode contribuir com um novo idioma) está documentado em `I18N.md`, na
 * raiz do projeto.
 */
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';

export type LocaleId = 'pt-BR' | 'en';

export interface LocaleDef {
	id: LocaleId;
	/** Nome do idioma no próprio idioma — como aparece no seletor. */
	name: string;
	strings: Record<string, string>;
}

export const LOCALES: Record<LocaleId, LocaleDef> = {
	'pt-BR': { id: 'pt-BR', name: 'Português (Brasil)', strings: ptBR },
	en: { id: 'en', name: 'English', strings: en }
};

export const LOCALE_LIST: LocaleDef[] = [LOCALES['pt-BR'], LOCALES.en];

/** Idioma de referência: se uma chave faltar numa tradução incompleta,
 *  cai aqui em vez de mostrar a chave crua ou um texto em branco. */
const FALLBACK: LocaleId = 'pt-BR';

function detectSystemLocale(): LocaleId {
	const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
	return lang.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

const STORAGE_KEY = 'mdreader.locale';

function loadLocale(): LocaleId {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && saved in LOCALES) return saved as LocaleId;
	} catch {
		// localStorage indisponível — segue para a detecção do sistema.
	}
	return detectSystemLocale();
}

/** Estado global único — qualquer componente que ler `i18n.locale` (direto
 *  ou indiretamente, via `t()`) reage à troca de idioma automaticamente. */
export const i18n = $state<{ locale: LocaleId }>({ locale: loadLocale() });

export function setLocale(id: LocaleId) {
	i18n.locale = id;
	try {
		localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// não é crítico persistir — a sessão atual continua no idioma escolhido.
	}
}

/** Troca `{placeholder}` no texto pelos valores de `params`. */
function interpolate(text: string, params?: Record<string, string | number>): string {
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

/** Traduz `key` para o idioma ativo, com fallback para `pt-BR` e, por
 *  último, para a própria chave (nunca deixa a interface em branco). */
export function t(key: string, params?: Record<string, string | number>): string {
	const current = LOCALES[i18n.locale]?.strings[key];
	const fallback = LOCALES[FALLBACK].strings[key];
	return interpolate(current ?? fallback ?? key, params);
}
