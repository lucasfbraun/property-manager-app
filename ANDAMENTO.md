# Andamento do projeto — Gestao de Alugueis

Ultima atualizacao: 12/07/2026

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
- Tokens de acesso/refresh de cada recebedor ficam salvos no banco (nunca expostos ao cliente); a UI de recebedores mostra um selo de diagnostico com `mp_user_id` e se o token e de **producao** ou **teste** (`mp_live_mode`).
- Renovacao automatica de token com margem de seguranca de 5 minutos.
- Criacao de cobranca Pix com chave de idempotencia (`X-Idempotency-Key`) e com `payer.identification` (CPF/CNPJ do inquilino), exigido pela API do Mercado Pago.
- Webhook do Mercado Pago valida assinatura HMAC e registra pagamento de forma idempotente (checa `external_id` antes de inserir).
- **Botao "Verificar pagamento"** (tela `/cadastros`, por contrato): fallback manual que consulta a cobranca Pix diretamente na API do Mercado Pago e marca como paga, para cobrir os casos em que o webhook nao chegou (ex.: URL de webhook configurada so em "Modo teste", nao em "Modo producao"). Rota: `POST /api/charges/sync-payment`.
- **Recibo de pagamento (PDF)**: no portal do inquilino (`/inquilino`), a cobranca com status "Paga" ganha um link "Recibo" que gera um PDF (`app/lib/receipt-pdf.ts`, rota `GET /api/charges/receipt`) com o texto fixo padrao fornecido pelo cliente; so fica disponivel quando a cobranca esta paga.

**Validacao real:** o fluxo de sandbox do Mercado Pago se mostrou instavel para esta combinacao de marketplace + usuario de teste (varios erros diferentes mesmo com OAuth/credenciais corretos, confirmado via o selo de diagnostico). Decisao tomada em 11/07/2026: abandonar o debug de sandbox e validar com um **pagamento Pix real de R$ 1,00**, que foi criado, pago e confirmado com sucesso (via o botao "Verificar pagamento", ja que o webhook de producao ainda nao estava configurado).

**Risco em aberto:** apenas **uma** transacao Pix real (R$ 1,00) foi validada ate agora. Recomenda-se rodar mais algumas cobrancas reais de baixo valor antes de confiar o fluxo inteiro a producao sem supervisao.

## 6. Geracao de cobranca mensal

- Geracao **manual**: botao "Gerar cobranca" na tela de contratos, chama `POST /api/charges/generate`.
- Geracao **automatica**: Cron Trigger diario (09:00 horario de Brasilia) no Worker, que varre os contratos ativos e cria a cobranca do mes quando faltam **5 dias** para o vencimento (com janela de reprocessamento de ate 3 dias em atraso, para cobrir eventuais falhas do cron).
- Checagem de duplicidade por `contract_id` + referencia do mes antes de inserir.

## 7. O que ainda falta / gaps conhecidos

- Lembretes via WhatsApp: implementado e ativo (12/07/2026) — ver secao 9c. Pendente apenas: preferencia do inquilino para desativar lembretes, historico completo de envios (hoje so guarda o ultimo por cobranca) e HTTPS entre a Cloudflare e o WAHA (rodando sem SSL por decisao explicita, ver `WAHA-DEPLOY.md`).
- Autoatendimento de troca de senha pelo proprio usuario: nao existe.
- Tela para editar ou cancelar uma cobranca ja gerada: nao existe (hoje so ha geracao). O valor de um rateio ja aplicado a uma cobranca tambem nao pode ser removido pela UI hoje.
- Webhook de producao do Mercado Pago: precisa ser configurado no painel do Mercado Pago (hoje so o "Modo teste" esta configurado); ate la, o fluxo depende do botao manual "Verificar pagamento".
- Apenas uma transacao Pix real (R$ 1,00) foi validada — ver risco na secao 5.
- Confirmacao visual da responsividade mobile via navegador (Chrome): revisao de codigo feita e ajustes aplicados (tabela de contratos, fotos de vistoria), mas a verificacao visual ao vivo ainda depende da extensao Chrome estar conectada.
- Teste de ponta a ponta ao vivo da aplicacao publicada: pendente.
- Relatorios exportaveis (dashboard existe, exportacao ainda nao).

## 8. Vistoria fotografica, ocorrencias e responsividade mobile

