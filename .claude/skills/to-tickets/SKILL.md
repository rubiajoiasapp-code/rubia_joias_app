---
name: to-tickets
description: "Quebra um plano, uma spec ou a conversa atual em tickets 'tracer-bullet' (fatias verticais completas), cada um declarando quais tickets o bloqueiam, e escreve um arquivo Markdown por ticket em docs/issues/. Use SEMPRE que o usuário pedir para 'quebrar em tickets/tarefas', 'gerar as issues', 'transformar a spec em tickets', ou similar, na fase de planejamento antes de implementar. Funciona a partir de uma spec (ex.: gerada pela to-spec) ou direto da conversa."
license: MIT
---

# to-tickets — plano/spec/conversa → tickets

Adaptação da skill `to-tickets` do Matt Pocock (MIT) para o **Claude Code neste repositório**. Quebra o trabalho em **tickets** e escreve **um arquivo Markdown por ticket** em `docs/issues/`. Crédito e mudanças em `ATTRIBUTION.md`.

Cada ticket é uma **fatia vertical tracer-bullet**, declarando os tickets que o **bloqueiam**.

## Processo

### 1. Reúna o contexto
Comece pela conversa e por qualquer referência que o usuário passar (leia o corpo inteiro de specs citadas). Então **vá ao repositório**: as fatias só ficam do tamanho certo se você souber o que já existe.

Use o MCP do Supabase (read-only) quando o trabalho envolver dados — schema, policies, storage. O `schema.sql` é o canônico do projeto, mas o banco é a fonte da verdade sobre o que está aplicado.

### 2. Rascunhe as fatias verticais
Quebre o trabalho em tickets **tracer bullet**:

<regras-de-fatia-vertical>

- Cada fatia corta um caminho estreito mas COMPLETO por todas as camadas (schema, dados, UI, verificação): vertical, NÃO uma fatia horizontal de uma camada só.
- Uma fatia concluída é demonstrável ou verificável por si só.
- Cada fatia cabe em uma única janela de contexto nova.
- Qualquer "prefactoring" (preparar o código para facilitar a mudança) vem primeiro. "Torne a mudança fácil, depois faça a mudança fácil."

</regras-de-fatia-vertical>

Dê a cada ticket suas **arestas de bloqueio**: os outros tickets que precisam terminar antes dele começar. Um ticket sem bloqueadores pode começar imediatamente.

**Refatorações amplas são a exceção à fatia vertical.** Uma refatoração ampla é uma mudança mecânica (renomear uma coluna, retipar um símbolo compartilhado) cujo raio de impacto atinge todo o codebase de uma vez — nenhuma fatia vertical consegue ficar "verde". Não force isso em um tracer bullet; sequencie como **expand–contract**. Primeiro **expand**: adicione a forma nova ao lado da antiga, sem quebrar nada. Depois **migre** os pontos de uso em lotes dimensionados pelo raio de impacto (por página, por diretório), cada lote um ticket bloqueado pelo expand, mantendo o build verde de lote em lote porque a forma antiga ainda existe. Por fim **contract**: apague a forma antiga quando não sobrar nenhum uso, em um ticket bloqueado por todos os lotes de migração.

**Migration é quase sempre um expand–contract.** O banco é aplicado à mão no painel e o deploy é automático no push da `main`, então schema e código mudam em momentos diferentes. Sequencie para que o código rode tanto antes quanto depois da migration: adicione a coluna, faça o código escrever nas duas formas, migre os dados, só então remova a antiga. Um ticket que exija "aplicar a migration no mesmo instante do deploy" está mal fatiado.

### 3. Interrogue o usuário (quiz)
Apresente a quebra proposta como uma lista numerada. Para cada ticket, mostre:

- **Título**: nome curto e descritivo.
- **Bloqueado por**: quais outros tickets (se houver) precisam terminar antes.
- **O que entrega**: o comportamento ponta-a-ponta que este ticket faz funcionar.

Pergunte ao usuário:
- A granularidade está boa? (grossa demais / fina demais)
- As arestas de bloqueio estão corretas — cada ticket depende só de tickets que realmente o travam?
- Algum ticket deve ser fundido ou dividido?

**Itere até o usuário aprovar a quebra.**

### 4. Escreva os tickets
Depois de aprovado, escreva **um arquivo por ticket** em `docs/issues/<slug-da-feature>/<NN>-<slug>.md`, numerados a partir de `01` em ordem de dependência (bloqueadores primeiro). **Um ticket por arquivo, nunca um arquivo combinado.** Ao final, liste os caminhos como links clicáveis.

<template-de-ticket>

# \<NN\>: \<Título do ticket\>

**O que construir:** o comportamento ponta-a-ponta que este ticket faz funcionar, da perspectiva do usuário — não uma lista de implementação camada por camada.

**Bloqueado por:** os números/títulos dos tickets que travam este, ou "Nenhum (pode começar imediatamente)".

**Status:** ready-for-agent

**Como verificar:** os comandos e passos concretos que provam que terminou.

- [ ] Critério de aceite 1
- [ ] Critério de aceite 2

</template-de-ticket>

Cite arquivos como **ponteiro verificado** ("hoje isso vive em [Credit.tsx](src/pages/Credit.tsx)"), nunca como o contrato do ticket, e **nunca números de linha**. Evite trechos de código: a exceção é um snippet que codifica uma decisão com mais precisão que a prosa — embuta só a parte que carrega a decisão.

## Como se verifica aqui

**Não há test runner neste projeto.** "Verificável por si só" significa uma destas costuras, não uma suíte:

- `npm run build` (`tsc -b` + vite) e `npm run lint` passam
- passos manuais no navegador, escritos com precisão (qual rota, o que clicar, o que aparece)
- consulta ao banco pelo MCP, para tickets sobre dados, RLS ou storage
- scripts em `scripts/` em dry-run, para estado de storage

Todo ticket precisa do campo **Como verificar** preenchido com uma dessas. Ticket sem forma de conferir não está pronto para agente.

## Não faça
- Não pule o passo de interrogar/aprovar — a granularidade e as arestas de bloqueio precisam da validação do usuário.
- Não escreva fatias horizontais (uma camada só) nem tickets grandes demais para uma janela de contexto.
- Não escreva critério de aceite baseado em suíte de testes — ela não existe aqui.
- Não crie ticket que acople a aplicação de uma migration ao deploy do código; sequencie como expand–contract.
- Não traduza o domínio para inglês; o código e a UI são em português.
