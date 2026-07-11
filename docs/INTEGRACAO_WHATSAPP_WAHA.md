# Integracao WhatsApp com WAHA via Cron Trigger (sem n8n)

## Decisao

A ideia original (`docs/INTEGRACAO_WHATSAPP_WAHA_N8N.md`, mantido apenas como
historico) usava o n8n como orquestrador entre o monolito e o WAHA.

Essa camada foi removida do escopo: a aplicacao e simples o suficiente para
que o proprio **Cron Trigger da Cloudflare** (o mesmo mecanismo que ja gera a
cobranca mensal, ver `worker/index.ts` e `app/lib/charge-scheduler.ts`) chame
o WAHA diretamente por HTTP. Menos pecas, menos infraestrutura para manter e
depender, adequado ao volume baixo de mensagens esperado.

## Fluxo

1. Cron Trigger diario do Worker roda (mesmo `scheduled()` de
   `worker/index.ts`, ou um novo horario dedicado a lembretes).
2. Uma rotina no monolito (a implementar; ex. `runWhatsAppReminderSweep()`)
   varre as cobrancas e decide o evento a disparar, reaproveitando a mesma
   logica de datas de `charge-scheduler.ts`:
   - `before_due`: lembrete antes do vencimento.
   - `due_day`: aviso no dia do vencimento.
   - `after_due`: aviso de atraso com multa/juros calculados.
   - `payment_confirmed`: confirmacao de pagamento.
   - `contract_expiring`: contrato proximo do vencimento.
3. Monta o texto da mensagem (reaproveitando `buildReminderText`, ja existente
   em `app/lib/integrations.ts`).
4. Chama diretamente `POST {WAHA_BASE_URL}/api/sendText`, com o header de
   autenticacao do WAHA — sem orquestrador no meio.
5. Registra sucesso/falha (log por enquanto; uma tabela de historico de
   lembretes, equivalente a `reminders` no schema, pode ser ligada depois se
   for necessario auditar envios).

## Regua de disparo (cadencia)

Decisao de negocio (11/07/2026): o cron roda uma vez ao dia e, para cada
cobranca em aberto, compara a data de hoje com o vencimento (mesmo calculo ja
usado em `charge-scheduler.ts` para multa/juros) e decide:

| Situacao | Evento | Regra |
|---|---|---|
| Faltam 5 dias para o vencimento | `before_due` | Dispara uma unica vez, no dia em que a diferenca for exatamente 5 dias. |
| Dia do vencimento | `due_day` | Dispara uma unica vez, no dia do vencimento. |
| Vencida e ainda em aberto | `after_due` | Dispara no 1º dia de atraso e depois se repete **a cada 3 dias** enquanto a cobranca nao for paga ou cancelada (ex.: dias 1, 4, 7, 10...). |
| Pagamento confirmado | `payment_confirmed` | Dispara uma unica vez, quando o webhook do Mercado Pago confirma o pagamento. |

A cadencia de 3 em 3 dias no atraso e um padrao inicial, pensado para nao
incomodar o inquilino com mensagem diaria; pode ser ajustada depois sem mudar
a arquitetura (e so um numero de configuracao).

### Evitando duplicidade

Como o cron roda 1x por dia mas pode ser reexecutado manualmente (teste,
retry apos falha), o disparo precisa checar se aquele evento especifico ja
foi enviado antes de mandar de novo. Para isso, cada envio bem-sucedido deve
ficar registrado (tabela `reminders` do schema, hoje modelada mas nunca
criada em runtime — precisa ser provisionada em `ensureRentalDatabase`, no
mesmo padrao aditivo das demais tabelas) com `charge_id + event + data do
envio`. Antes de enviar, a rotina verifica se ja existe um registro para
aquele `charge_id + event` dentro da janela esperada (mesmo dia para
`before_due`/`due_day`/`payment_confirmed`; dentro dos ultimos 3 dias para
`after_due`) e pula o envio se ja existir.

## Variaveis de ambiente

Apenas no monolito (nao ha mais n8n, logo nao ha mais segredo de webhook do
n8n):

```env
WAHA_BASE_URL=http://waha:3000
WAHA_API_KEY=trocar-por-token-do-waha
WAHA_SESSION=default
```

## Payload direto para o WAHA

Endpoint WAHA:

```http
POST /api/sendText
Authorization: Bearer <WAHA_API_KEY>
```

Body:

```json
{
  "session": "default",
  "chatId": "5511999990002@c.us",
  "text": "Ola, Rafael Lima. Identificamos aluguel em atraso no valor atualizado de R$ 2.486,75. Acesse o link para pagamento: https://app.exemplo.com/pagar/chg-2026-06-1002"
}
```

Observacao: o telefone brasileiro deve ser normalizado para numeros, com
codigo do pais, seguido de `@c.us` (ja existe `normalizeBrazilianPhoneToWahaChatId`
em `app/lib/integrations.ts` para isso). Exemplo: `+55 11 99999-0002` vira
`5511999990002@c.us`.

## Regras de negocio

- O inquilino pode ter lembrete desativado (a implementar).
- Nao enviar mensagem para cobranca cancelada.
- Nao enviar cobranca em atraso se ela ja foi paga.
- O link de pagamento deve apontar para a cobranca atualizada.
- A mensagem de atraso deve usar valor com multa e juros calculados.
- Evitar duplicidade por `chargeId + event + data` (idempotencia do envio).

## Regras de seguranca

- Nao colocar o token do WAHA no frontend; a chamada e feita apenas pelo
  Cron Trigger, dentro do Worker (server-side).
- Usar HTTPS em producao para o `WAHA_BASE_URL`.
- Registrar cada tentativa de envio (log estruturado no minimo).

## Status

Planejado e documentado; o envio real ainda depende de:

- Implementar `runWhatsAppReminderSweep()` (ou nome equivalente) e ligar a um
  Cron Trigger em `wrangler.jsonc`.
- Substituir o stub `sendPaymentReminder()` em `app/lib/integrations.ts`, que
  hoje so lanca erro "Integracao WhatsApp pendente".
- Configurar os secrets `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION` no
  ambiente Cloudflare Workers.

## Fontes oficiais

- WAHA docs: https://waha.devlike.pro/docs/
- WAHA send messages: https://waha.devlike.pro/docs/how-to/send-messages/
