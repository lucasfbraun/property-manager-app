# Andamento do projeto — Gestao de Alugueis

Ultima atualizacao: 05/07/2026

## 1. Stack real (diferente da proposta original)

O documento original (`outputs/instrucoes-aplicacao-alugueis.md`) recomendava Laravel/Django + PostgreSQL.
A aplicacao foi efetivamente construida sobre outra stack, hospedada na Cloudflare:

- **vinext** (framework compativel com Next.js App Router, rodando sobre Vite + React Server Components) — nao e o Next.js/Vercel oficial.
- **Cloudflare Workers** como runtime de producao.
- **D1** (SQLite gerenciado pela Cloudflare) como banco relacional principal.
- **R2** (object storage compativel com S3) para armazenar os PDFs de contrato assinados.
- **Cron Triggers** da Cloudflare para a geracao automatica mensal de cobrancas.
- Deploy atual: `https://property-manager.lucasfbraun.workers.dev`.

Toda a configuracao de bindings (D1, R2, cron) fica centralizada em `wrangler.jsonc`.

## 2. Autenticacao

- Login por sessao (cookie), senha com hash PBKDF2-SHA256.
- Tres papeis: `admin`, `tenant` (inquilino), `receiver` (recebedor).
- `requireUser()` para paginas (redireciona se nao autorizado) e `requireApiUser()` para rotas de API (retorna 401 em JSON) — ambos em `app/lib/session.ts`.
- Todas as rotas de API de CRUD (`tenants`, `properties`, `receivers`, `contracts`, `rentals`) exigem `admin` autenticado.

## 3. CRUDs (inquilinos, imoveis, recebedores, contratos)

Status: **funcionais**, com criacao, edicao completa, exclusao (com guarda de vinculos) e validacao de campos obrigatorios em todas as entidades. Revisados via auditoria de codigo em 05/07/2026 (testes ao vivo no navegador nao foram possiveis nesta sessao por indisponibilidade da extensao Chrome; recomenda-se um teste manual de ponta a ponta antes de considerar encerrado).

Pontos confirmados na auditoria:
- Formularios desabilitam os botoes durante o salvamento (`isSaving`) e mostram estado de carregamento.
- Exclusao possui checagem de dependencias (ex.: nao apaga imovel/inquilino com contrato ativo vinculado).
- Erros de validacao retornam mensagem clara ao usuario.

## 4. Contratos: templates, geracao e assinatura eletronica

Fluxo implementado (fora do escopo do MVP original, adicionado por solicitacao explicita):

1. Admin cadastra um ou mais **templates nomeados** de contrato, com variaveis no formato `{{chave}}` (17 variaveis suportadas, ex.: nome do inquilino, endereco, valor do aluguel, data de vencimento etc.).
2. Admin gera o contrato preenchido para um inquilino especifico a partir de um template.
3. Inquilino visualiza o contrato no proprio portal e faz o "download" em PDF (via impressao do navegador — `window.print()`, sem dependencia nova).
4. Inquilino faz upload do contrato assinado (arquivo enviado para o **R2**, chave `contracts/{contractId}/{timestamp}-{nome}`, limite de 15MB).
5. Upload assinado aparece em uma fila separada de aprovacao para o admin.
6. Ao aprovar ou rejeitar, o status do contrato e atualizado e um e-mail (via **Resend**) e disparado tanto para o inquilino quanto para o recebedor/administrador responsavel.

Status possiveis: `not_generated`, `awaiting_signature`, `in_review`, `approved`, `rejected`.

O armazenamento do PDF assinado foi migrado de blob no D1 para o **Cloudflare R2** (bucket `property-manager-signed-contracts`), por ser mais barato e adequado ao volume esperado (poucos contratos).

## 5. Cobranca via Pix (Mercado Pago)

