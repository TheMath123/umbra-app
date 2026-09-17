# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primário: o próprio criador (Matheus), usando o app para ler e editar arquivos markdown locais — campanhas de RPG de mesa (organizadas em pastas, incluindo material exportado do Notion, com nomes de arquivo hasheados e links URL-encoded), documentação técnica de projetos e notas pessoais.

Secundário (confirmado): pessoas que criam e compartilham temas de cor customizados para o app — o formato de tema (JSON de 9 variáveis, documentado em THEMES.md) foi desenhado explicitamente para isso.

*[Inferido, não confirmado por entrevista]:* possível público mais amplo de usuários de Windows que queiram uma alternativa mais leve ao Obsidian/Typora/VSCode para ler e editar markdown — a intenção de multiplataforma (ver Operating Context) e o cuidado com documentação/formato de temas sugerem isso, mas não foi confirmado como objetivo declarado do produto.

## Product Purpose

Leitor e editor de markdown leve, rápido e moderno, pensado para abrir diretamente uma pasta do sistema de arquivos (via integração com o menu de contexto do Explorer do Windows) e navegar/editar os arquivos `.md` dela como numa árvore de projeto — sem exigir um "vault" fechado ou importação prévia.

Sucesso = abrir uma pasta cheia de markdown e conseguir ler tudo já formatado, editar com fricção mínima (estilo Typora/Obsidian: a sintaxe só aparece onde o cursor está) e navegar rapidamente entre arquivos, tudo com baixo consumo de RAM/CPU.

## Positioning

Mecanismo que um vizinho direto não copia com a mesma verdade:

- **Contra Obsidian/Notion:** sem vault, sem conta, sem importação — abre a pasta que já existe no disco, do jeito que ela já está (inclusive material exportado de outras ferramentas, como Notion).
- **Contra VSCode/Electron em geral:** shell nativo via Tauri (Rust + WebView2 do próprio Windows) em vez de um Chromium embutido — footprint de RAM/CPU bem menor para a tarefa específica de ler/editar markdown.
- **Contra editores markdown "split-view" (crus + preview lado a lado):** edição contínua em um único documento (CodeMirror com decorações), não duas visões sincronizadas.

## Operating Context

- Fluxo real de uso testado: pasta de campanha de RPG de mesa exportada do Notion (`RPG_Singularity`), com dezenas de arquivos `.md`, imagens e PDFs organizados em subpastas, nomes de arquivo com sufixo hash do Notion, e links internos com `href` URL-encoded (`%20`, `%E2%80%9C`...) — o app precisa decodificar esses links para navegar corretamente entre arquivos.
- Abertura tipicamente iniciada pelo menu de contexto do Explorer do Windows sobre uma pasta (ou arquivo `.md`, usando o diretório-pai).
- Múltiplas janelas do app podem coexistir (abas destacadas em janelas próprias), cada uma apontando para a mesma pasta-raiz ou arquivo.
- Multiplataforma é uma **intenção real, não só possibilidade técnica do Tauri** — decisões que dependam de comportamento específico do Windows (ex.: a integração com o menu de contexto do Explorer) devem ser tratadas como aditivas, não como premissa que quebra o app em outros SOs.

## Capabilities and Constraints

