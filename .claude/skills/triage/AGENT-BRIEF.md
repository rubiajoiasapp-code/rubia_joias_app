# Escrevendo Agent Briefs

Um **agent brief** é a especificação bem-formada que sai da triagem quando um item vira `ready-for-agent` (ou `ready-for-human`). O pedido original e a discussão são contexto; **o brief é o contrato** — é dele que um agente vai trabalhar depois no Claude Code.

## Princípios

### Durabilidade acima de precisão
O brief pode ficar parado por dias e o código muda no meio. Escreva de um jeito que continue útil mesmo com arquivos renomeados ou refatorados.
- **Faça**: descrever interfaces, tipos e contratos de comportamento; nomear tipos, assinaturas de função ou formatos de config que o agente deve procurar/alterar.
- **Não faça**: referenciar caminhos de arquivo ou números de linha; assumir que a estrutura de implementação atual vai continuar igual.

### Comportamental, não procedural
Descreva **o que** o sistema deve fazer, não **como** implementar. O agente explora o código do zero e decide a implementação.
- **Bom:** "O tipo `SkillConfig` deve aceitar um campo opcional `schedule` do tipo `CronExpression`."
- **Ruim:** "Abra src/types/skill.ts e adicione o campo na linha 42."

### Critérios de aceite completos
O agente precisa saber quando terminou. Todo brief tem critérios concretos e testáveis, cada um verificável de forma independente.
- **Bom:** "Rodar `x` com a flag `y` retorna JSON válido para sucesso e erro."
- **Ruim:** "A triagem deve funcionar corretamente."

### Fronteiras de escopo explícitas
Diga o que está **fora do escopo** — evita que o agente faça a mais ou assuma features adjacentes.

## Template

```markdown
## Agent Brief

**Categoria:** bug / enhancement
**Resumo:** uma linha do que precisa acontecer

**Comportamento atual:**
O que acontece hoje. Para bugs, o comportamento quebrado. Para enhancements, o status quo em cima do qual a feature se apoia.

**Comportamento desejado:**
O que deve acontecer depois do trabalho. Seja específico sobre casos de borda e condições de erro.

**Interfaces-chave:**
- `NomeDoTipo`: o que muda e por quê
- `nomeDaFuncao()`: o que retorna hoje vs. o que deveria
- Formato de config: novas opções necessárias

**Critérios de aceite:**
- [ ] Critério específico e testável 1
- [ ] Critério específico e testável 2
- [ ] Critério específico e testável 3

**Fora de escopo:**
- Algo que NÃO deve ser mudado neste item
- Feature adjacente que parece relacionada mas é separada
```

## Exemplos

### Bom brief (bug)

```markdown
## Agent Brief

**Categoria:** bug
**Resumo:** Truncamento da descrição corta no meio da palavra, gerando saída quebrada

**Comportamento atual:**
Quando a descrição passa de 1024 caracteres, ela é cortada exatamente em 1024, ignorando a fronteira de palavra — termina no meio de uma palavra.

**Comportamento desejado:**
O corte deve acontecer na última fronteira de palavra antes de 1024 caracteres e acrescentar "..." para indicar truncamento.

**Interfaces-chave:**
- Campo `description` do tipo `SkillMetadata`: sem mudança de tipo, mas a lógica que o popula precisa respeitar fronteiras de palavra.
- Qualquer função que lê o frontmatter do SKILL.md e extrai a descrição.

**Critérios de aceite:**
- [ ] Descrições abaixo de 1024 chars ficam inalteradas
- [ ] Descrições acima de 1024 são cortadas na última fronteira de palavra antes de 1024
- [ ] Descrições truncadas terminam com "..."
- [ ] O tamanho total com "..." não passa de 1024

**Fora de escopo:**
- Mudar o próprio limite de 1024
- Suporte a descrição multi-linha
```

### Bom brief (enhancement)

```markdown
## Agent Brief

**Categoria:** enhancement
**Resumo:** Adicionar suporte a agendamento (`schedule`) em skills

**Comportamento atual:**
Skills rodam só quando invocadas manualmente. Não há como agendar execução recorrente.

**Comportamento desejado:**
Uma skill pode declarar um agendamento; quando presente, ela roda no horário definido sem invocação manual.

**Interfaces-chave:**
- `SkillConfig`: novo campo opcional `schedule` do tipo `CronExpression`
- O carregador de skills deve, na presença de `schedule`, registrar a execução recorrente

**Critérios de aceite:**
- [ ] `SkillConfig` aceita `schedule` opcional sem quebrar skills existentes
- [ ] Com `schedule` válido, a skill roda no horário definido
- [ ] `schedule` inválido gera erro claro na carga
- [ ] Sem `schedule`, o comportamento é idêntico ao de hoje

**Fora de escopo:**
- Interface visual para editar agendamentos
- Fusos horários por skill (usar o do sistema)
```

### Brief ruim (o que evitar)

```markdown
## Agent Brief

**Resumo:** Consertar o bug da triagem

**O que fazer:**
A triagem está quebrada. Olha o arquivo principal e conserta. A função lá pela linha 150 tem o problema.

**Arquivos para mudar:**
- src/triage/handler.ts (linha 150)
```

Ruim porque: sem categoria; descrição vaga; referencia caminhos e linhas que envelhecem; sem critérios de aceite; sem fronteira de escopo; sem comportamento atual vs. desejado.
