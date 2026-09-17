/**
 * Linguagens suportadas nas caixas de código (```ts, ```py, ...) e a paleta
 * de cores do highlight de sintaxe. As cores aqui são fixas (claro/escuro),
 * não fazem parte das 9 variáveis de THEMES.md — são uma convenção universal
 * de editores de código, independente do tema visual do resto do app.
 */
import { LanguageDescription, LanguageSupport, StreamLanguage, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const codeLanguages: LanguageDescription[] = [
	LanguageDescription.of({
		name: 'typescript',
		alias: ['ts'],
		load: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true }))
	}),
	LanguageDescription.of({
		name: 'tsx',
		load: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true, jsx: true }))
	}),
	LanguageDescription.of({
		name: 'javascript',
		alias: ['js', 'mjs', 'cjs'],
		load: () => import('@codemirror/lang-javascript').then((m) => m.javascript())
	}),
	LanguageDescription.of({
		name: 'jsx',
		load: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true }))
	}),
	LanguageDescription.of({
		name: 'json',
		alias: ['json5'],
		load: () => import('@codemirror/lang-json').then((m) => m.json())
	}),
	LanguageDescription.of({
		name: 'python',
		alias: ['py'],
		load: () => import('@codemirror/lang-python').then((m) => m.python())
	}),
	LanguageDescription.of({
		name: 'rust',
		alias: ['rs'],
		load: () => import('@codemirror/lang-rust').then((m) => m.rust())
	}),
	LanguageDescription.of({
		name: 'css',
		load: () => import('@codemirror/lang-css').then((m) => m.css())
	}),
	LanguageDescription.of({
		name: 'html',
		alias: ['htm'],
		load: () => import('@codemirror/lang-html').then((m) => m.html())
	}),
	LanguageDescription.of({
		name: 'xml',
		alias: ['svg'],
		load: () => import('@codemirror/lang-xml').then((m) => m.xml())
	}),
	LanguageDescription.of({
		name: 'sql',
		load: () => import('@codemirror/lang-sql').then((m) => m.sql())
	}),
	LanguageDescription.of({
		name: 'yaml',
		alias: ['yml'],
		load: () => import('@codemirror/lang-yaml').then((m) => m.yaml())
	}),
	LanguageDescription.of({
		name: 'cpp',
		alias: ['c', 'c++', 'cc', 'h', 'hpp'],
		load: () => import('@codemirror/lang-cpp').then((m) => m.cpp())
	}),
	LanguageDescription.of({
		name: 'java',
		load: () => import('@codemirror/lang-java').then((m) => m.java())
	}),
	LanguageDescription.of({
		name: 'php',
		load: () => import('@codemirror/lang-php').then((m) => m.php())
	}),
	LanguageDescription.of({
		name: 'shell',
		alias: ['bash', 'sh', 'zsh', 'console'],
		load: () =>
			import('@codemirror/legacy-modes/mode/shell').then(
				(m) => new LanguageSupport(StreamLanguage.define(m.shell))
			)
	}),
	LanguageDescription.of({
		name: 'go',
		load: () =>
			import('@codemirror/legacy-modes/mode/go').then(
				(m) => new LanguageSupport(StreamLanguage.define(m.go))
			)
	}),
	LanguageDescription.of({
		name: 'ruby',
		alias: ['rb'],
		load: () =>
			import('@codemirror/legacy-modes/mode/ruby').then(
				(m) => new LanguageSupport(StreamLanguage.define(m.ruby))
			)
	}),
	LanguageDescription.of({
		name: 'toml',
		load: () =>
			import('@codemirror/legacy-modes/mode/toml').then(
				(m) => new LanguageSupport(StreamLanguage.define(m.toml))
			)
	})
];

// Paletas inspiradas em convenções bem conhecidas (One Dark / GitHub Light) —
// escolhidas por serem reconhecíveis, não por copiar uma marca específica.
const DARK_COLORS = {
	comment: '#7f848e',
	keyword: '#c678dd',
	string: '#98c379',
	number: '#d19a66',
	function: '#61afef',
	type: '#e5c07b',
	tag: '#e06c75',
	attribute: '#d19a66',
	invalid: '#f44747'
};

const LIGHT_COLORS = {
	comment: '#6a737d',
	keyword: '#d73a49',
	string: '#032f62',
	number: '#005cc5',
	function: '#6f42c1',
	type: '#22863a',
	tag: '#22863a',
	attribute: '#6f42c1',
	invalid: '#cc0000'
};

function buildHighlightStyle(colors: typeof DARK_COLORS) {
	return HighlightStyle.define([
		{ tag: t.comment, color: colors.comment, fontStyle: 'italic' },
		{ tag: t.lineComment, color: colors.comment, fontStyle: 'italic' },
		{ tag: t.blockComment, color: colors.comment, fontStyle: 'italic' },
		{ tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: colors.keyword },
		{ tag: [t.string, t.special(t.string), t.regexp], color: colors.string },
		{ tag: [t.number, t.bool, t.null, t.atom], color: colors.number },
		{ tag: [t.function(t.variableName), t.function(t.propertyName)], color: colors.function },
		{ tag: [t.typeName, t.className, t.namespace], color: colors.type },
		{ tag: [t.tagName], color: colors.tag },
		{ tag: [t.attributeName], color: colors.attribute },
		{ tag: t.invalid, color: colors.invalid }
	]);
}

const DARK_HIGHLIGHT = buildHighlightStyle(DARK_COLORS);
const LIGHT_HIGHLIGHT = buildHighlightStyle(LIGHT_COLORS);

export function highlightStyleFor(isDark: boolean): HighlightStyle {
	return isDark ? DARK_HIGHLIGHT : LIGHT_HIGHLIGHT;
}
