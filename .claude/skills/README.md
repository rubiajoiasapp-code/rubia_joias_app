# Skills do projeto Rubia Joias

Esta pasta guarda as **skills** do Claude Code específicas deste projeto.
Skills aqui ficam versionadas no git e valem para qualquer pessoa que abrir o repositório.

## Como criar uma skill

Cada skill é uma subpasta com um arquivo `SKILL.md`:

```
.claude/skills/
  nome-da-skill/
    SKILL.md          # obrigatório
    reference.md      # opcional — material de apoio carregado sob demanda
    scripts/          # opcional — scripts auxiliares
```

O `SKILL.md` precisa começar com frontmatter YAML:

```markdown
---
name: nome-da-skill
description: Quando usar esta skill. O Claude lê esta linha para decidir se carrega a skill, então descreva os gatilhos (ex.- "Use ao criar uma nova migration SQL do Supabase").
---

# Nome da Skill

Instruções passo a passo que o Claude deve seguir.
```

Regras do `name`: minúsculas, hífens, sem espaços — e igual ao nome da pasta.

## Como usar

- **Automático**: o Claude carrega a skill sozinho quando a tarefa bate com a `description`.
- **Manual**: digite `/nome-da-skill` no chat.

## Onde cada tipo de skill mora

| Escopo | Caminho | Vale para |
|---|---|---|
| Projeto (versionada) | `.claude/skills/` (esta pasta) | Só o Rubia Joias, todo mundo do repo |
| Pessoal | `~/.claude/skills/` | Todos os projetos desta máquina |

## Ideias de skills úteis aqui

- `nova-migration` — convenção de `migration_*.sql` + atualização do [schema.sql](../../schema.sql)
- `nova-pagina` — padrão de página em [src/pages/](../../src/pages/) (estado local, queries Supabase diretas, modais no mesmo arquivo)
- `deploy` — checklist antes do push na `main` (build + lint, já que push em main faz deploy na Vercel)
