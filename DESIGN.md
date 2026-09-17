---
name: MD Reader
description: Leitor e editor de markdown leve e nativo, com edição contínua estilo Typora/Obsidian
colors:
  bg: "#ffffff"
  surface: "#f4f4f5"
  border: "#e2e2e5"
  text: "#1a1a1e"
  text-muted: "#6b6b70"
  hover: "#ececef"
  accent: "#4f46e5"
  accent-text: "#ffffff"
  danger: "#dc2626"
typography:
  display:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "2em"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "1.5em"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "1.17em"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.04em"
  caption:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  control:
    fontFamily: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"
    fontSize: "0.9em"
    fontWeight: 400
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "6px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
  segmented-option-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.sm}"
  tree-row-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.sm}"
---

# Design System: MD Reader

## Overview

**Creative North Star: "The Focused Workbench"**

MD Reader é uma bancada de trabalho enxuta, não uma vitrine. A interface parte do princípio de que o documento markdown é o único protagonista: cromo é reduzido ao mínimo funcional, cor é usada apenas para dizer "isto está ativo, selecionado ou clicável", e qualquer controle que não seja necessário na maior parte do tempo (configurações, atalhos, temas, zoom) fica escondido atrás de um gatilho discreto até ser chamado. É a estética de um editor de código bem calibrado (VSCode, Sublime) aplicada à leitura e escrita de prosa, não a estética de um produto de marketing.

A superfície é quase inteiramente plana — divisórias são feitas com bordas de 1px, não com sombra — e ganha profundidade apenas quando algo literalmente flutua sobre o conteúdo (um modal, um menu de contexto, os controles de zoom). Isso não é ausência de acabamento; é a regra confirmada do sistema (ver **Elevação & Profundidade**). A tipografia segue o mesmo raciocínio: hierarquia vem de peso e tamanho, nunca de decoração, e o próprio corpo do texto pode ser inteiramente reconfigurado pelo usuário (fonte, tamanho, largura de coluna, espaçamento entre linhas) — o sistema visual existe para servir a leitura de quem está usando, não para impor uma identidade fixa de marca.

Rejeições confirmadas ao longo da sessão de construção: nada de edição "bloco a bloco" com inputs que se transformam (rejeitado explicitamente em favor de uma única superfície de edição contínua); nada de sombras em componentes fixos da interface; nada de botões com aparência nativa de SO ("cinza padrão") — todo botão visível é reestilizado para a paleta do tema, com raio de canto leve e discreto em vez de pill-shaped. Referências explícitas de mundo visual confirmadas pelo usuário: **Typora** para a contenção minimalista (pouco cromo, sombras quase inexistentes, foco total no texto) e **Zed** para a geometria quadradinha (raios pequenos e consistentes, sem nenhum componente pill — nem o badge de status, que era a única exceção e foi eliminada).

**Key Characteristics:**
- Plano por padrão; sombra é reservada para o que flutua sobre o conteúdo.
- Cor é funcional, não decorativa: a cor de destaque (indigo) só aparece em elementos ativos/selecionados/clicáveis.
- Hierarquia por peso e tamanho tipográfico, nunca por ornamento.
- Todo o sistema de cor é literalmente trocável em tempo real pelo usuário (temas) — os tokens abaixo descrevem o tema padrão, não uma paleta fixa.
- Navegação por teclado (setas, Enter, Espaço, foco visível) é parte do sistema visual, não um adendo de acessibilidade.

## Colors

A paleta é deliberadamente contida: nove papéis semânticos cobrem 100% da interface, e o app inteiro é reconstruído a partir deles quando o usuário troca de tema (ver `THEMES.md`). Os valores abaixo são o tema padrão ("Sistema" no modo claro); o mesmo papel muda de valor no modo escuro e em cada tema embutido ou customizado, mas nunca muda de função.

### Primary
- **Indigo Focus** (`#4f46e5`, `accent`): a única cor "quente" do sistema. Usada em links, aba ativa (barra inferior de 2px), item selecionado na árvore de arquivos, botão de ação primária, marcadores de lista/bullet no editor. Se um elemento não está ativo, selecionado ou é interativo, ele não recebe esta cor.

