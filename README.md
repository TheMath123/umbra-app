# Umbra

Leitor e editor de Markdown leve, rápido e moderno para Windows, construído com Tauri + Svelte.

- Abra uma pasta (pelo menu de contexto do Explorer ou pelo botão "Abrir pasta…") e navegue pela árvore de arquivos markdown, imagem e PDF.
- Edição contínua estilo Typora/Obsidian: o texto aparece sempre formatado (negrito, títulos, tabelas, imagens...); a sintaxe crua só aparece na linha onde está o cursor.
- Cada arquivo abre em uma aba — arraste para reordenar, arraste para fora da janela para destacar em uma nova.
- Menu **"..."** no canto superior direito: temas, configurações de aparência e atalhos de teclado personalizáveis.

## Temas

O app vem com temas prontos e aceita temas customizados via um arquivo `.json` simples — veja [THEMES.md](THEMES.md) para o formato e como criar o seu.

## Idiomas

Disponível em Português (Brasil) e English, com detecção automática do idioma do sistema. Contribuir com uma tradução nova é editar um arquivo `.json` — veja [I18N.md](I18N.md).

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Stack

- [Tauri 2](https://tauri.app/) (Rust + WebView2) — shell nativo leve, baixo consumo de RAM/CPU.
- [Svelte 5](https://svelte.dev/) — UI reativa e enxuta.
- [CodeMirror 6](https://codemirror.net/) — editor de texto com a árvore de sintaxe markdown ([@lezer/markdown](https://github.com/lezer-parser/markdown)) usada para a edição em live preview.
- [@material-design-icons/svg](https://github.com/marella/material-design-icons) — ícones SVG individuais, sem fonte de ícones inteira.
