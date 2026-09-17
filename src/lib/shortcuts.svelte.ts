export type CommandId =
	| 'toggleHelp'
	| 'toggleSidebar'
	| 'zoomIn'
	| 'zoomOut'
	| 'zoomReset'
	| 'nextTab'
	| 'prevTab'
	| 'closeTab';

export interface ShortcutDef {
	id: CommandId;
	label: string;
	default: string;
}

/** Ordem em que aparecem no modal de configuração. */
export const SHORTCUT_DEFS: ShortcutDef[] = [
	{ id: 'toggleHelp', label: 'Abrir ajuda', default: '?' },
	{ id: 'toggleSidebar', label: 'Fixar/ocultar barra lateral', default: 'Ctrl+B' },
	{ id: 'nextTab', label: 'Próxima aba', default: 'Ctrl+Tab' },
	{ id: 'prevTab', label: 'Aba anterior', default: 'Ctrl+Shift+Tab' },
	{ id: 'closeTab', label: 'Fechar aba', default: 'Ctrl+W' },
	{ id: 'zoomIn', label: 'Aumentar zoom', default: 'Ctrl+=' },
	{ id: 'zoomOut', label: 'Diminuir zoom', default: 'Ctrl+-' },
	{ id: 'zoomReset', label: 'Restaurar zoom', default: 'Ctrl+0' }
];

const DEFAULT_SHORTCUTS = Object.fromEntries(SHORTCUT_DEFS.map((d) => [d.id, d.default])) as Record<
	CommandId,
	string
>;

const STORAGE_KEY = 'mdreader.shortcuts';

function load(): Record<CommandId, string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
	} catch {
		// localStorage indisponível ou dado corrompido — segue com os padrões.
	}
	return { ...DEFAULT_SHORTCUTS };
}

export const shortcuts = $state<Record<CommandId, string>>(load());

/** true enquanto o modal de atalhos espera o usuário pressionar uma
 *  combinação — o handler global de teclado do app deve ignorar tudo
 *  nesse meio-tempo, para não disparar a ação antiga enquanto o usuário
 *  tenta gravar uma nova. */
export const recordingState = $state({ active: false });

export function persistShortcuts() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
	} catch {
		// não é crítico persistir — a sessão atual continua funcionando.
	}
}

export function resetShortcuts() {
	Object.assign(shortcuts, DEFAULT_SHORTCUTS);
	persistShortcuts();
}

export function resetShortcut(id: CommandId) {
	const def = SHORTCUT_DEFS.find((d) => d.id === id);
	if (def) {
		shortcuts[id] = def.default;
		persistShortcuts();
	}
}

/** Normaliza um KeyboardEvent para a mesma representação usada nos atalhos
 *  configurados (ex.: "Ctrl+B", "Ctrl+Shift+Tab", "?"). Modificadores só
 *  entram explicitamente quando mudam o significado do atalho — Shift não
 *  é listado para teclas como "?" ou "+", que já resultam do próprio Shift
 *  no layout do teclado. */
export function eventToShortcutString(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
	const key = e.key;
	const isPlainSymbol = key.length === 1 && !/[a-zA-Z0-9]/.test(key);
	if (e.shiftKey && !isPlainSymbol) parts.push('Shift');
	if (e.altKey) parts.push('Alt');

	let keyLabel = key;
	if (key === ' ') keyLabel = 'Space';
	else if (key.length === 1) keyLabel = key.toUpperCase();

	parts.push(keyLabel);
	return parts.join('+');
}

export function matchesShortcut(e: KeyboardEvent, id: CommandId): boolean {
	return eventToShortcutString(e) === shortcuts[id];
}