- **Vistoria fotografica**: no contrato, o admin registra fotos da vistoria do imovel (`app/contratos/InspectionPhotosManager.tsx`), com upload direto pela camera do celular (`capture="environment"` no input de arquivo) e opcao de remover uma foto.
- **Registro de ocorrencias**: inquilino pode registrar ocorrencias (com foto, mesmo mecanismo `capture="environment"`) pelo portal.
- **Mobile**: revisao de codigo confirmou uso consistente de breakpoints Tailwind (`sm:`/`md:`/`xl:`) e `overflow-x-auto` nas tabelas. Dois problemas reais foram encontrados e corrigidos:
  - Botao "Remover" das fotos de vistoria so aparecia com `:hover` (invisivel em touch) — corrigido para ficar sempre visivel em telas pequenas (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`).
  - Coluna de acoes da tabela de contratos (`/cadastros`) foi reformulada: em telas `sm:` para cima continua como botoes inline; em mobile vira um menu suspenso "Acoes ...", evitando quebra de layout.
- Verificacao visual ao vivo (via extensao Chrome) ainda pendente — ver secao 7.

## 9. Rateios entre imoveis (despesas compartilhadas, opcional)

Feature nova (11/07/2026, generalizada no mesmo dia), pensada para o cenario de multiplos imoveis de um mesmo proprietario/condominio compartilhando uma despesa (agua, condominio, gas, internet, IPTU ou qualquer outra — nao ficou restrito a agua):

1. Tela `/rateios` (admin): escolhe a **categoria da despesa** (lista sugerida + "Outro" com descricao livre), o mes de referencia, o valor total, quais imoveis participam do rateio e, opcionalmente, anexa o comprovante (JPG/PNG/PDF, ate 8MB, guardado no **R2**).
2. O valor total e dividido entre os imoveis selecionados — **igualmente** ou **proporcional ao numero de moradores** de cada imovel (o admin escolhe o modo; ve uma pre-visualizacao do valor por imovel antes de confirmar). Numero de moradores vem de um campo novo no cadastro do inquilino ("Quantidade de moradores").
3. Se a cobranca do mes daquele imovel **ja existir**, a parcela e somada na hora ao valor da cobranca (`charges.original_amount`, com o valor tambem guardado separadamente em `charges.rateio_amount` para transparencia).
4. Se a cobranca **ainda nao existir**, o rateio fica pendente e e aplicado automaticamente quando a cobranca do mes for gerada (manual ou via cron) — integrado em `app/lib/charge-scheduler.ts`.
5. O inquilino ve, no portal, quando a cobranca em aberto inclui uma parcela de rateio.
6. Historico de rateios (com categoria, descricao, detalhamento por imovel e link para o comprovante anexado) fica listado na propria tela `/rateios`.

Implementacao em `app/lib/rateios.ts` (tabelas `rateios` e `rateio_allocations`); rota `app/api/rateios`.

## 9b. Chat de ajuda do painel admin

Feature nova (12/07/2026): botao "?" flutuante, presente so nas telas do admin (Dashboard, Cadastros, Contratos, Rateios, Integracoes) — **nao aparece no portal do inquilino nem no do recebedor**.

- **Sem IA externa**: e uma busca por palavras-chave contra um FAQ estatico (`app/lib/help-content.ts`), servida por `POST /api/help/search` (admin-only). Nao ha chamada a nenhuma API de IA (Claude, OpenAI etc.) e nenhum custo por mensagem.
- **Nunca acessa dados reais**: a busca so roda sobre o texto fixo do FAQ — nunca consulta o banco (tenants, contracts, charges, tokens do Mercado Pago). Isso elimina de saida o risco de vazar dado sensivel pelo chat.
- O conteudo do FAQ espelha o `MANUAL-ADMIN.md` (na raiz do projeto), que documenta objetivamente cada funcionalidade do painel: cadastro de inquilino/imovel/recebedor, conexao com o Mercado Pago, contratos e modelos, vistoria, assinatura, ocorrencias, cobranca e Pix, verificar pagamento, recibo, rateios, dashboard e integracoes. Ao adicionar/alterar uma funcionalidade, atualizar os dois (manual + `help-content.ts`) para o chat continuar respondendo certo.

## 9c. Lembretes via WhatsApp (WAHA)

Feature nova (12/07/2026): envio real de lembretes de cobranca por WhatsApp, sem orquestrador (n8n) no meio — ver decisao completa em `docs/INTEGRACAO_WHATSAPP_WAHA.md` e o guia de infraestrutura em `WAHA-DEPLOY.md`.

- **Infraestrutura**: WAHA (WhatsApp HTTP API) self-hosted numa instancia AWS Lightsail (Ubuntu + Docker), rodando sem HTTPS por decisao explicita do usuario (risco aceito: trafego em texto puro entre Cloudflare e AWS — ver apendice de `WAHA-DEPLOY.md` para adicionar SSL depois via Cloudflare).
- **Disparo manual**: botao "Enviar lembrete WhatsApp" na tela `/cadastros` (contratos) — manda na hora o evento que fizer sentido para a cobranca mais recente daquele contrato (antes do vencimento, no dia, atraso ou pagamento confirmado).
- **Disparo automatico**: `runReminderSweep()` (`app/lib/reminders.ts`) roda todo dia dentro do mesmo Cron Trigger que gera as cobrancas (`worker/index.ts`). Regua: aviso 5 dias antes do vencimento, aviso no dia, e em atraso repete a cada 3 dias ate a cobranca ser paga (dedupe via `charges.last_reminder_event`/`last_reminder_sent_at`, guardando so o ultimo evento por cobranca).
- **Pagamento confirmado**: disparado tanto pelo webhook do Mercado Pago quanto pelo fallback manual "Verificar pagamento".
- **Contrato vencendo**: disparado uma unica vez quando um contrato e salvo com status "Vence em breve" (`contracts.expiring_reminder_sent_at` evita repeticao).

Pendente: preferencia do inquilino para desativar lembretes, historico completo de envios (auditoria), e HTTPS entre a Cloudflare e o WAHA.

## 10. Configuracao e segredos necessarios

Variaveis/segredos que precisam estar configurados no ambiente Cloudflare Workers:

- `RESEND_API_KEY` — chave da API do Resend (envio de e-mail).
- `RESEND_FROM_EMAIL` — remetente usado nos e-mails.
- `MP_CLIENT_ID` — client id da aplicacao Mercado Pago.
- `MP_CLIENT_SECRET` — client secret da aplicacao Mercado Pago (tambem usado para assinar o parametro `state` do OAuth).
- `MP_WEBHOOK_SECRET` — segredo para validar a assinatura HMAC dos webhooks do Mercado Pago.
- `WAHA_API_KEY` — chave da instancia WAHA (configurar via `wrangler secret put WAHA_API_KEY`, nunca commitar em `wrangler.jsonc`).

Vars (ja em `wrangler.jsonc`, nao sao segredos):

- `WAHA_BASE_URL` — endpoint da instancia WAHA na AWS Lightsail.
- `WAHA_SESSION` — nome da sessao do WhatsApp conectada no WAHA (`default`).
- `APP_BASE_URL` — URL publica do Worker, usada para montar o link de pagamento nas mensagens de WhatsApp.

Bindings de infraestrutura (ja configurados em `wrangler.jsonc`):

- D1: `DB` (banco `property-manager-db`).
- R2: `SIGNED_CONTRACTS` (bucket `property-manager-signed-contracts`).
- Cron: `0 12 * * *` (09:00 America/Sao_Paulo).

## 11. Historico de entregas

Toda a implementacao inicial do projeto foi entregue em um unico dia (05/07/2026), conforme o historico de commits:

| Data | Hora | Entrega |
|---|---|---|
| 05/07/2026 | 12:49 | Subida inicial da aplicacao |
| 05/07/2026 | 16:06–17:22 | Ajustes de deploy Cloudflare (wrangler, D1, correcoes de arquivo) |
| 05/07/2026 | 17:45–18:28 | Autenticacao por sessao (admin, inquilino, recebedor) + tema escuro |
| 05/07/2026 | 18:46 | Seguranca das rotas de API + edicao completa nos CRUDs |
| 05/07/2026 | 19:16–19:24 | Templates de contrato, assinatura do inquilino, aprovacao pelo admin + migracao do PDF assinado para R2 |
| 05/07/2026 | 19:52 | Cobranca Pix real via Mercado Pago (OAuth por recebedor) |
| 05/07/2026 | 23:43 | Geracao de cobranca mensal (manual + automatica via cron) |
| 11/07/2026 | — | Vistoria fotografica e registro de ocorrencias (com fotos via camera do celular) |
| 11/07/2026 | — | Correcao de bug: alteracao de e-mail do inquilino nao atualizava o login vinculado |
| 11/07/2026 | — | Diagnostico e resolucao da instabilidade do sandbox Mercado Pago; validacao com pagamento Pix real de R$ 1,00 |
| 11/07/2026 | — | Botao "Verificar pagamento" (fallback manual ao webhook) + recibo de pagamento em PDF no portal do inquilino |
| 11/07/2026 | — | Ajustes de responsividade mobile (tabela de contratos, fotos de vistoria) |
| 11/07/2026 | — | Rateio de agua entre imoveis (`/rateio-agua`), depois generalizado para rateios de qualquer despesa compartilhada (`/rateios`) |
| 11/07/2026 | — | Revisao e atualizacao do cronograma e da documentacao de andamento |
| 11/07/2026 | — | Correcao do menu lateral inacessivel no celular + revisao de responsividade mobile em todo o app |
| 11/07/2026 | — | Quantidade de moradores no cadastro do inquilino + rateio proporcional a moradores |
| 12/07/2026 | — | Chat de ajuda (busca por palavras-chave, sem IA externa) no painel admin |
| 12/07/2026 | — | Deploy do WAHA self-hosted na AWS Lightsail + envio real de lembretes de cobranca por WhatsApp (manual e automatico via cron) |