- Cada recebedor conecta sua **propria conta Mercado Pago** via OAuth (modelo marketplace/split), nao ha conta central unica.
- Credenciais iniciam em modo **sandbox**.
- Tokens de acesso/refresh de cada recebedor ficam salvos no banco (nunca expostos ao cliente — apenas um booleano `mpConnected` e enviado ao front-end).
- Renovacao automatica de token com margem de seguranca de 5 minutos.
- Criacao de cobranca Pix com chave de idempotencia (`X-Idempotency-Key`).
- Webhook do Mercado Pago valida assinatura HMAC e registra pagamento de forma idempotente (checa `external_id` antes de inserir).

**Risco conhecido:** o fluxo completo (OAuth + criacao de cobranca + webhook) ainda **nao foi testado contra o ambiente sandbox real** do Mercado Pago nesta sessao.

## 6. Geracao de cobranca mensal

- Geracao **manual**: botao "Gerar cobranca" na tela de contratos, chama `POST /api/charges/generate`.
- Geracao **automatica**: Cron Trigger diario (09:00 horario de Brasilia) no Worker, que varre os contratos ativos e cria a cobranca do mes quando faltam **5 dias** para o vencimento (com janela de reprocessamento de ate 3 dias em atraso, para cobrir eventuais falhas do cron).
- Checagem de duplicidade por `contract_id` + referencia do mes antes de inserir.

## 7. O que ainda falta / gaps conhecidos

- Lembretes automaticos via WhatsApp (Cron Trigger da Cloudflare chamando o WAHA diretamente, sem n8n — decisao simplificada em 11/07/2026, ver `docs/INTEGRACAO_WHATSAPP_WAHA.md`): ainda nao implementado, so planejado. Regua ja definida: aviso 5 dias antes do vencimento, aviso no dia do vencimento e, em caso de atraso, repeticao a cada 3 dias ate a cobranca ser paga ou cancelada.
- Autoatendimento de troca de senha pelo proprio usuario: nao existe.
- Tela para editar ou cancelar uma cobranca ja gerada: nao existe (hoje so ha geracao).
- Teste de ponta a ponta ao vivo da aplicacao publicada: pendente.
- Teste do fluxo Pix/Mercado Pago contra o sandbox real: pendente.
- Relatorios exportaveis (dashboard existe, exportacao ainda nao).

## 8. Configuracao e segredos necessarios

Variaveis/segredos que precisam estar configurados no ambiente Cloudflare Workers:

- `RESEND_API_KEY` — chave da API do Resend (envio de e-mail).
- `RESEND_FROM_EMAIL` — remetente usado nos e-mails.
- `MP_CLIENT_ID` — client id da aplicacao Mercado Pago.
- `MP_CLIENT_SECRET` — client secret da aplicacao Mercado Pago (tambem usado para assinar o parametro `state` do OAuth).
- `MP_WEBHOOK_SECRET` — segredo para validar a assinatura HMAC dos webhooks do Mercado Pago.

Bindings de infraestrutura (ja configurados em `wrangler.jsonc`):

- D1: `DB` (banco `property-manager-db`).
- R2: `SIGNED_CONTRACTS` (bucket `property-manager-signed-contracts`).
- Cron: `0 12 * * *` (09:00 America/Sao_Paulo).

## 9. Historico de entregas (05/07/2026)

Toda a implementacao real do projeto foi entregue em um unico dia, conforme o historico de commits:

| Hora | Entrega |
|---|---|
| 12:49 | Subida inicial da aplicacao |
| 16:06–17:22 | Ajustes de deploy Cloudflare (wrangler, D1, correcoes de arquivo) |
| 17:45–18:28 | Autenticacao por sessao (admin, inquilino, recebedor) + tema escuro |
| 18:46 | Seguranca das rotas de API + edicao completa nos CRUDs |
| 19:16–19:24 | Templates de contrato, assinatura do inquilino, aprovacao pelo admin + migracao do PDF assinado para R2 |
| 19:52 | Cobranca Pix real via Mercado Pago (OAuth por recebedor) |
| 23:43 | Geracao de cobranca mensal (manual + automatica via cron) |