### Neutral
- **Paper White** (`#ffffff`, `bg`): fundo principal — janela, sidebar, corpo do editor.
- **Panel Gray** (`#f4f4f5`, `surface`): fundo de elementos "elevados sem sombra" — cabeçalho de tabela, bloco de código inline, badge de status.
- **Hairline Border** (`#e2e2e5`, `border`): toda divisória do app (sidebar, tabs, tabelas, modais) é feita com esta cor em 1px sólido — nunca sombra.
- **Ink** (`#1a1a1e`, `text`): texto principal.
- **Soft Ink** (`#6b6b70`, `textMuted`): texto secundário — rótulos, dicas, marcadores de sintaxe markdown quando revelados, texto de metadados.
- **Hover Wash** (`#ececef`, `hover`): fundo de qualquer item interativo em hover/foco (linha da árvore, botão fantasma, item de menu).

### Danger
- **Signal Red** (`#dc2626`, `danger`): exclusivo para ações destrutivas (excluir arquivo/tema) e conflitos de atalho. Nunca usado para ênfase comum.

### Named Rules
**The Single Accent Rule.** Existe exatamente uma cor de destaque ativa por vez. Ela nunca compete com uma segunda cor "de marca" — o sistema não tem secundária nem terciária fixas porque o próprio usuário pode redefinir o accent inteiro via tema.
**The Border-Not-Shadow Rule.** Separação entre superfícies fixas (não flutuantes) é sempre `1px solid var(--border)`, nunca `box-shadow`.

## Typography

