# Formato do CONTEXT.md (glossário)

## Estrutura

```md
# {Nome do contexto}

{Uma ou duas frases sobre o que é este contexto e por que ele existe.}

## Linguagem

**Pedido**:
{Uma ou duas frases descrevendo o termo.}
_Evite_: Compra, transação

**Fatura**:
Uma solicitação de pagamento enviada ao cliente após a entrega.
_Evite_: Conta, cobrança

**Cliente**:
Uma pessoa ou organização que faz pedidos.
_Evite_: Comprador, usuário, conta
```

## Regras

- **Seja opinativo.** Quando existem várias palavras para o mesmo conceito, escolha a melhor e liste as outras em `_Evite_`.
- **Definições enxutas.** Uma ou duas frases no máximo. Defina o que a coisa **é**, não o que ela faz.
- **Só termos específicos deste projeto.** Conceitos gerais de programação (timeouts, tipos de erro, padrões utilitários) não entram, mesmo que o projeto os use bastante. Antes de adicionar um termo, pergunte: é um conceito único deste contexto ou é conceito geral de programação? Só o primeiro entra.
- **Agrupe termos sob subtítulos** quando surgirem grupos naturais. Se todos os termos são de uma área coesa, uma lista plana serve.

## Um contexto vs múltiplos contextos

**Contexto único (a maioria dos casos):** um `CONTEXT.md` na raiz.

**Múltiplos contextos:** um `CONTEXT-MAP.md` na raiz lista os contextos, onde vivem e como se relacionam:

```md
# Mapa de Contextos

## Contextos

- [Pedidos](./src/pedidos/CONTEXT.md): recebe e acompanha pedidos de clientes
- [Faturamento](./src/faturamento/CONTEXT.md): gera faturas e processa pagamentos
- [Expedição](./src/expedicao/CONTEXT.md): separa e envia mercadoria

## Relações

- **Pedidos → Expedição**: Pedidos emite eventos `PedidoCriado`; Expedição consome para iniciar a separação
- **Expedição → Faturamento**: Expedição emite `EnvioDespachado`; Faturamento consome para gerar a fatura
- **Pedidos ↔ Faturamento**: tipos compartilhados de `ClienteId` e `Dinheiro`
```

Regra prática: se existe `CONTEXT-MAP.md`, leia-o para achar os contextos; se só existe um `CONTEXT.md` na raiz, é contexto único; se não existe nenhum, crie um `CONTEXT.md` na raiz preguiçosamente, quando o primeiro termo for resolvido. Havendo vários contextos, infira a qual o tópico atual pertence; se não estiver claro, pergunte.
