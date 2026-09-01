# 01: Migration — `valor_pago`, `saldo_devedor` e trigger de coerência

**O que construir:** o banco passa a saber representar pagamento parcial de parcela, e **nada muda no app**. Este é o passo *expand*: depois dele, todas as telas continuam mostrando exatamente os mesmos números de antes.

`parcelas_venda` ganha:

```sql
valor_pago     numeric(10,2) NOT NULL DEFAULT 0
               CHECK (valor_pago >= 0 AND valor_pago <= valor_parcela)

saldo_devedor  numeric(10,2) GENERATED ALWAYS AS (valor_parcela - valor_pago) STORED
```

Mais um **trigger** que mantém `pago` e `valor_pago` coerentes nos dois sentidos, para que as telas que hoje escrevem `pago` continuem funcionando sem nenhuma alteração:

- escreveu `pago = true` → `valor_pago` recebe `valor_parcela`
- escreveu `pago = false` → `valor_pago` volta a `0`
- `valor_pago` atingiu `valor_parcela` → `pago` vira `true`
- `valor_pago` ficou abaixo → `pago` vira `false`
- `valor_parcela` foi reduzido abaixo do `valor_pago` → aparar `valor_pago` para o novo total, senão o CHECK estoura

O último caso não é hipotético: a edição de parcela no Crediário permite alterar o valor de uma parcela que já recebeu abatimento.

E o backfill: `valor_pago = CASE WHEN pago THEN valor_parcela ELSE 0 END`.

Segue a convenção do projeto: um `migration_*.sql` na raiz **e** a atualização do `schema.sql`, que é o canônico. A aplicação é manual no painel do Supabase — o MCP é read-only.

**Bloqueado por:** Nenhum (pode começar imediatamente)

**Status:** ready-for-agent

**Como verificar:**

Este ticket é o único que precisa ser verificado em **dois momentos**: anotar os números antes de aplicar, aplicar, conferir que não mudaram.

1. Antes de aplicar, anote: o "a receber" do Dashboard, os totais do mês em `/vencimentos`, e o `totalPago`/`totalPendente` de duas ou três vendas em `/crediario`.
2. Aplique a migration no SQL Editor do painel.
3. Recarregue as três telas e compare.
4. Rode as consultas de invariante pelo MCP.

- [ ] Os números anotados no passo 1 estão **idênticos** depois da migration, nas três telas
- [ ] `select count(*) from parcelas_venda where valor_pago > valor_parcela` retorna `0`
- [ ] `select count(*) from parcelas_venda where pago = true and saldo_devedor > 0` retorna `0`
- [ ] `select count(*) from parcelas_venda where pago = false and saldo_devedor = 0` retorna `0`
- [ ] Marcar uma parcela como paga pela tela atual (sem código novo) preenche `valor_pago` com o `valor_parcela`, e desmarcar zera de volta
- [ ] Reduzir o `valor_parcela` de uma parcela paga não gera erro: o `valor_pago` acompanha
- [ ] `schema.sql` reflete as colunas e o trigger
- [ ] `npm run build` e `npm run lint` passam (nada de código muda aqui, mas confirma que a árvore está sã)

**Se der errado:** a migration é reversível sem perda — remover `saldo_devedor`, `valor_pago` e o trigger devolve o estado binário. `valor_parcela` e `pago` permanecem intactos o tempo todo.
