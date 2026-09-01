---
name: triage
description: "Transforma uma ideia solta ou um bug num item bem-formado ANTES de virar spec ou ticket: classifica (bug/enhancement), verifica a alegação, grelha se precisar, e escreve um 'brief' pronto para agente como arquivo Markdown. Use SEMPRE que o usuário chegar com uma ideia crua, um pedido vago ou um relato de bug e quiser transformá-lo num item claro e acionável. É a boca do funil de planejamento — o brief resultante alimenta a grill-with-docs/to-spec ou a to-tickets."
license: MIT
---

# triage — ideia crua → item bem-formado (boca do funil)

Adaptação da skill `triage` do Matt Pocock (MIT) para a **fase de planejamento no claude.ai**: **sem issue tracker, sem PRs, sem repositório**. Você chega com uma ideia solta ou um bug; a skill classifica, verifica, grelha se preciso e produz um **brief bem-formado** (arquivo Markdown) que segue para a `grill-with-docs`/`to-spec` (se precisar de design) ou direto para a `to-tickets` (se já estiver claro). Formatos preservados em `AGENT-BRIEF.md` e `OUT-OF-SCOPE.md`; crédito em `ATTRIBUTION.md`.

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
Trabalhe com o que está na conversa e com qualquer coisa que o usuário referenciar. Não há repositório para explorar aqui; se o usuário descrever comportamento/código existente, use isso e **cheque a consistência** com o que ele disse antes.

### 2. Recomende
Diga sua recomendação de **categoria + estado**, com o raciocínio, e um resumo curto do que entendeu do pedido. Espere a direção do usuário.

### 3. Verifique a alegação
Antes de grelhar, veja se a alegação se sustenta.
- **Bug:** raciocine sobre a reprodução a partir dos passos do relator. Se os passos faltam ou são insuficientes, isso é um forte sinal de `needs-info` — peça os passos. **Aqui você não roda código**: a reprodução real (rodar, testar) acontece depois no Claude Code; faça a checagem no nível do raciocínio e marque o que precisa de verificação em runtime.
- **Enhancement:** confira, pelo que o usuário descreveu, se aquilo já não existe/está coberto. Se puder pesquisar um fato relevante, pesquise.

### 4. Grelhe (se precisar)
Se o pedido precisa ganhar forma, rode uma ou duas rodadas no formato de interrogatório — pergunta numerada com resposta recomendada:

```
❓ **Q1** — **<título>**: <pergunta, com opções se fizer sentido>

➡️ <sua resposta recomendada>
```

Afie os termos conforme as respostas chegam. Para algo mais complexo, use a `grill-with-docs` (que já vai construindo glossário/ADRs).

### 5. Aplique o desfecho
- **`ready-for-agent`** ou **`ready-for-human`** → escreva um **Agent Brief** (formato em `AGENT-BRIEF.md`) como arquivo Markdown. Para `ready-for-human`, acrescente **por que não dá para delegar** (decisão de design, acesso externo, julgamento, teste manual).
- **`needs-info`** → escreva as **Notas de Triagem** (template abaixo): o que já foi estabelecido + o que ainda falta.
- **`wontfix`** →
  - **Já implementado/coberto**: aponte onde já existe; **não** escreva no out-of-scope (essa base é só para pedidos *rejeitados*).
  - **Rejeitado (enhancement)**: opcionalmente registre no out-of-scope (formato em `OUT-OF-SCOPE.md`) para o pedido não voltar como novo depois.
  - **Rejeitado (bug)**: dê uma explicação breve e encerre.

## Atalho de estado
Se o usuário disser direto "marca isso como ready-for-agent", confie: confirme o que você vai fazer (categoria, estado, brief) e faça. Pule o interrogatório. Se for para `ready-for-agent` sem ter grelhado, pergunte se ele quer que você escreva o brief.

## Saída (o que segue no funil)
Salve o brief (ou as notas) como arquivo Markdown e **apresente para download**. Esse é o item bem-formado que entra na `grill-with-docs`/`to-spec` (se precisar de design) ou na `to-tickets` (se já estiver claro).

## Template — Notas de Triagem (needs-info)

```markdown
## Notas de Triagem

**O que já estabelecemos:**

- ponto 1
- ponto 2

**O que ainda precisamos de você:**

- pergunta 1
- pergunta 2
```

Capture tudo que foi resolvido no interrogatório em "o que já estabelecemos", para o trabalho não se perder. As perguntas precisam ser específicas e acionáveis — nada de "por favor, dê mais informações".

## Não faça
- Não tente consultar/atualizar issue tracker nem lidar com PRs — aqui é planejamento, saída em arquivo local.
- Não afirme ter reproduzido um bug rodando código — você não roda aqui; marque o que precisa de verificação no Claude Code.
- Não escreva um brief vago: sem categoria, sem critérios de aceite, sem fronteira de escopo, ele não serve (ver `AGENT-BRIEF.md`).
