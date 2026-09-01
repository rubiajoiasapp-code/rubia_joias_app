---
name: to-spec
description: "Transforma a conversa atual em uma especificação e a salva como um arquivo Markdown para download — sem entrevista, só síntese do que já foi discutido. Use SEMPRE que o usuário pedir para 'virar uma spec', 'gerar a especificação', 'consolidar o que decidimos em uma spec', ou similar, tipicamente na fase de planejamento antes de implementar. Ideal para rodar DEPOIS de uma sessão de descoberta (ex.: grill-me). NÃO use para descobrir requisitos ou entrevistar o usuário — isso é papel da grill-me/grilling."
license: MIT
---

# to-spec — conversa → especificação (fase de planejamento)

Adaptação da skill `to-spec` do Matt Pocock (MIT) para a **fase de planejamento no claude.ai**: roda **sem repositório, sem issue tracker e sem `setup-matt-pocock-skills`**. Sintetiza a conversa atual em uma **especificação em Markdown** que você baixa e leva para o Claude Code implementar. Crédito e mudanças em `ATTRIBUTION.md`.

## Princípio central

**NÃO entreviste o usuário.** Sintetize o que já foi discutido na conversa (mais qualquer spec/doc que o usuário referenciar). Se faltar uma decisão importante para escrever a spec, **aponte a lacuna** e sugira rodar a `grill-me` antes — não conduza a entrevista aqui. Esta skill é o passo "consolidar", não o passo "descobrir".

## Processo

1. **Sintetize** a partir do contexto da conversa. Não há repositório para explorar aqui: use o entendimento de código que já estiver na conversa, e mantenha os termos/glossário que o usuário usou. Se o usuário passar uma referência (um caminho de spec, uma decisão anterior), incorpore.

2. **Esboce as costuras de teste (seams)** — os pontos onde a feature será verificada. Prefira costuras existentes, o mais alto nível possível, e o **mínimo** delas (o ideal é uma). **Confirme as costuras com o usuário.** Este é o único ponto de consulta — é validação de onde testar, não uma entrevista.

3. **Escreva a spec** usando o template abaixo, **salve como um arquivo Markdown** (`spec-<slug-da-feature>.md`) e **apresente para download**. É o artefato que o usuário leva para o Claude Code — o formato é o do Matt, então pluga direto na skill `implement` real lá.

<spec-template>

## Problem Statement

O problema que o usuário enfrenta, da perspectiva dele.

## Solution

A solução para o problema, da perspectiva do usuário.

## User Stories

Uma lista numerada LONGA de user stories, no formato:

1. Como \<ator\>, quero \<funcionalidade\>, para \<benefício\>

Exemplo:
1. Como cliente do banco pelo celular, quero ver o saldo das minhas contas, para tomar decisões melhores sobre meus gastos.

A lista deve ser extensa e cobrir todos os aspectos da feature.

## Implementation Decisions

Lista das decisões de implementação. Pode incluir: módulos a construir/modificar, interfaces desses módulos, esclarecimentos técnicos, decisões de arquitetura, mudanças de schema, contratos de API, interações específicas.

NÃO inclua caminhos de arquivo nem trechos de código — envelhecem rápido. Exceção: se um protótipo produziu um snippet que codifica uma decisão com mais precisão que a prosa (máquina de estados, reducer, schema, formato de tipo), embuta o trecho relevante e note que veio de um protótipo. Só as partes que carregam a decisão, não um demo funcional.

## Testing Decisions

Lista das decisões de teste. Inclua: o que faz um bom teste (testar só comportamento externo, não detalhes de implementação), quais módulos serão testados, e prior art (testes parecidos que já existem).

## Out of Scope

O que está fora do escopo desta spec.

## Further Notes

Notas adicionais sobre a feature.

</spec-template>

## Não faça

- Não entreviste o usuário — se faltar decisão, aponte a lacuna e sugira a `grill-me`.
- Não inclua caminhos de arquivo nem código na spec (salvo o caso de snippet de protótipo acima).
- Não tente "explorar o repositório" nem publicar em tracker — aqui é planejamento; a saída é um arquivo `.md`.
