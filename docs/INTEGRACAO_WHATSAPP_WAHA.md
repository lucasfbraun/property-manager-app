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

Implementado de forma mais simples do que o rascunho original previa: em vez
de uma tabela `reminders` separada com historico completo, `charges` ganhou
duas colunas aditivas (`last_reminder_event`, `last_reminder_sent_at`,
provisionadas em `ensureRentalDatabase`). Antes de enviar, o sweep
(`runReminderSweep` em `app/lib/reminders.ts`) compara o evento desejado com
`last_reminder_event`: se for igual e nao for `after_due`, pula (ja foi
enviado); se for `after_due`, so pula se `last_reminder_sent_at` for mais
recente que `AFTER_DUE_RESEND_DAYS` (3 dias). Guarda so o ultimo evento/data,
nao um historico completo de todos os envios — suficiente para evitar
duplicidade, mas sem auditoria de envios passados (poderia virar uma tabela
`reminders` completa depois, se for necessario auditar).

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
X-Api-Key: <WAHA_API_KEY>
```

(Confirmado contra a instancia real do WAHA rodando na AWS: o header correto
e' `X-Api-Key`, nao `Authorization: Bearer` como rascunhado originalmente
aqui — a doc oficial do WAHA usa `X-Api-Key` para autenticar as rotas
`/api/...`.)

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

Implementado e ativo (12/07/2026):

- WAHA rodando self-hosted numa instancia AWS Lightsail (Ubuntu + Docker),
  sem HTTPS por decisao explicita (ver `WAHA-DEPLOY.md` para o guia completo
  e o risco aceito de trafego em texto puro entre a Cloudflare e a AWS).
- `sendPaymentReminder()` em `app/lib/integrations.ts` chama de fato o WAHA
  (`POST {WAHA_BASE_URL}/api/sendText`, header `X-Api-Key`).
- `runReminderSweep()` em `app/lib/reminders.ts` roda dentro do `scheduled()`
  do Worker (`worker/index.ts`), logo apos `runMonthlyChargeSweep()`, todo dia.
- Botao manual "Enviar lembrete WhatsApp" em Cadastros (`/api/charges/send-reminder`)
  para disparar na hora, sem esperar o cron.
- `payment_confirmed` disparado tanto pelo webhook do Mercado Pago quanto pelo
  fallback manual "Verificar pagamento".
- `contract_expiring` disparado quando um contrato e' salvo com status
  "Vence em breve" (uma unica vez, ver `contracts.expiring_reminder_sent_at`).
- Variaveis `WAHA_BASE_URL` e `WAHA_SESSION` em `wrangler.jsonc` (vars);
  `WAHA_API_KEY` deve ser configurado via `wrangler secret put WAHA_API_KEY`
  (nao commitado).
- `APP_BASE_URL` tambem configurado em `wrangler.jsonc`, usado para montar o
  link de pagamento dentro da mensagem.

Pendente/possivel melhoria futura: tabela de historico completo de envios
(hoje so guarda o ultimo evento por cobranca, ver secao acima); preferencia
de inquilino para desativar lembretes; HTTPS entre a Cloudflare e o WAHA.

## Fontes oficiais

- WAHA docs: https://waha.devlike.pro/docs/
- WAHA send messages: https://waha.devlike.pro/docs/how-to/send-messages/
