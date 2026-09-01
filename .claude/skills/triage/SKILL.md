---
name: triage
description: "Transforma uma ideia solta ou um bug num item bem-formado ANTES de virar spec ou ticket: classifica (bug/enhancement), VERIFICA a alegação no código e no banco, grelha se precisar, e escreve um 'brief' pronto para agente em docs/briefs/. Use SEMPRE que o usuário chegar com uma ideia crua, um pedido vago ou um relato de bug e quiser transformá-lo num item claro e acionável. É a boca do funil de planejamento — o brief resultante alimenta a grill-with-docs/to-spec ou a to-tickets."
license: MIT
---

# triage — ideia crua → item bem-formado (boca do funil)

Adaptação da skill `triage` do Matt Pocock (MIT) para o **Claude Code neste repositório**. Você chega com uma ideia solta ou um bug; a skill classifica, **verifica de verdade**, grelha se preciso e produz um **brief bem-formado** em `docs/briefs/`, que segue para a `grill-with-docs`/`to-spec` (se precisar de design) ou direto para a `to-tickets` (se já estiver claro). Formatos em `AGENT-BRIEF.md` e `OUT-OF-SCOPE.md`; crédito em `ATTRIBUTION.md`.

## O que este ambiente muda

Aqui você **tem o repositório, o shell e o MCP do Supabase (read-only)**. Isso não é um detalhe: é a diferença entre triar por raciocínio e triar por evidência.

- **Leia o código** antes de opinar. `Grep`/`Glob`/`Read` são mais baratos que uma pergunta ao usuário.
- **Rode o que dá para rodar**: `npm run build` (é `tsc -b` + vite) e `npm run lint`.
- **Consulte o banco real** pelo MCP do Supabase quando a alegação for sobre dados, schema ou policies. O `schema.sql` pode estar atrás do que está aplicado — o banco é a fonte da verdade.
- **Não existe test runner neste projeto.** Não prometa "cobrir com teste"; ver "Como se verifica aqui" abaixo.

## Papéis (roles)

Todo item recebe **uma categoria** e **um estado**.

**Categoria:**
- `bug`: algo está quebrado.
- `enhancement`: nova funcionalidade ou melhoria.

**Estado:**
- `needs-info`: falta informação de quem relatou para prosseguir.
- `ready-for-agent`: totalmente especificado, pronto para um agente implementar (o brief é o contrato).
- `ready-for-human`: precisa de implementação humana (decisão de design, acesso externo, julgamento, teste manual).
- `wontfix`: não será feito.

Se os estados conflitarem, sinalize e pergunte ao usuário antes de qualquer coisa.

## Processo

### 1. Reúna o contexto
Comece pela conversa e por qualquer coisa que o usuário referenciar — e então **vá ao código**. Localize as páginas, funções e tabelas envolvidas. Cheque a consistência entre o que o usuário descreveu e o que o repositório realmente faz; divergência aí costuma ser o achado mais valioso da triagem.

### 2. Recomende
Diga sua recomendação de **categoria + estado**, com o raciocínio e um resumo curto do que entendeu. Cite o que você já verificou. Espere a direção do usuário.

### 3. Verifique a alegação
Antes de grelhar, veja se a alegação se sustenta. **Aqui você verifica de fato — não presuma.**

- **Bug:** reproduza. Leia o caminho de código, rode o build, consulte os dados que alimentam o comportamento. Se conseguir reproduzir, diga como. Se não conseguir, diga o que tentou — "não reproduzi" é um resultado, desde que você mostre o caminho. Passos de reprodução ausentes ou insuficientes continuam sendo forte sinal de `needs-info`, mas só depois de você tentar sozinho.
- **Enhancement:** confira no código se aquilo já não existe ou já está coberto. Redundância descoberta agora economiza um ciclo inteiro.

**Nunca afirme ter reproduzido algo que você não rodou.** Se a verificação depende de interação no navegador ou de um aparelho, diga isso explicitamente e marque como pendente de verificação manual.

### 4. Grelhe (se precisar)
Se o pedido precisa ganhar forma, rode uma ou duas rodadas no formato de interrogatório — pergunta numerada com resposta recomendada:

```
❓ **Q1** — **<título>**: <pergunta, com opções se fizer sentido>

➡️ <sua resposta recomendada>
```

