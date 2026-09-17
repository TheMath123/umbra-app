# Temas do Umbra

Um tema é um arquivo `.json` com um nome e nove cores. É isso — sem plugins,
sem build, sem CSS. Crie o seu, importe pelo menu **"..." → Tema → Importar
tema…**, e pronto: ele passa a valer em toda a interface (barra lateral,
abas, editor, tabelas, links, menus...).

## Formato

```json
{
	"name": "Meu Tema",
	"colors": {
		"bg": "#0d1117",
		"surface": "#161b22",
		"border": "#30363d",
		"text": "#c9d1d9",
		"textMuted": "#8b949e",
		"hover": "#21262d",
		"accent": "#58a6ff",
		"accentText": "#ffffff",
		"danger": "#f85149"
	}
}
```

Salve como `.json` (o nome do arquivo não importa) e importe pelo app.

## As nove cores

| Campo | Onde aparece |
|---|---|
| `bg` | Fundo principal — janela, painéis, modais |
| `surface` | Fundo "elevado" — barra de abas, blocos de código, cabeçalho de tabela |
| `border` | Bordas e divisórias entre painéis, abas, tabelas |
| `text` | Texto principal |
| `textMuted` | Texto secundário — dicas, rótulos, marcadores de sintaxe discretos (`**`, `` ` ``, `#`) quando o cursor não está ali |
| `hover` | Fundo ao passar o mouse sobre itens clicáveis |
| `accent` | Cor de destaque — links, aba ativa, botões primários, seleção |
| `accentText` | Texto sobre um fundo `accent` (geralmente branco ou preto puro) |
| `danger` | Ações destrutivas e avisos — excluir, conflitos de atalho |

Qualquer valor de cor CSS válido funciona: `#rrggbb`, `#rgb`, `rgb(...)`,
`hsl(...)` ou nomes de cor (`"crimson"`).

## Dicas para um tema legível

- Mantenha bastante contraste entre `bg`/`surface` e `text` (o app não
  verifica contraste automaticamente).
- `accent` também colore os marcadores de link e a aba ativa — evite uma cor
  muito parecida com `bg`.
- Se seu tema for escuro, ainda assim declare as nove cores normalmente; não
  há um campo separado de "modo claro/escuro" — cada tema é independente.

## Compartilhando um tema

No mesmo menu, o botão de download ao lado de cada tema (inclusive os que
você já importou) exporta o JSON pronto para distribuir. Quem receber o
arquivo só precisa importá-lo — o app atribui um novo identificador
automaticamente, então não há risco de colidir com o de quem criou.

## Editando um tema já importado

Reimporte um arquivo com o mesmo `id` (o campo aparece no JSON exportado)
para atualizá-lo no lugar, em vez de criar uma cópia nova.
