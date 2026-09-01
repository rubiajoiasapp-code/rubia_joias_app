---
name: to-spec
description: "Transforma a conversa atual em uma especificação e a salva em docs/specs/ — sem entrevista, só síntese do que já foi discutido, ancorada no código real do repositório. Use SEMPRE que o usuário pedir para 'virar uma spec', 'gerar a especificação', 'consolidar o que decidimos em uma spec', ou similar, tipicamente na fase de planejamento antes de implementar. Ideal para rodar DEPOIS de uma sessão de descoberta (ex.: grill-with-docs). NÃO use para descobrir requisitos ou entrevistar o usuário — isso é papel da grill-with-docs."
license: MIT
---

# to-spec — conversa → especificação

Adaptação da skill `to-spec` do Matt Pocock (MIT) para o **Claude Code neste repositório**. Sintetiza a conversa atual em uma **especificação em Markdown** salva em `docs/specs/`, que alimenta a `to-tickets` ou a implementação direta. Crédito e mudanças em `ATTRIBUTION.md`.

## Princípio central

**NÃO entreviste o usuário.** Sintetize o que já foi discutido na conversa. Se faltar uma decisão importante para escrever a spec, **aponte a lacuna** e sugira rodar a `grill-with-docs` antes — não conduza a entrevista aqui. Esta skill é o passo "consolidar", não o passo "descobrir".

Isso **não** significa não pesquisar. A regra é sobre não fazer o usuário trabalhar: fato que está no repositório ou no banco, você descobre sozinho.

## O que este ambiente muda

Você tem repositório, shell e o MCP do Supabase (read-only). A spec deve ser **ancorada no código que existe**, não no código que você imagina.

- Antes de escrever, **leia as páginas e funções** que a feature toca.
- **Confira o schema no banco** pelo MCP quando a spec envolver dados. O `schema.sql` é o canônico do projeto, mas pode estar atrás do que está aplicado.
- Se a conversa assumiu algo sobre o código, **verifique** antes de cristalizar na spec. Premissa errada aqui vira trabalho errado depois.

## Processo

1. **Sintetize** a partir da conversa e **do repositório**. Mantenha os termos e o glossário que o usuário usou — o domínio aqui é em português (`clientes`, `vendas`, `crediário`, `parcelas`, `fornecedores`), e a spec deve falar a mesma língua do código.

2. **Esboce as costuras de verificação** — os pontos onde a feature será conferida. Prefira costuras existentes, o mais alto nível possível, e o **mínimo** delas.

   **Atenção:** este projeto **não tem test runner**. As costuras reais são:
   - `npm run build` (`tsc -b` + vite) — erro de tipo e compilação
   - `npm run lint`
   - passos manuais no navegador, escritos com precisão
   - consulta ao banco pelo MCP, para comportamento sobre dados/RLS/storage
   - scripts em `scripts/` em dry-run, para estado de storage

   **Confirme as costuras com o usuário.** Este é o único ponto de consulta — é validação de onde verificar, não uma entrevista.

3. **Escreva a spec** usando o template abaixo e salve em `docs/specs/spec-<slug-da-feature>.md`. Informe o caminho como link clicável.

<spec-template>

## Problem Statement

O problema que o usuário enfrenta, da perspectiva dele.

## Solution

A solução para o problema, da perspectiva do usuário.

## User Stories

Uma lista numerada LONGA de user stories, no formato:

1. Como \<ator\>, quero \<funcionalidade\>, para \<benefício\>

Exemplo:
1. Como dona da loja, quero ver quais parcelas vencem esta semana, para cobrar antes de virar atraso.

A lista deve ser extensa e cobrir todos os aspectos da feature.

## Implementation Decisions

Lista das decisões de implementação. Pode incluir: módulos a construir/modificar, interfaces desses módulos, esclarecimentos técnicos, decisões de arquitetura, mudanças de schema, contratos de API, interações específicas.

Cite arquivos como **ponteiro verificado**, não como contrato — "hoje isso vive em [Credit.tsx](src/pages/Credit.tsx)" ajuda quem for implementar. Nunca números de linha. Nunca trechos de código longos: a exceção é um snippet que codifica uma decisão com mais precisão que a prosa (máquina de estados, reducer, schema, formato de tipo) — embuta só a parte que carrega a decisão.

Se a feature mexe em dados: diga que precisa de um `migration_*.sql` na raiz **e** da atualização do `schema.sql`, e que a aplicação é manual no painel do Supabase.

## Verification Decisions

Como esta feature será conferida, usando as costuras listadas acima. Inclua: o que faz uma boa verificação (comportamento externo, não detalhe de implementação), quais fluxos serão checados, e prior art (verificações parecidas que já existem no projeto).

## Out of Scope

O que está fora do escopo desta spec.

## Further Notes

Notas adicionais. Se a feature toca produção, registre aqui o que acontece se der errado — `main` faz deploy automático num app que uma pessoa real usa para trabalhar.

</spec-template>

## Não faça

- Não entreviste o usuário — se faltar decisão, aponte a lacuna e sugira a `grill-with-docs`.
- Não escreva a spec sem ter lido o código que ela descreve.
- Não invente costura de teste automatizado: não existe suíte neste projeto.
- Não traduza o domínio para inglês; o código e a UI são em português.
