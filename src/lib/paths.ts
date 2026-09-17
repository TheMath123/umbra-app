import type { FileKind } from './types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const MARKDOWN_EXTENSIONS = ['md', 'markdown'];

/** Deduz o tipo de um arquivo pela extensão — mesma lógica do backend. */
export function kindForPath(path: string): FileKind | null {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown';
	if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
	if (ext === 'pdf') return 'pdf';
	return null;
}

/** Resolve um caminho relativo (de uma imagem ou link no markdown) contra
 *  o diretório do arquivo onde ele aparece. Não toca no disco — só
 *  normaliza `.`/`..`, funciona com `/` ou `\`.
 *
 *  Links/`src` de markdown costumam vir URL-encoded (`%20` para espaço,
 *  `%E2%80%9C` para aspas curvas etc. — o Notion faz isso sempre em suas
 *  exportações), mas nomes de arquivo no disco não são. Decodificamos
 *  cada segmento antes de juntar; se não for uma sequência válida,
 *  usamos o texto como veio. */
export function resolveRelativePath(baseFile: string, relative: string): string {
	const sep = baseFile.includes('\\') ? '\\' : '/';
	const baseParts = baseFile.split(/[\\/]/);
	baseParts.pop(); // remove o nome do arquivo, sobra o diretório

	for (const rawPart of relative.split(/[\\/]/)) {
		let part = rawPart;
		try {
			part = decodeURIComponent(rawPart);
		} catch {
			// não era URL-encoded (ou estava malformado) — usa como veio.
		}
		if (part === '' || part === '.') continue;
		if (part === '..') baseParts.pop();
		else baseParts.push(part);
	}
	return baseParts.join(sep);
}

/** Diretório pai de um caminho (não toca no disco, só string). */
export function parentDir(path: string): string {
	const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	return idx === -1 ? path : path.slice(0, idx);
}

/** Nome do arquivo/pasta no final do caminho. */
export function baseName(path: string): string {
	return path.split(/[\\/]/).pop() ?? path;
}

/** Junta um diretório e um nome, respeitando o separador já usado no `dir`. */
export function joinPath(dir: string, name: string): string {
	const sep = dir.includes('\\') ? '\\' : '/';
	return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

export function isExternalLink(href: string): boolean {
	return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

/** Gera um id estável e legível para um heading, para permitir `#âncoras`. */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-');
}
