---
name: grill-with-docs
description: "Uma entrevista implacável para afiar um plano ou design que, ao mesmo tempo, vai construindo os documentos do domínio — um glossário (CONTEXT.md) e ADRs (registros de decisão) — como arquivos Markdown. Use SEMPRE que o usuário quiser estressar o raciocínio de um projeto mais complexo e sair com a terminologia e as decisões registradas, tipicamente ANTES de gerar a spec. Gatilhos: 'me grelha com docs', 'interroga e vai documentando', 'quero sair com glossário e decisões', 'grill com documentação'."
license: MIT
---

# grill-with-docs — interrogar + documentar o domínio (fase de planejamento)

Adaptação da skill `grill-with-docs` do Matt Pocock (MIT), que no original apenas **compõe** duas skills: `grilling` (o interrogatório) e `domain-modeling` (glossário + ADRs). Aqui as duas estão **reunidas numa skill só**, para rodar no **claude.ai sem repositório**: você é interrogado e, ao mesmo tempo, saem **arquivos** — `CONTEXT.md` (glossário) e `docs/adr/NNNN-slug.md` (decisões) — que você baixa e leva para o Claude Code. Formatos preservados: ver `CONTEXT-FORMAT.md`, `ADR-FORMAT.md` e `ATTRIBUTION.md`.

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

**Achar fatos é seu trabalho, nunca do usuário.** Quando uma pergunta da fronteira precisa de um fato do ambiente (um arquivo da conversa, algo pesquisável na web), **descubra você mesmo** com as ferramentas disponíveis — não peça ao usuário nada que você consiga achar. Não trave a rodada por isso: só as perguntas que dependem daquele fato esperam; faça o resto da fronteira agora. **As decisões são do usuário**: coloque cada uma para ele e espere.

A sessão termina quando a fronteira está vazia: todo ramo da árvore visitado, nada assumido em silêncio. **Não aja sobre o resultado até o usuário confirmar** que chegaram a um entendimento compartilhado.

---

## Parte 2 — Documentar o domínio enquanto interroga (motor `domain-modeling`)

Esta é a disciplina **ativa**: desafiar termos, inventar cenários de borda e **escrever o glossário e as decisões no momento em que cristalizam** — não no fim.

Crie os arquivos **preguiçosamente**: só quando tiver algo para escrever. Sem `CONTEXT.md` ainda? Crie quando o primeiro termo for resolvido. Sem ADR ainda? Crie quando a primeira decisão que merece registro aparecer.

### Durante a sessão

- **Desafie contra o glossário.** Se o usuário usar um termo que conflita com o que já está no `CONTEXT.md`, aponte na hora. "Seu glossário define 'cancelamento' como X, mas você parece querer dizer Y. Qual é?"
- **Afie linguagem fuzzy.** Diante de termos vagos ou sobrecarregados, proponha um termo canônico preciso. "Você diz 'conta': é o Cliente ou o Usuário? São coisas diferentes."
- **Discuta cenários concretos.** Ao tratar de relações do domínio, estresse com cenários específicos que forcem o usuário a ser preciso sobre as fronteiras entre conceitos.
- **Cheque a consistência.** Confronte o que o usuário diz agora com o que ele disse antes na conversa (e, se ele referenciou código/docs, com isso). Achou contradição, traga à tona: "Antes você disse cancelamento parcial; agora falou em cancelar o Pedido inteiro. Qual vale?"
- **Atualize o `CONTEXT.md` na hora.** Quando um termo é resolvido, escreva no glossário ali mesmo — não acumule. Use o formato de `CONTEXT-FORMAT.md`. O `CONTEXT.md` é **só glossário**: sem detalhes de implementação, não é spec nem rascunho.
- **Ofereça ADRs com parcimônia.** Só ofereça registrar uma decisão quando as **três** forem verdade: (1) **difícil de reverter**, (2) **surpreendente sem contexto** (um leitor futuro vai se perguntar "por que fizeram assim?"), (3) **fruto de um trade-off real** (havia alternativas genuínas). Faltou uma, pule. Use o formato de `ADR-FORMAT.md`.

---

## Saída (o que você leva para o Claude Code)

Como aqui não há repositório, mantenha os arquivos localmente na pasta de saída, na mesma estrutura que o Claude Code espera:

```
CONTEXT.md
docs/adr/0001-<slug>.md
docs/adr/0002-<slug>.md
```

Ao fim da sessão (ou quando o usuário pedir), **apresente esses arquivos para download** — se forem vários, compacte num `.zip`. O formato é o do Matt, então caem direto na disciplina `domain-modeling`/`implement` reais no Claude Code, e alimentam a `to-spec` aqui.

## Não faça

- Não coloque detalhes de implementação no `CONTEXT.md` — é glossário, nada mais.
- Não crie ADR para decisão fácil de reverter, óbvia, ou sem alternativa real.
- Não aja sobre o design antes do usuário confirmar o entendimento compartilhado.
- Não peça ao usuário fatos que você mesmo consegue descobrir.
