# Crédito e licença

Esta skill é uma **adaptação** de skills do conjunto **"Skills for Real Engineers"** de **Matt Pocock**
(https://github.com/mattpocock/skills), licenciado sob MIT.

No original, `grill-with-docs` apenas **compõe** duas outras skills — `grilling` (o interrogatório) e
`domain-modeling` (glossário CONTEXT.md + ADRs). Aqui elas foram **reunidas numa única skill autossuficiente**.

## Mudanças feitas nesta versão adaptada
- `grilling` + `domain-modeling` unidas em uma skill só (o compositor original chama duas skills; isso é frágil no claude.ai).
- Removida a dependência de repositório e de issue tracker; troca "explorar o codebase" e "cruzar com o código" por checagem de consistência com o que já foi dito na conversa.
- Substituído o "dispatch de sub-agente" para achar fatos (recurso do Claude Code) por: descobrir os fatos com as ferramentas disponíveis aqui.
- Saída redirecionada para arquivos Markdown locais (`CONTEXT.md`, `docs/adr/NNNN-slug.md`) apresentados para download.
- Formatos `CONTEXT-FORMAT.md` e `ADR-FORMAT.md` preservados (traduzidos, exemplos localizados), para os arquivos plugarem na disciplina `domain-modeling`/`implement` reais no Claude Code.
- Frontmatter reduzido a `name`/`description`/`license` para compatibilidade com o upload do claude.ai.

O texto e a estrutura originais são de Matt Pocock. As adaptações são para uso pessoal, permitidas pela MIT abaixo.

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
