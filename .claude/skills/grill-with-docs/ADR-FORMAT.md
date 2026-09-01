# Formato de ADR (Architecture Decision Record)

ADRs ficam em `docs/adr/` com numeração sequencial: `0001-slug.md`, `0002-slug.md`, etc. Crie a pasta `docs/adr/` preguiçosamente — só quando o primeiro ADR for necessário.

## Template

```md
# {Título curto da decisão}

{1 a 3 frases: qual o contexto, o que foi decidido e por quê.}
```

É isso. Um ADR pode ser um único parágrafo. O valor está em registrar **que** uma decisão foi tomada e **por quê**, não em preencher seções.

## Seções opcionais

Só inclua quando agregam valor real. A maioria dos ADRs não precisa.

- **Status** no frontmatter (`proposto | aceito | descontinuado | substituído por ADR-NNNN`): útil quando decisões são revisitadas.
- **Opções consideradas**: só quando as alternativas rejeitadas valem a pena ser lembradas.
- **Consequências**: só quando há efeitos não óbvios a destacar.

## Numeração

Veja o maior número existente em `docs/adr/` e incremente em um.

## Quando oferecer um ADR

As **três** precisam ser verdade:

1. **Difícil de reverter**: mudar de ideia depois custa caro.
2. **Surpreendente sem contexto**: um leitor futuro vai olhar e se perguntar "por que fizeram assim?".
3. **Fruto de um trade-off real**: havia alternativas genuínas e você escolheu uma por motivos específicos.

Se é fácil de reverter, pule — você simplesmente reverte. Se não é surpreendente, ninguém vai se perguntar por quê. Se não havia alternativa real, não há nada a registrar além de "fizemos o óbvio".

### O que se qualifica

- **Forma arquitetural.** "Usamos monorepo." "Modelo de escrita event-sourced, leitura projetada no Postgres."
- **Padrões de integração entre contextos.** "Pedidos e Faturamento se comunicam por eventos de domínio, não HTTP síncrono."
- **Escolhas de tecnologia com lock-in.** Banco, message bus, provedor de auth, alvo de deploy. Não toda biblioteca — só as que levariam um trimestre para trocar.
- **Decisões de fronteira e escopo.** "Dados do cliente pertencem ao contexto Cliente; outros contextos referenciam por ID." Os "nãos" explícitos valem tanto quanto os "sins".
- **Desvios deliberados do caminho óbvio.** "Usamos SQL manual em vez de ORM porque X." Qualquer coisa em que um leitor razoável assumiria o contrário — evita que o próximo engenheiro "conserte" algo que era proposital.
- **Restrições invisíveis no código.** "Não podemos usar AWS por compliance." "Resposta abaixo de 200ms por contrato com a API do parceiro."
- **Alternativas rejeitadas quando a rejeição não é óbvia.** Se considerou GraphQL e escolheu REST por motivos sutis, registre; senão alguém sugere GraphQL de novo daqui a seis meses.