**Display/Body Font:** `-apple-system, 'Segoe UI', Inter, Roboto, sans-serif` (padrão do sistema operacional; o usuário pode trocar por uma pilha serifada ou monoespaçada nas Configurações — a família não é uma decisão de marca fixa, é uma preferência de leitura).
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace` — código inline, blocos de código, task lists, atalhos de teclado (`<kbd>`).

**Character:** Sem serifa, sem personalidade tipográfica própria — a fonte do sistema operacional é a escolha padrão de propósito, para que o app pareça nativo em vez de "importado da web". Toda ênfase vem de peso (700) e escala, nunca de itálico decorativo ou tracking exagerado.

### Hierarchy
- **Display / H1** (700, `2em`, 1.3): título de nível 1 no documento renderizado.
- **Headline / H2** (700, `1.5em`, 1.3): título de nível 2.
- **Title / H3–H4** (700, `1.17em` / `1em`, 1.3): títulos de nível 3–4.
- **Body** (400, 15px por padrão — ajustável 12–22px nas Configurações, `line-height` 1.45/1.65/1.9 conforme preferência "Compacto/Normal/Relaxado"): corpo do documento markdown.
- **Label** (700, 11px, letter-spacing 0.04em, maiúsculas): cabeçalho da sidebar, cabeçalhos de seção em modais (ex. "Aparência", "Barra lateral").
- **Caption** (400, 12px): texto de apoio — descrições, dicas de rodapé, valores de slider, badge de status.
- **Control** (400, 13px): texto de controles interativos — itens de árvore, itens de menu, botões de texto, linhas de tabela de atalhos.
- **Mono / Code** (400, `0.9em`): código inline e em bloco, task lists, badges de atalho.

### Named Rules
**The Reader's Choice Rule.** Família tipográfica, tamanho, largura de coluna e espaçamento entre linhas do corpo do documento são propriedade do leitor, não do sistema — sempre expostos em Configurações, nunca hardcoded como "a fonte da marca".

## Layout

O app é de coluna dupla fixa: uma barra lateral de árvore de arquivos (`260px`) à esquerda, conteúdo flexível à direita. A barra lateral tem dois modos, escolhidos nas Configurações:
- **Fixa:** empurra o conteúdo, sempre visível, sem sombra (é uma superfície fixa).
- **Automática:** vira um overlay absoluto que desliza para fora (`transform: translateX(-100%)`, `transition: transform 0.18s ease`) e ganha sombra só enquanto está flutuando sobre o conteúdo (`0 2px 12px rgba(0,0,0,0.18)`); uma faixa de 10px na borda esquerda a traz de volta ao passar o mouse.

O conteúdo do documento é centralizado com uma largura máxima configurável (`narrow` 620px / `normal` 780px / `wide` 960px / `full` 100%) — a leitura de prosa longa nunca deve esticar até a borda da janela por padrão, mas o usuário pode escolher.

Um botão "..." (menu de mais opções) fica ancorado no canto superior direito da janela inteira (`position: absolute; top: 4px; right: 8px`), sobrepondo a barra de abas — um espaçador reserva 36px no início da topbar de conteúdo para não colidir com ele visualmente.

### Named Rules
**The Single Scroll Rule.** Nenhum contêiner tem dois eixos de scroll simultâneos nem scroll aninhado competindo pelo mesmo espaço — cada superfície rolável define `overflow-y: auto` com `overflow-x: hidden` explícito (nunca `visible` implícito, que o CSS converteria em uma segunda barra fantasma).

## Elevation & Depth

O sistema é flat em repouso. Sidebar, barra de abas, botões, linhas da árvore de arquivos, cabeçalhos de tabela — nada disso tem `box-shadow`; a separação entre eles é sempre uma borda de 1px (ver Colors → Named Rules). Sombra existe exclusivamente como sinal de que algo está flutuando por cima do conteúdo normal da página.

### Shadow Vocabulary
- **Overlay dim** (`background: rgba(0,0,0,0.4)` cobrindo a tela): pano de fundo por trás de qualquer modal.
- **Modal elevation** (`box-shadow: 0 8px 24px rgba(0,0,0,0.18)`): diálogos (Configurações, Temas, Atalhos, Ajuda). Deliberadamente mais discreta que uma sombra de card de marketing — o modal se anuncia, não "flutua com drama".
- **Context menu elevation** (`box-shadow: 0 6px 20px rgba(0,0,0,0.16)`): menu de clique direito da árvore.
- **Auto-hide sidebar elevation** (`box-shadow: 2px 0 10px rgba(0,0,0,0.14)`): só enquanto a sidebar automática está aberta sobre o conteúdo.

Os controles de zoom não têm sombra própria: vivem dentro da barra de status (ver Components → Barra de Status), uma superfície fixa, não flutuante.

### Named Rules
**The Floating-Only Shadow Rule.** Se um elemento está sempre presente no layout (não aparece/desaparece por cima de outra coisa), ele não tem sombra. Adicionar sombra a um botão, card ou linha de lista fixa é uma regressão visual, não um refinamento.

## Shapes

Geometria quadradinha, à la Zed: cantos são apenas levemente arredondados e crescem em passos pequenos com o "peso" do elemento. Não existe nenhum componente pill no sistema — nem o badge de status, convertido para a mesma escala dos demais.
- **3px** (`rounded.xs`): `<kbd>`, código inline.
- **4px** (`rounded.sm`): botões-ícone pequenos (fechar, editar, restaurar), botões de texto, controles segmentados, tema/swatch cards, imagens dentro do documento renderizado, badge de status.
- **6px** (`rounded.md`): menu de contexto.
- **8px** (`rounded.lg`): diálogos modais (a superfície "mais importante" da UI ganha o raio mais generoso, mas ainda contido).

Bordas são sempre 1px sólidas na cor `border`; não há bordas grossas, tracejadas ou coloridas fora do estado de destaque (`box-shadow: inset 0 0 0 2px var(--accent)` ao arrastar um item sobre uma pasta-alvo, ou `border-color: var(--accent)` num tema selecionado/ativo).

### Named Rules
**The Light Radius Rule.** Nenhum botão visível fica sem estilo próprio (chrome nativo do SO é sempre resetado com `border: none; background: none` e reconstruído) e nenhum elemento ganha raio pill — o raio cresce em passos pequenos (3→4→6→8px) conforme a hierarquia do elemento, nunca salta para totalmente arredondado.
**The No Pill Rule.** Confirmada explicitamente pelo usuário: zero componentes pill/cápsula em toda a interface, incluindo indicadores de status. Um raio pequeno e consistente substitui qualquer forma "totalmente redonda".

## Components

### Buttons
- **Shape:** 4px (ícone pequeno) a 6px (texto/ação), nunca pill.
- **Primary:** fundo `accent`, texto `accent-text`, usado só para a ação mais importante de uma tela vazia (ex. "Abrir pasta").
- **Ghost / Ícone:** sem borda, sem fundo em repouso; hover troca para `hover` (fundo) + `text` (cor do ícone, de `text-muted`). É o padrão dominante do app — a maioria dos botões (fechar modal, editar tema, ação da árvore) é ghost.
- **Segmentado (toggle group):** grupo com borda externa única de 1px, divisórias internas de 1px entre opções, opção ativa vira sólida (`accent` / `accent-text`). Usado em todo controle de "escolha entre 3–4 opções" (fonte, largura, espaçamento, comportamento da sidebar).

### Cards / Containers (Modais)
- **Corner Style:** 10px.
- **Background:** `bg`, borda `border` 1px.
- **Shadow Strategy:** ver Elevation & Depth → Modal elevation.
- **Internal Padding:** cabeçalho e rodapé em 16–20px horizontal / 12–16px vertical; corpo com scroll interno próprio (`overflow-y: auto; overflow-x: hidden`) quando o conteúdo excede a altura máxima (`calc(100vh - 64px)`).

### Lists / Rows (árvore de arquivos, seletor de temas, listas de atalhos)
- **Style:** linha de altura única, 4px de raio, sem borda em repouso; hover = fundo `hover`; selecionado/ativo = fundo `accent` sólido com texto `accent-text` (nunca apenas uma borda fina para indicar seleção).
- **Indentação:** a árvore de arquivos usa recuo de 14px por nível de profundidade, calculado via custom property (`--depth`).

### Tabs
- **Style:** altura fixa (36px), sem raio, divisória vertical de 1px entre abas; a aba ativa não muda de forma — ganha uma barra de 2px na cor `accent` colada na borda inferior, mais fundo `bg` (em vez de `surface`, destacando-a das abas inativas).
- **Overflow:** sem barra de rolagem visível (`scrollbar-width: none`); rolagem acontece por roda do mouse ou atalho, nunca por arrastar uma scrollbar.

### Editor / Documento (componente de assinatura)
A superfície de leitura/edição não distingue "modo visualização" de "modo edição": é sempre o mesmo documento, e a sintaxe markdown (`**`, `#`, `` ` ``, `[]()`, `---`) só fica visível na linha ou nó onde o cursor está — em qualquer outro lugar ela é ocultada e o resultado formatado (negrito, título, tabela real, imagem) é o que se vê. Links seguem a regra inversa do resto do app: clique simples navega, Ctrl/Cmd+clique edita (o cursor muda de "mão" para "texto" com o modificador pressionado).

