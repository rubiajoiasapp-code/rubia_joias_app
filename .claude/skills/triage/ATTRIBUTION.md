# Crédito e licença

Esta skill é uma **adaptação** da skill `triage` do conjunto **"Skills for Real Engineers"** de
**Matt Pocock** (https://github.com/mattpocock/skills), licenciado sob MIT.

## Mudanças feitas nesta versão adaptada
- Removida toda a camada de issue tracker, PRs e máquina de estados publicada no tracker; a triagem roda na conversa e a saída é arquivo Markdown local.
- Removida a exploração de repositório (checagem de redundância no código, respeito a ADRs de uma área); trocada por checagem de consistência com o que o usuário descreveu.
- "Verificar a alegação" rodando/reproduzindo código (recurso do ambiente do Claude Code) virou checagem no nível do raciocínio, com marcação do que precisa de verificação em runtime depois.
- Estado `needs-triage` (rótulo de tracker) removido — no chat a triagem acontece ao vivo.
- Removido o compositor "chame grilling + domain-modeling"; o interrogatório está inline, e para casos complexos aponta-se a skill `grill-with-docs`.
- Formatos `AGENT-BRIEF.md` e `OUT-OF-SCOPE.md` preservados (traduzidos, exemplos localizados; exemplo de PR removido por não haver PRs aqui), para o brief plugar na `to-spec`/`to-tickets`/`implement`.
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
