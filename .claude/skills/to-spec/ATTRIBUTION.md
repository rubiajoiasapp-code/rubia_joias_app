# Crédito e licença

Esta skill é uma **adaptação** de uma skill do conjunto **"Skills for Real Engineers"** de **Matt Pocock**
(https://github.com/mattpocock/skills), distribuído sob licença MIT.

## Mudanças feitas nesta versão adaptada
- Removida a dependência de issue tracker e da skill `setup-matt-pocock-skills`.
- Saída redirecionada para **arquivo(s) Markdown local(is)** (fase de planejamento no claude.ai), em vez de publicar em tracker.
- Removida a exploração obrigatória de repositório (não há codebase na fase de planejamento).
- Frontmatter reduzido a `name`/`description`/`license` para compatibilidade com o upload de skills do claude.ai.
- **Formato do artefato preservado** (template de spec / de ticket), para os arquivos plugarem direto na skill `implement` original no Claude Code.

O texto e a estrutura originais são de Matt Pocock. As adaptações acima são para uso pessoal, permitidas pela licença MIT abaixo.

## Segunda adaptacao — do claude.ai para o Claude Code (este repositorio)

A versao anterior tinha sido reduzida para rodar no claude.ai, sem repositorio nem shell.
Aqui esses recursos existem, entao as limitacoes foram desfeitas:

- Removida a premissa de "sem repositorio": a skill agora le o codigo com Grep/Glob/Read, roda o shell e consulta o banco pelo MCP do Supabase (read-only) antes de perguntar qualquer coisa ao usuario.
- Saida deixou de ser "apresente para download" (e .zip): os arquivos sao escritos no repositorio e informados como link clicavel.
- Acrescentado o contexto deste projeto: dominio e UI em portugues, paginas como arquivos unicos grandes, convencao migration_*.sql + schema.sql, e push na main = deploy em producao.
- Acrescentado o fato de NAO existir test runner aqui: as costuras de verificacao passam a ser npm run build (tsc -b), npm run lint, passos manuais no navegador, consulta ao banco pelo MCP e os scripts em scripts/ em dry-run.
- A spec passa a ser ancorada no codigo lido, nao so na conversa; premissas da conversa sobre o codigo devem ser verificadas antes de cristalizar.
- "Testing Decisions" virou "Verification Decisions", porque nao ha suite de testes neste projeto.

---

MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
