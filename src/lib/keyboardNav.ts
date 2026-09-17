/**
 * Navegação por seta entre elementos focáveis dentro de um container —
 * o padrão ARIA de menu/listbox/toolbar. Use no `onkeydown` do container:
 *
 *   onkeydown={(e) => navigateWithArrows(e, containerEl, '[role="menuitem"]')}
 *
 * Cicla do último elemento de volta ao primeiro (e vice-versa). Home/End
 * vão direto para as pontas. `orientation: 'horizontal'` troca
 * ArrowDown/ArrowUp por ArrowRight/ArrowLeft (abas, grupos de opção).
 */
export function navigateWithArrows(
	e: KeyboardEvent,
	container: HTMLElement,
	selector: string,
	orientation: 'vertical' | 'horizontal' = 'vertical'
) {
	const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
	const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

	if (e.key !== nextKey && e.key !== prevKey && e.key !== 'Home' && e.key !== 'End') return;

	const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
	if (items.length === 0) return;

	e.preventDefault();
	const currentIndex = items.indexOf(document.activeElement as HTMLElement);

	if (e.key === 'Home') {
		items[0].focus();
	} else if (e.key === 'End') {
		items[items.length - 1].focus();
	} else if (e.key === nextKey) {
		items[(currentIndex + 1 + items.length) % items.length].focus();
	} else {
		items[(currentIndex - 1 + items.length) % items.length].focus();
	}
}
