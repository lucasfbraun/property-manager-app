# Integracao WhatsApp com WAHA e n8n

## Objetivo

Usar o n8n como orquestrador da regua de comunicacao e o WAHA como gateway HTTP para envio das mensagens de WhatsApp.

O monolito continua responsavel por:

- Identificar cobrancas abertas, vencidas e pagas.
- Calcular multa, juros e valor atualizado.
- Decidir qual evento de comunicacao deve ser disparado.
- Registrar historico de lembretes.
- Enviar um payload padronizado para o webhook do n8n.

O n8n fica responsavel por:

- Receber o evento do monolito.
- Montar ou ajustar a mensagem.
- Aplicar regras adicionais de horario, tentativas e filtros.
- Chamar o WAHA para envio no WhatsApp.
- Receber retorno do envio e, futuramente, notificar o monolito.

O WAHA fica responsavel por:

- Manter a sessao conectada ao WhatsApp.
- Enviar a mensagem para o `chatId` correto.
- Expor endpoints HTTP para o n8n.

## Fluxo recomendado

1. Job do monolito identifica cobrancas que precisam de lembrete.
2. Monolito monta o payload do evento.
3. Monolito envia `POST` para o Webhook de producao do n8n.
4. n8n valida segredo/header do evento.
5. n8n formata a mensagem final.
6. n8n chama o WAHA em `POST /api/sendText`.
7. WAHA envia mensagem usando a sessao configurada.
8. n8n registra sucesso/falha.
9. n8n pode chamar uma rota futura do monolito para atualizar status do lembrete.

## Eventos da regua de cobranca

- `before_due`: lembrete antes do vencimento.
- `due_day`: lembrete no dia do vencimento.
- `after_due`: aviso de atraso com valor atualizado.
- `payment_confirmed`: confirmacao de pagamento.
- `contract_expiring`: aviso de contrato proximo do vencimento.

## Variaveis de ambiente

No monolito:

```env
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.seudominio.com/webhook/alugueis-whatsapp
N8N_WHATSAPP_WEBHOOK_SECRET=trocar-por-um-segredo-forte
```

No n8n:

```env
WAHA_BASE_URL=http://waha:3000
WAHA_API_KEY=trocar-por-token-do-waha
WAHA_SESSION=default
```

## Payload do monolito para o n8n

```json
{
  "source": "rentals-monolith",
  "provider": "waha",
  "event": "after_due",
  "chargeId": "chg-2026-06-1002",
  "tenantName": "Rafael Lima",
  "tenantPhone": "+55 11 99999-0002",
  "amount": 2486.75,
  "dueDate": "2026-06-10",
  "daysLate": 16,
  "paymentUrl": "https://app.exemplo.com/pagar/chg-2026-06-1002",
  "receiverName": "Guilherme",
  "requestedAt": "2026-06-29T12:00:00.000Z"
}
```

Enviar tambem um header de seguranca:

```http
X-Rentals-Webhook-Secret: trocar-por-um-segredo-forte
```

## Payload do n8n para o WAHA

Endpoint WAHA:

```http
POST /api/sendText
```

Body:

```json
{
  "session": "default",
  "chatId": "5511999990002@c.us",
  "text": "Ola, Rafael Lima. Identificamos aluguel em atraso no valor atualizado de R$ 2.486,75. Acesse o link para pagamento: https://app.exemplo.com/pagar/chg-2026-06-1002"
}
```

Observacao:

- O telefone brasileiro deve ser normalizado para numeros, com codigo do pais, seguido de `@c.us`.
- Exemplo: `+55 11 99999-0002` vira `5511999990002@c.us`.

## Workflow sugerido no n8n

Nos do workflow:

1. Webhook
2. IF: validar `X-Rentals-Webhook-Secret`
3. Set: normalizar campos
4. Function ou Code: montar `chatId` e texto
5. HTTP Request: chamar WAHA `POST /api/sendText`
6. IF: sucesso/falha
7. HTTP Request opcional: retornar status ao monolito

## Regras de seguranca

- Nao deixar o webhook do n8n sem segredo.
- Usar HTTPS em producao.
- Nao colocar token do WAHA no frontend.
- Permitir envio apenas pelo n8n ou por rede interna.
- Registrar cada tentativa de envio.
- Evitar duplicidade por `chargeId + event + data`.

## Regras de negocio

- O inquilino pode ter lembrete desativado.
- Nao enviar mensagem para cobranca cancelada.
- Nao enviar cobranca em atraso se ela ja foi paga.
- O link de pagamento deve apontar para a cobranca atualizada.
- A mensagem de atraso deve usar valor com multa e juros calculados.
- Mensagens devem respeitar horario configurado.

## Fontes oficiais

- WAHA docs: https://waha.devlike.pro/docs/
- WAHA send messages: https://waha.devlike.pro/docs/how-to/send-messages/
- WAHA com n8n: https://waha.devlike.pro/docs/integrations/n8n/
- n8n Webhook node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