- Árvore de arquivos recursiva filtrando por tipos suportados: markdown, imagem (png/jpg/jpeg/gif/webp/svg/bmp/ico), PDF. Pastas totalmente vazias aparecem (para permitir organizar antes de povoar); pastas com conteúdo não suportado ficam ocultas.
- Edição "live preview" contínua (não split-view, não bloco-a-bloco): CodeMirror 6 com decorações via `@lezer/markdown`, escondendo marcadores (`**`, `#`, `` ` ``, `[]()`, `---`) fora da linha/nó com o cursor. Suporta GFM (tabelas renderizadas como HTML real, task list, riscado, autolink).
- Abas por arquivo aberto: reordenar por arrastar, destacar em nova `WebviewWindow` do Tauri ao arrastar para fora da janela.
- Visualizadores dedicados para imagem (zoom de encaixe automático) e PDF (viewer nativo do WebView2, sem controles duplicados).
- Gerenciamento de arquivos pela árvore: criar pasta/arquivo, renomear, mover (drag and drop), excluir (vai para a lixeira do sistema, não apagamento permanente).
- Sistema de temas: 9 variáveis de cor (`bg`, `surface`, `border`, `text`, `textMuted`, `hover`, `accent`, `accentText`, `danger`) cobrindo toda a interface; temas embutidos + import/export de tema customizado via JSON; formato documentado em `THEMES.md`.
- Atalhos de teclado totalmente personalizáveis (gravação de combinação, detecção de conflito, reset individual/geral); navegação completa por teclado (setas, Enter, Espaço) é requisito confirmado do produto, não só de um comando — cobre menus, listas de seleção, grupos de opção, abas e árvore de arquivos.
- Restrição confirmada: qualquer novo componente interativo (lista, menu, grupo de opções) deve sair já navegável por teclado (seta para mover o foco, Enter/Espaço para confirmar), seguindo o padrão ARIA correspondente (`menu`/`listbox`/`toolbar`/`tree`).
- Exportação (arquivo atual ou pasta inteira) para Markdown, Texto, HTML, Word (.docx) e PDF, acessível pelo menu "...": Markdown/Texto/HTML/DOCX rodam localmente (mesmo parser do live preview, sem serviço externo); PDF usa o diálogo de impressão nativo do Windows ("Salvar como PDF"), por isso só está disponível por arquivo, não em lote para a pasta inteira. Exportar em Markdown para uma pasta copia junto as imagens e PDFs referenciados; os demais formatos já embutem a imagem no próprio arquivo convertido.
- Integração com o Explorer do Windows (opt-in, em Configurações → Integração com o Windows): menu de contexto "Abrir com Umbra" em pastas, e associação do Umbra à lista "Abrir com" do Windows para arquivos `.md` (marcar como padrão continua sendo uma ação do próprio usuário nas Configurações do Windows — o Windows não permite que um app se defina como padrão sozinho). Tudo em `HKEY_CURRENT_USER`, por usuário, sem exigir administrador, e reversível pelo mesmo toggle. Abrir um `.md` associado abre o app já naquele arquivo, não só na pasta.
- Barra de status discreta na base da área de conteúdo (ao lado da sidebar): linha atual, total de linhas e de caracteres do documento markdown ativo (mais o total selecionado, quando há seleção), e os controles de zoom integrados do outro lado — sem chrome próprio, seguindo a mesma superfície fixa da barra.
- Barra de título customizada (sem decoração nativa do Windows): faixa própria no topo com o botão "...", minimizar, maximizar/restaurar e fechar, arrastável e com duplo-clique para maximizar — mesmo tratamento na janela principal e nas abas destacadas em nova janela.
- Interface em Português (Brasil) e English, com detecção automática do idioma do sistema e seletor em Configurações. Formato de tradução comunitário — um arquivo `.json` de "chave": "texto" por idioma, documentado em `I18N.md`, seguindo o mesmo espírito de THEMES.md (extensível sem plugin system, sem exigir saber programar). Mensagens de erro vindas do backend Rust e nomes de temas embutidos ficam de fora desta primeira leva, por enquanto.
- Terminologia do produto: "tema" (paleta de cores completa do app, não só claro/escuro), "aba" (arquivo aberto), "pasta raiz"/"repositório" (diretório aberto na barra lateral).

## Brand Commitments

- Nome: **Umbra** (antes "MD Reader" — renomeado em 2026-09-17; pesquisa de nomes concluiu que "MD Reader"/variações óbvias de roxo e espaço já eram usadas por outros apps de markdown/notas, ver histórico da conversa).
- Identificador de bundle: `com.matheuspa.umbra`.
- Ícone: eclipse — disco escuro cobrindo um halo em degradê roxo→índigo (`#d8b4fe → #a855f7 → #4f46e5`), sobre fundo quase preto, remetendo ao nome (umbra = sombra mais escura de um eclipse) e à paleta de cor do app (tema Bearded Black & Amethyst). Fonte em `src-tauri/icons/icon-source.svg`.
- Licença: MIT.

## Evidence on Hand

- Aplicação funcional e testada em uso real (não protótipo): pasta de campanha de RPG (`RPG_Singularity`) com material exportado do Notion, usada para validar árvore de arquivos, live preview, tabelas, links, imagens e PDFs.
- Sem testemunhos, casos de uso de terceiros, imprensa ou benchmarks formais — não fabricar nenhum desses até haver evidência real.
- Sem repositório remoto configurado no momento deste registro (`git remote` vazio) — projeto local, versionado localmente.

## Product Principles

1. **Leve de verdade, não só "mais leve que Electron":** toda decisão de arquitetura (Tauri, CodeMirror com decorações em vez de re-render de HTML, protocolo de assets do Tauri para mídia) existe para manter RAM/CPU baixos mesmo com pastas grandes.
2. **O arquivo no disco é a fonte da verdade:** sem formato proprietário, sem vault, sem banco de dados — o app lê e escreve exatamente o markdown que já está na pasta do usuário, incluindo o que foi gerado por outras ferramentas.
3. **Fricção mínima na edição:** a sintaxe nunca deve "atrapalhar" a leitura; ela só aparece onde a pessoa está efetivamente editando.
4. **Extensível sem plugin system:** tanto temas quanto atalhos são customizáveis via um formato simples (JSON, documentado), sem exigir infraestrutura de plugins para a comunidade contribuir.
5. **Teclado como cidadão de primeira classe:** qualquer fluxo que funciona no mouse precisa funcionar por teclado, com foco visível e navegação previsível.

## Accessibility & Inclusion

Requisito confirmado do produto (não apenas boa prática): navegação completa por teclado em toda a interface — setas entre itens de uma lista/menu/grupo, Enter/Espaço para confirmar, foco inicial já posicionado no item relevante (ex.: tema atualmente selecionado) ao abrir um modal. Esse padrão deve ser mantido em qualquer superfície nova.
