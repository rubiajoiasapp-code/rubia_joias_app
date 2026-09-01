# Base de conhecimento "Fora de escopo"

Uma pasta `.out-of-scope/` guarda registros persistentes de **pedidos rejeitados**. Serve para dois fins:

1. **Memória institucional**: por que um pedido foi rejeitado, para o raciocínio não se perder.
2. **Deduplicação**: quando chega um pedido parecido com uma rejeição anterior, você traz a decisão passada em vez de rediscutir do zero.

Um arquivo por **conceito**, não por pedido. Vários pedidos da mesma coisa ficam agrupados num arquivo só.

## Formato do arquivo

Escreva num estilo de mini documento de design, não de registro de banco. Use parágrafos e exemplos para deixar o raciocínio claro para quem ler pela primeira vez.

```markdown
# Modo escuro

Este projeto não suporta modo escuro nem temas do usuário.

## Por que está fora de escopo

O pipeline de renderização assume uma única paleta definida em `ThemeConfig`.
Suportar vários temas exigiria provedor de tema na árvore inteira, resolução de
estilo por componente e persistência da preferência — mudança arquitetural
grande que não se alinha ao foco do projeto (autoria de conteúdo). Tema é
preocupação de quem consome/redistribui a saída.

## Pedidos anteriores

- "Adicionar modo escuro" (conversa de 12/03)
- "Tema noturno para acessibilidade" (conversa de 02/05)
```

### Nome do arquivo
Kebab-case curto e reconhecível: `modo-escuro.md`, `sistema-de-plugins.md`, `api-graphql.md`.

### Escrevendo o motivo
Substantivo, não "não queremos": referencie escopo/filosofia do projeto, restrições técnicas ou decisões estratégicas. E **durável** — evite circunstâncias temporárias ("estamos sem tempo agora"); isso é adiamento, não rejeição.

## Quando checar
Ao triar um novo pedido (passo 1, reunir contexto), leia os arquivos de `.out-of-scope/` e veja se o pedido casa com algum conceito — por **similaridade de conceito, não palavra-chave** ("tema noturno" casa com `modo-escuro.md`). Se casar, traga: "Isso é parecido com `modo-escuro.md`; rejeitamos antes porque [motivo]. Você ainda pensa assim?" O usuário pode **confirmar** (anexa o novo pedido à lista e encerra), **reconsiderar** (apaga/atualiza o arquivo e o pedido segue triagem normal) ou **discordar** (são relacionados mas distintos; segue triagem normal).

## Quando escrever
Só quando um **enhancement** (não um bug) é **rejeitado** como `wontfix`. **Não** escreva aqui quando algo é encerrado por já estar implementado — isso é feature construída, não rejeitada; registrar poluiria a deduplicação. Nesse caso, só aponte onde a feature já existe.
