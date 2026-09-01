---
name: grill-with-docs
description: "Uma entrevista implacável para afiar um plano ou design que, ao mesmo tempo, vai construindo os documentos do domínio — um glossário (CONTEXT.md) e ADRs (docs/adr/) — como arquivos no repositório. Use SEMPRE que o usuário quiser estressar o raciocínio de um projeto mais complexo e sair com a terminologia e as decisões registradas, tipicamente ANTES de gerar a spec. Gatilhos: 'me grelha com docs', 'interroga e vai documentando', 'quero sair com glossário e decisões', 'grill com documentação'."
license: MIT
---

# grill-with-docs — interrogar + documentar o domínio

Adaptação da skill `grill-with-docs` do Matt Pocock (MIT) para o **Claude Code neste repositório**. No original ela apenas **compõe** duas skills — `grilling` (o interrogatório) e `domain-modeling` (glossário + ADRs); aqui as duas estão reunidas numa só. Você é interrogado e, ao mesmo tempo, saem arquivos: `CONTEXT.md` (glossário) e `docs/adr/NNNN-slug.md` (decisões). Formatos em `CONTEXT-FORMAT.md`, `ADR-FORMAT.md` e `ATTRIBUTION.md`.

Rode **antes da `to-spec`** em projetos onde a terminologia e as decisões de arquitetura ainda estão fuzzy.

---

## Parte 1 — O interrogatório (motor `grilling`)

Interrogue o usuário implacavelmente até chegarem a um **entendimento compartilhado**. Mapeie isso como uma **árvore de decisões**: cada decisão se ramifica nas decisões que dependem dela.

Trabalhe a árvore em **rodadas**. A **fronteira** é toda decisão cujos pré-requisitos já estão resolvidos — as perguntas que dá para fazer **agora**, sem chutar respostas que você ainda não ouviu. Faça a fronteira inteira numa rodada só: numere cada pergunta e **dê sua resposta recomendada**. Depois espere as respostas do usuário antes da próxima rodada.

Formate uma rodada assim:

```
❓ **Q1** — **<título da pergunta>**: <corpo da pergunta, pode ter vários parágrafos e opções>

➡️ <sua resposta recomendada>

---

❓ **Q2** — **<título da pergunta>**: <corpo da pergunta, pode ter vários parágrafos e opções>

➡️ <sua resposta recomendada>
```

Cada rodada de respostas remodela a árvore: decisões resolvidas empurram a fronteira para fora e destravam perguntas que dependiam delas. Recalcule a fronteira e faça a próxima rodada. Uma pergunta cuja resposta depende de outra ainda aberta nesta rodada pertence a uma rodada **posterior**.

**Achar fatos é seu trabalho, nunca do usuário.** Neste ambiente isso deixa de ser aspiração e vira obrigação: você tem `Grep`, `Glob`, `Read`, o shell e o MCP do Supabase (read-only). Antes de perguntar qualquer coisa, verifique se a resposta está no repositório, no histórico do git ou no banco. Uma pergunta que o código responde é uma pergunta desperdiçada — e pior, transfere para o usuário um trabalho que era seu.

Não trave a rodada por causa de uma investigação: só as perguntas que dependem daquele fato esperam; faça o resto da fronteira agora.

**As decisões continuam sendo do usuário.** Você traz os fatos; ele decide os trade-offs. Não confunda "descobri como funciona hoje" com "decidi como deve funcionar".

A sessão termina quando a fronteira está vazia: todo ramo da árvore visitado, nada assumido em silêncio. **Não aja sobre o resultado até o usuário confirmar** que chegaram a um entendimento compartilhado.

---

## Parte 2 — Documentar o domínio enquanto interroga (motor `domain-modeling`)

Esta é a disciplina **ativa**: desafiar termos, inventar cenários de borda e **escrever o glossário e as decisões no momento em que cristalizam** — não no fim.

Crie os arquivos **preguiçosamente**: só quando tiver algo para escrever. Sem `CONTEXT.md` ainda? Crie quando o primeiro termo for resolvido. Sem ADR ainda? Crie quando a primeira decisão que merece registro aparecer.

### Durante a sessão

- **Desafie contra o glossário.** Se o usuário usar um termo que conflita com o que já está no `CONTEXT.md`, aponte na hora. "Seu glossário define 'renegociação' como X, mas você parece querer dizer Y. Qual é?"
- **Desafie contra o código.** O domínio já está encarnado no repositório: em `schema.sql`, nos nomes das tabelas e nas páginas. Se o termo que o usuário usa não bate com o que o código chama daquilo, isso é um achado — traga.
- **Afie linguagem fuzzy.** Diante de termos vagos ou sobrecarregados, proponha um termo canônico preciso. "Você diz 'conta': é o Cliente ou o Usuário? São coisas diferentes."
- **Discuta cenários concretos.** Ao tratar de relações do domínio, estresse com cenários específicos que forcem o usuário a ser preciso sobre as fronteiras entre conceitos.
- **Cheque a consistência.** Confronte o que o usuário diz agora com o que ele disse antes **e com o que o código faz**. Achou contradição, traga à tona: "Antes você disse que a parcela some ao renegociar; mas [Credit.tsx](src/pages/Credit.tsx) marca como paga e cria novas. Qual é a regra?"
- **Atualize o `CONTEXT.md` na hora.** Quando um termo é resolvido, escreva no glossário ali mesmo — não acumule. Use o formato de `CONTEXT-FORMAT.md`. O `CONTEXT.md` é **só glossário**: sem detalhes de implementação, não é spec nem rascunho.
- **Ofereça ADRs com parcimônia.** Só ofereça registrar uma decisão quando as **três** forem verdade: (1) **difícil de reverter**, (2) **surpreendente sem contexto** (um leitor futuro vai se perguntar "por que fizeram assim?"), (3) **fruto de um trade-off real** (havia alternativas genuínas). Faltou uma, pule. Use o formato de `ADR-FORMAT.md`.

### O domínio aqui é em português

`clientes`, `vendas`, `crediário`, `parcelas`, `fornecedores`, `vencimentos`, `fiado`. O glossário deve usar esses termos — são os do código e os que a dona da loja fala. Não traduza para inglês nem invente sinônimo "mais técnico".

---

## Saída

Os arquivos vão para o repositório, na estrutura que o resto do funil espera:

```
CONTEXT.md
docs/adr/0001-<slug>.md
docs/adr/0002-<slug>.md
```

Ao fim da sessão, liste os caminhos como links clicáveis. Eles alimentam a `to-spec` e ficam versionados junto com o código que descrevem.

## Não faça

- Não peça ao usuário fatos que o repositório, o git ou o banco respondem.
- Não coloque detalhes de implementação no `CONTEXT.md` — é glossário, nada mais.
- Não crie ADR para decisão fácil de reverter, óbvia, ou sem alternativa real.
- Não aja sobre o design antes do usuário confirmar o entendimento compartilhado.
- Não decida os trade-offs por ele: traga os fatos e as opções, espere a escolha.
