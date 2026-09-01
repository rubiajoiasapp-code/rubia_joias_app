---
name: to-tickets
description: "Quebra um plano, uma spec ou a conversa atual em um conjunto de tickets 'tracer-bullet' (fatias verticais completas), cada um declarando quais tickets o bloqueiam, e salva um arquivo Markdown por ticket para download. Use SEMPRE que o usuário pedir para 'quebrar em tickets/tarefas', 'gerar as issues', 'transformar a spec em tickets', ou similar, na fase de planejamento antes de implementar. Funciona a partir de uma spec (ex.: gerada pela to-spec) ou direto da conversa."
license: MIT
---

# to-tickets — plano/spec/conversa → tickets (fase de planejamento)

Adaptação da skill `to-tickets` do Matt Pocock (MIT) para a **fase de planejamento no claude.ai**: roda **sem issue tracker e sem `setup-matt-pocock-skills`**, sempre em **modo arquivos locais**. Quebra o trabalho em **tickets** e salva **um arquivo Markdown por ticket** que você baixa e leva para o Claude Code implementar. Crédito e mudanças em `ATTRIBUTION.md`.

Cada ticket é uma **fatia vertical tracer-bullet**, declarando os tickets que o **bloqueiam**.

## Processo

### 1. Reúna o contexto
Trabalhe com o que já está na conversa. Se o usuário passar uma referência (o caminho de uma spec, um arquivo), leia o corpo inteiro. Não há repositório para explorar aqui — use o entendimento que já estiver na conversa e os termos/glossário que o usuário usou.

### 2. Rascunhe as fatias verticais
Quebre o trabalho em tickets **tracer bullet**:

<regras-de-fatia-vertical>

- Cada fatia corta um caminho estreito mas COMPLETO por todas as camadas (schema, API, UI, testes): vertical, NÃO uma fatia horizontal de uma camada só.
- Uma fatia concluída é demonstrável ou verificável por si só.
- Cada fatia cabe em uma única janela de contexto nova.
- Qualquer "prefactoring" (preparar o código para facilitar a mudança) vem primeiro. "Torne a mudança fácil, depois faça a mudança fácil."

</regras-de-fatia-vertical>

Dê a cada ticket suas **arestas de bloqueio**: os outros tickets que precisam terminar antes dele começar. Um ticket sem bloqueadores pode começar imediatamente.

**Refatorações amplas são a exceção à fatia vertical.** Uma refatoração ampla é uma mudança mecânica (renomear uma coluna, retipar um símbolo compartilhado) cujo raio de impacto atinge todo o codebase de uma vez — nenhuma fatia vertical consegue ficar "verde". Não force isso em um tracer bullet; sequencie como **expand–contract**. Primeiro **expand**: adicione a forma nova ao lado da antiga, sem quebrar nada. Depois **migre** os pontos de uso em lotes dimensionados pelo raio de impacto (por pacote, por diretório), cada lote um ticket bloqueado pelo expand, mantendo a CI verde de lote em lote porque a forma antiga ainda existe. Por fim **contract**: apague a forma antiga quando não sobrar nenhum uso, em um ticket bloqueado por todos os lotes de migração. Se nem os lotes se sustentarem verdes sozinhos, mantenha a sequência mas deixe-os compartilhar um branch de integração que bloqueia um ticket final de integrar-e-verificar; o verde só é prometido ali.

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

### 4. Escreva os tickets como arquivos locais
Depois de aprovado, escreva **um arquivo por ticket** em `<slug-da-feature>/issues/<NN>-<slug>.md`, numerados a partir de `01` em ordem de dependência (bloqueadores primeiro). O campo "Bloqueado por" de cada arquivo lista os números/títulos de que ele depende. **Um ticket por arquivo, nunca um arquivo combinado.** Use o template abaixo. Ao final, **apresente os arquivos para download** (se forem vários, entregue-os compactados em um `.zip`) — é o que o usuário leva para o Claude Code, onde a skill `implement` real consome exatamente esse formato.

<template-de-ticket-local>

# \<NN\>: \<Título do ticket\>

**O que construir:** o comportamento ponta-a-ponta que este ticket faz funcionar, da perspectiva do usuário — não uma lista de implementação camada por camada.

**Bloqueado por:** os números/títulos dos tickets que travam este, ou "Nenhum (pode começar imediatamente)".

**Status:** ready-for-agent

- [ ] Critério de aceite 1
- [ ] Critério de aceite 2

</template-de-ticket-local>

Em qualquer caso, **evite caminhos de arquivo e trechos de código** — envelhecem rápido. Exceção: se um protótipo produziu um snippet que codifica uma decisão com mais precisão que a prosa (máquina de estados, reducer, schema, formato de tipo), embuta só a parte que carrega a decisão e note que veio de um protótipo.

## Não faça
- Não tente publicar em issue tracker nem rodar `setup-matt-pocock-skills` — aqui é planejamento, modo arquivos locais.
- Não pule o passo de interrogar/aprovar — a granularidade e as arestas de bloqueio precisam da validação do usuário.
- Não escreva fatias horizontais (uma camada só) nem tickets grandes demais para uma janela de contexto.