### Status Badge (componente de assinatura)
Pequeno indicador (`4px`, fundo `surface`, borda `border`) ancorado no canto superior direito do editor, mostrando o estado de salvamento. Segue a mesma escala de raio de qualquer outro elemento pequeno do app — não há tratamento especial de forma.

### Barra de Título
Faixa de 36px no topo da janela (mesma altura das abas), substituindo a decoração nativa do Windows — arrastável em qualquer espaço vazio (clicar e segurar move a janela; duplo-clique maximiza/restaura). Reúne, numa linha só: o nome do repositório + ações da árvore (largura fixa, alinhada com a sidebar), as abas de arquivo abertas (preenchendo o espaço central) e, à direita, o botão "..." e os três controles de sistema (minimizar, maximizar/restaurar, fechar) — todos ghost, exceto o fechar, que no hover usa `danger` (não uma cor fixa do Windows), mantendo a superfície inteira trocável pelo sistema de temas.

### Barra de Status
Faixa fina (26px) na base da área de conteúdo, ao lado da sidebar — sem borda, sem fundo próprio, sem sombra: não é uma superfície separada, é texto discreto direto sobre o fundo da página (`bg`), a integração mais "sem chrome" do app. Texto em Caption (12px, `text-muted`), separadores discretos ("·") entre itens. À esquerda: linha atual, total de linhas e total de caracteres do documento markdown ativo — o número de caracteres selecionados aparece só quando há seleção, destacado na cor `accent`. À direita: os controles de zoom, igualmente sem chrome (só os três botões-fantasma). Some por completo quando a aba ativa é PDF (usa o zoom do visualizador nativo).

## Do's and Don'ts

### Do:
- **Do** usar borda de 1px (`var(--border)`) para separar qualquer superfície fixa da interface.
- **Do** reservar `box-shadow` só para o que literalmente flutua sobre o conteúdo (modal, menu de contexto, sidebar automática aberta).
- **Do** manter o raio de canto na escala 3/4/6/8px conforme a hierarquia do elemento — nunca pill.
- **Do** resetar completamente o chrome nativo de qualquer `<button>` (`border: none; background: none`) antes de aplicar o estilo do tema.
- **Do** expor variação de fonte, tamanho, largura de coluna e espaçamento do corpo do documento como preferência do usuário, não como decisão fixa de marca.
- **Do** dar a todo componente interativo novo (lista, menu, grupo de opções) navegação por setas + confirmação por Enter/Espaço, com foco inicial já no item relevante.

### Don't:
- **Don't** adicionar sombra a um componente que está sempre presente no layout (botão, linha de lista, sidebar fixa, aba).
- **Don't** usar uma segunda cor "de marca" fixa além do `accent` do tema ativo — o app não tem paleta secundária/terciária hardcoded.
- **Don't** reintroduzir edição "bloco a bloco" com inputs que substituem o texto renderizado — a edição é sempre contínua, na mesma superfície.
- **Don't** deixar dois eixos de scroll competindo no mesmo contêiner (sempre `overflow-x: hidden` explícito ao lado de `overflow-y: auto`).
- **Don't** usar itálico, tracking exagerado ou fontes decorativas para hierarquia — só peso e tamanho.