**Achar fatos é seu trabalho, não do usuário.** Se a pergunta é respondível pelo repositório ou pelo banco, responda você mesmo e traga o fato em vez da pergunta. Reserve as perguntas para o que só o usuário decide.

Para algo mais complexo, use a `grill-with-docs` (que já vai construindo glossário e ADRs).

### 5. Aplique o desfecho
- **`ready-for-agent`** ou **`ready-for-human`** → escreva um **Agent Brief** (formato em `AGENT-BRIEF.md`) em `docs/briefs/<slug>.md`. Para `ready-for-human`, acrescente **por que não dá para delegar** (decisão de design, acesso externo, julgamento, teste manual).
- **`needs-info`** → escreva as **Notas de Triagem** (template abaixo) no mesmo caminho: o que já foi estabelecido + o que ainda falta.
- **`wontfix`** →
  - **Já implementado/coberto**: aponte onde já existe, com link para o arquivo; **não** escreva no out-of-scope (essa base é só para pedidos *rejeitados*).
  - **Rejeitado (enhancement)**: opcionalmente registre em `docs/OUT-OF-SCOPE.md` (formato em `OUT-OF-SCOPE.md`) para o pedido não voltar como novo depois.
  - **Rejeitado (bug)**: dê uma explicação breve e encerre.

## Como se verifica aqui

Este projeto **não tem test runner** (ver CLAUDE.md). Critério de aceite que diga "adicionar teste unitário" é inexequível. O que existe:

- `npm run build` — `tsc -b` mais o build de produção. Pega erro de tipo e de compilação.
- `npm run lint` — ESLint.
- **Verificação manual no navegador** — para comportamento de UI. Escreva os passos exatos no brief.
- **Consulta ao banco pelo MCP** — para alegação sobre dados, schema, RLS ou storage.
- **Scripts em `scripts/`** — rodam em dry-run por padrão; servem para verificar estado de storage sem alterar nada.

Escreva critérios de aceite em cima dessas costuras, não de uma suíte que não existe.

## Contexto deste projeto

- **Vocabulário e UI em português.** Preserve `clientes`, `vendas`, `crediário`, `parcelas`, `fornecedores` — em identificadores e em texto de tela.
- **Sem camada de serviço.** As páginas chamam `supabase.from(...)` direto. Mudança de dados costuma ser mudança dentro de uma página grande, não numa abstração compartilhada.
- **Migrations:** arquivo `migration_*.sql` na raiz **e** atualização do `schema.sql`, que é o canônico. Aplicação é manual no painel — o MCP é read-only.
- **`main` faz deploy em produção**, num app que uma pessoa real usa para trabalhar. Brief que toca produção precisa dizer o que acontece se der errado.

## Atalho de estado
Se o usuário disser direto "marca isso como ready-for-agent", confie: confirme o que você vai fazer (categoria, estado, brief) e faça. Pule o interrogatório. Se for para `ready-for-agent` sem ter grelhado, pergunte se ele quer que você escreva o brief.

## Saída (o que segue no funil)
Salve o brief (ou as notas) em `docs/briefs/<slug>.md` e informe o caminho como link clicável. Esse é o item bem-formado que entra na `grill-with-docs`/`to-spec` (se precisar de design) ou na `to-tickets` (se já estiver claro).

## Template — Notas de Triagem (needs-info)

```markdown
## Notas de Triagem

**O que já estabelecemos:**

- ponto 1
- ponto 2

**O que eu já verifiquei:**

- o que você leu, rodou ou consultou, e o que isso mostrou

**O que ainda precisamos de você:**

- pergunta 1
- pergunta 2
```

Capture no "o que já estabelecemos" tudo que foi resolvido no interrogatório, para o trabalho não se perder. As perguntas precisam ser específicas e acionáveis — nada de "por favor, dê mais informações", e nada que você mesmo conseguiria descobrir no repositório.

## Não faça
- Não pergunte ao usuário o que o repositório ou o banco respondem.
- Não afirme ter reproduzido um bug que você não rodou; diga o que tentou.
- Não escreva critério de aceite baseado em suíte de testes — ela não existe aqui.
- Não escreva um brief vago: sem categoria, sem critérios de aceite, sem fronteira de escopo, ele não serve (ver `AGENT-BRIEF.md`).
- Não aplique migration nem altere produção durante a triagem — triagem descreve, não executa.
