# Assistente — como colocar no ar

O assistente responde perguntas sobre a loja em linguagem natural. A tela fica em
`/assistente`; o cérebro é a Edge Function [supabase/functions/assistente](supabase/functions/assistente/index.ts),
que fala com o Gemini.

> ⚠️ **A tela e a função estão escritas, mas nunca fizeram uma chamada de verdade ao
> Gemini.** Não havia chave de API na hora de escrever. O formato da requisição saiu da
> documentação oficial, não de uma resposta real. Espere ajustar alguma coisa na primeira
> execução, e teste antes de mostrar para a cliente.

---

## 1. Pegar a chave do Gemini

1. Acesse https://aistudio.google.com/apikey
2. **Create API key**, escolhendo um projeto do Google Cloud
3. Copie a chave

**Sobre o plano gratuito.** Flash e Flash-Lite continuam gratuitos, com cerca de 5 a 15
requisições por minuto e ~1.000 por dia — folgado para uma loja. O preço é outro: no
gratuito, o Google **pode usar o conteúdo enviado para melhorar os modelos dele**; no
pago, não. É por isso que nenhuma ferramenta do assistente devolve CPF, telefone ou
endereço (veja a seção de privacidade abaixo).

## 2. Guardar a chave no Supabase

A chave **não** vai no `.env` do projeto: tudo que é `VITE_` fica embutido no bundle e
qualquer visitante lê. Ela vive como segredo da função:

```bash
npx supabase login
npx supabase link --project-ref grlnihdfzveqtlimeuax
npx supabase secrets set GEMINI_API_KEY=cole-a-chave-aqui
```

## 3. Publicar a função

```bash
npx supabase functions deploy assistente
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` já existem no ambiente das funções — não precisa
cadastrar.

## 4. Testar

Entre no sistema, abra **Assistente** no menu e pergunte algo como "quanto vendi esse
mês?". Se der erro, veja o log:

```bash
npx supabase functions logs assistente
```

---

## O que ele consegue responder

Quatro ferramentas, todas somente leitura:

| Ferramenta | Responde perguntas como |
|---|---|
| `saldo_da_cliente` | "quanto a Maria ainda me deve?" |
| `vendas_no_periodo` | "quanto vendi esse mês?", "e semana passada?" |
| `parcelas_a_vencer` | "o que vence essa semana?", "quem está atrasado?" |
| `estoque_baixo` | "o que está acabando?" |

Fora disso ele diz que não sabe — de propósito. É melhor do que inventar um número que a
dona vai usar para cobrar alguém.

## Privacidade e segurança

**Nenhuma ferramenta devolve CPF, telefone ou endereço.** Cada `select` na função lista
as colunas explicitamente, e é essa lista que é a fronteira: um `select('*')` naquele
arquivo seria um vazamento. Sai nome da cliente, valor e data — o necessário para
responder sobre dinheiro e prazo.

**A função não usa `service_role`.** As consultas vão com o token de quem está logado,
então o assistente tem exatamente os privilégios da dona da loja, nem um a mais. Uma
função com `service_role` exposta na internet seria uma chave-mestra atrás de um
endereço: quem descobrisse a URL leria o banco inteiro, RLS ignorado.

**Sem sessão válida, a função recusa** com 401 antes de chamar o Gemini.

## Custo

No plano gratuito, zero. Se um dia passar do limite de requisições, a resposta vem como
erro 429 pedindo para esperar um minuto — nada quebra nem gera cobrança surpresa.

Se optar pelo plano pago (que não usa seus dados para treino), uma pergunta típica gasta
uns 2 mil tokens de entrada e 200 de saída. No Flash-Lite isso dá fração de centavo por
pergunta.

## Limites conhecidos

- **Só consulta.** Não registra pagamento nem altera nada, e a instrução do sistema manda
  ele dizer isso quando pedirem.
- **Sem memória entre perguntas.** Cada pergunta é independente; "e no mês passado?" não
  entende o contexto da anterior. Dá para acrescentar depois.
- **Resposta de IA pode errar.** O rodapé da tela avisa isso. Os números saem das
  ferramentas, não da imaginação do modelo, mas a interpretação da pergunta pode falhar —
  conferir na tela antes de cobrar alguém continua valendo.
