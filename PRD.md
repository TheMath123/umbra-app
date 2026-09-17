# PRD — Próximas features (Umbra)

Registro das três demandas passadas em 2026-09-17, na ordem pedida. Sem necessidade de aprovação agora — implementação vem depois de testar as correções pendentes do editor.

---

## 1. Integração com o Explorer do Windows

**Status: já implementado**, em Configurações → "Integração com o Windows" (dois toggles independentes, `HKEY_CURRENT_USER`, reversíveis):
- Menu de contexto "Abrir com Umbra" ao clicar com o botão direito numa pasta (ou no fundo de uma pasta aberta).
- Associação de `.md` à lista "Abrir com" do Windows — abrir um arquivo associado já abre ele numa aba (não só a pasta).

**Decisão pendente:** confirmar se o comportamento atual (opt-in, o usuário liga manualmente em Configurações) atende, ou se a intenção é registrar automaticamente sem ação do usuário (ex.: no primeiro launch, ou só no instalador/build final). Se for a segunda opção, é um trabalho diferente do que já existe — registrar direto no instalador (NSIS) em vez de em runtime.

## 2. Barra de título customizada ("organic window") — implementado

**Objetivo:** remover a barra de título nativa do Windows; janela integrada ao design do app, com os três botões de sistema (minimizar, maximizar/restaurar, fechar) posicionados à direita do botão "...".

**Escopo (v1, janela principal):**
- `tauri.conf.json`: `decorations: false` na janela principal.
- Região de arrasto: um trecho do topo (provavelmente a faixa onde já fica o "...") vira `data-tauri-drag-region`, para a janela continuar arrastável e com duplo-clique maximizando/restaurando (comportamento padrão do Windows).
- Três botões novos (ícones: minimizar, maximizar/restaurar — alterna conforme o estado da janela —, fechar) usando a API de janela do Tauri (`getCurrentWindow().minimize()/toggleMaximize()/close()`), com o hover do botão fechar em vermelho (convenção do Windows 11) e dos outros dois discreto (mesma linguagem do resto do app — sem chrome, ghost button).
- Rastrear se a janela está maximizada (evento de resize/estado do Tauri) para trocar o ícone maximizar↔restaurar.

**Decisões pendentes:**
- Janelas de aba destacada e a janela de impressão (`WebviewWindow` criadas em runtime) recebem o mesmo tratamento, ou continuam com decoração nativa por simplicidade? Proposta: só a janela principal por agora, revisar depois.
- O app tem intenção multiplataforma confirmada (ver PRODUCT.md) — convenção de botões de sistema no Windows (minimizar/maximizar/fechar à direita) é diferente da do macOS (semáforo à esquerda). V1 é só Windows; adaptar para macOS fica para quando isso for testado de verdade numa Mac.

## 3. CI/CD de build e release — workflow pronto, falta o remoto

**Objetivo:** ao "criar uma versão" do app, o build do `.exe` roda sozinho e fica anexado àquela versão.

**Bloqueio real:** o projeto ainda não tem repositório remoto configurado (`git remote` vazio, confirmado em PRODUCT.md). CI/CD via GitHub Actions (o caminho mais direto — a própria Tauri mantém uma action oficial, `tauri-apps/tauri-action`, que builda e sobe o instalador direto num GitHub Release) exige o repositório estar hospedado lá. **Preciso saber onde o repositório vai morar antes de montar isso.**

**Proposta (assumindo GitHub):**
- Workflow do GitHub Actions disparado por push de tag `v*.*.*` (ex.: `v0.2.0`).
- Roda em `windows-latest`, usa `tauri-apps/tauri-action` para compilar e gerar o instalador NSIS (e o `.exe` cru de dentro do bundle).
- A própria action cria (ou atualiza) o GitHub Release correspondente à tag e anexa os artefatos — nenhum passo manual de upload.
- Versão vem de `tauri.conf.json`/`package.json` (já existe o campo `version`); "criar uma versão" = bump desse número + `git tag vX.Y.Z` + push da tag.

**Fora do escopo por agora:** assinatura de código (o `.exe` sem assinatura dispara aviso do SmartScreen no Windows — resolver isso exige certificado, é um passo à parte quando/se fizer sentido).
