# MD Reader

Leitor e editor de Markdown leve, rápido e moderno para Windows, construído com Tauri + Svelte.

- Abra uma pasta (pelo menu de contexto do Explorer ou pelo botão "Abrir pasta…") e navegue pela árvore de arquivos `.md`.
- Cada arquivo abre renderizado na área central.
- Dê duplo clique em um parágrafo, título ou item de lista para editar aquele trecho no markdown puro — ao sair da edição, ele volta a ser renderizado e é salvo automaticamente.

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
- [markdown-it](https://github.com/markdown-it/markdown-it) — parsing e renderização de Markdown.
