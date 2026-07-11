# Análise: Cronograma vs. Código Real + Pontos de Melhoria

Data da análise: 11/07/2026
Base: `ANDAMENTO.md`, `outputs/instrucoes-aplicacao-alugueis.md`, `work/build_cronograma_alugueis.mjs` (gera `outputs/cronograma-aplicacao-alugueis.xlsx`), e leitura direta do código em `app/`, `worker/`, `db/`, `drizzle/`.

## 1. O cronograma oficial está desatualizado

O cronograma real do projeto é o Excel gerado por `work/build_cronograma_alugueis.mjs` (12 fases, de 01/07 a 24/11/2026). Comparando os status gravados nesse script com o que o código realmente entrega hoje (documentado em `ANDAMENTO.md`, atualizado em 05/07/2026):

| Fase do cronograma | Status no cronograma | Status real no código |
|---|---|---|
| 2. Arquitetura e base técnica | Em andamento | Concluída (app em produção na Cloudflare) |
| 3. Usuários e permissões | **Não iniciado** | Concluída (login por sessão, 3 papéis, `requireUser`/`requireApiUser`) |
| 4. Cadastros principais | Em andamento | Concluída (CRUD completo com validação e guarda de exclusão) |
| 5. Contratos | Em andamento | Concluída **e ampliada** (ver seção 2) |
| 6. Cobranças e regras financeiras | Em andamento | Concluída (geração manual + cron diário) |
| 7. Mercado Pago Pix | **Não iniciado** | Concluída (OAuth por recebedor, cobrança Pix, refresh de token) |
| 8. Webhooks e conciliação | **Não iniciado** | Concluída (validação HMAC, idempotência) |
| 10. WhatsApp e lembretes | Em andamento | **Não implementado de fato** — só documentação e funções-stub que lançam erro (`sendPaymentReminder`, `createPixCharge` em `integrations.ts`) |

O cronograma não é apenas "não atualizado" — em duas fases (7 e 8) ele diz "Não iniciado" para trabalho que já está pronto e testável, e na fase 10 diz "Em andamento" para algo que, na prática, é 0% funcional (só há planejamento). Recomendo regenerar essa planilha ou aposentá-la em favor do `ANDAMENTO.md` como fonte única de verdade.

## 2. Feito, mas fora do escopo original (nenhuma das 12 fases prevê isso)

- **Templates de contrato + geração + assinatura eletrônica completa**: cadastro de modelos com variáveis `{{chave}}`, geração do texto do contrato, upload do PDF assinado pelo inquilino (R2), fila de aprovação do admin, e-mail de notificação. O próprio `ANDAMENTO.md` já registra isso como "fora do escopo do MVP original", mas vale destacar: o documento de instruções original colocava explicitamente "assinatura digital" e "geração automática completa de contrato" como **pós-MVP** — e isso já foi entregue.
- **E-mail transacional via Resend**: notificações de pagamento confirmado e de contrato enviado para aprovação. O documento original só previa lembretes por WhatsApp; e-mail não estava desenhado em nenhum lugar.
- **Tema claro/escuro** (`ThemeToggle`) — melhoria de UX não pedida em nenhum documento.
- **Migração do PDF assinado de blob no D1 para R2** — decisão técnica de infraestrutura, não registrada no cronograma.
- **Troca completa de stack**: o documento original recomendava Laravel/Django + PostgreSQL; o que foi construído roda em Cloudflare Workers + vinext + D1 + R2. Essa mudança está documentada no `ANDAMENTO.md`, mas não está refletida no cronograma nem no documento de instruções — quem olhar só esses dois documentos originais não sabe que a stack mudou.

## 3. Faltando (confirma o que `ANDAMENTO.md` já lista, mais um item que não estava lá)

Já sinalizados no `ANDAMENTO.md`:
- Envio real de lembrete por WhatsApp (n8n/WAHA).
- Autoatendimento de troca de senha.
- Editar/cancelar uma cobrança já gerada.
- Relatórios exportáveis.
- Teste de ponta a ponta ao vivo e teste do fluxo Pix contra sandbox real.

**Não estava listado, e é um requisito explícito do documento original (seção 9, "Auditoria")**:
- A tabela `audit_logs` existe no schema Drizzle (`db/schema.ts`, migration `0000_solid_ares.sql`), mas **nunca é criada em runtime** (não está em `ensureRentalDatabase()`) e **nenhuma rotina do código escreve nela** — busquei em todo `app/` e não há uma única referência a `audit_logs`. Nenhuma ação sensível (aprovar/rejeitar contrato, editar valores de contrato, gerar cobrança manual) fica registrada com usuário/data/hora. Isso é uma lacuna de negócio que ficou fora do radar do "o que falta".
- A tabela `reminders` também está modelada e nunca é usada (consistente com o WhatsApp ainda não implementado).

## 4. Achados de código para melhoria (auditoria própria)

### Risco concreto de quebra em produção
`ensureRentalDatabase()` (`app/lib/rental-repository.ts`) é o único lugar que garante o schema em runtime, criando com `CREATE TABLE IF NOT EXISTS` + `ensureColumn` todas as tabelas usadas pelo app (`users`, `sessions`, `receivers`, `tenants`, `properties`, `contracts`, `charges`, `contract_templates`...). **A tabela `payments` não está nessa lista.** Ela só existe na migration Drizzle `0000_solid_ares.sql`, que por sua vez está desatualizada (não tem `password_hash`, `sessions`, colunas `mp_*`, colunas de assinatura de contrato — ou seja, ninguém está rodando `db:migrate:remote` como fluxo principal, tudo é recriado ad-hoc pelo próprio código). Se o banco D1 de produção nunca recebeu essa migration específica, o primeiro pagamento Pix confirmado vai falhar no webhook (`recordApprovedPayment` faz `INSERT INTO payments` e a tabela pode não existir). **Correção simples**: mover a criação de `payments` para dentro de `ensureRentalDatabase()`, no mesmo padrão aditivo das demais tabelas.

### Schema Drizzle desalinhado com a realidade
Como nenhuma consulta do app usa o ORM Drizzle (tudo é SQL cru via D1), o `db/schema.ts` e a migration `0000` viraram documentação morta e desatualizada. Vale ou gerar uma migration nova refletindo o schema real (`npm run db:generate`), ou assumir que a fonte da verdade é o SQL manual espalhado em `rental-repository.ts` / `auth-repository.ts` / `contract-documents.ts` e não fingir que o Drizzle está sincronizado.

### Segurança
- **Sem rate limiting no login** (`app/api/auth/login/route.ts`): nenhum limite de tentativas, lockout ou atraso progressivo — abre espaço para força bruta de senha.
- **Webhook do Mercado Pago falha "aberto"**: `validateWebhookSignature` retorna `true` (permite passar) quando `MP_WEBHOOK_SECRET` não está configurado. Se o segredo for esquecido em produção, qualquer requisição não assinada é aceita como pagamento válido. Preferível falhar fechado (rejeitar) e logar como alerta crítico.
- **PBKDF2 com 100.000 iterações**: funcional, mas abaixo da recomendação atual da OWASP (≥600.000 para SHA-256). Considerar aumentar as iterações periodicamente.
- **Sem log de auditoria** (ver seção 3) — relevante mesmo em uso familiar, por rastreabilidade de valores e aprovações.
- **Sessão de 30 dias sem rotação e sem "sair de todos os dispositivos"** para o usuário.

### Robustez / escala
- Upload e download de contrato assinado (`uploadSignedContract` / `getSignedDocumentBlob` em `app/lib/contract-documents.ts`) fazem conversão base64↔bytes manualmente, em memória, sem streaming. Para arquivos perto do limite de 15MB isso significa múltiplas cópias do arquivo na memória do Worker (que tem teto de 128MB) — funciona hoje pelo volume baixo esperado, mas é um ponto frágil se o limite for usado com frequência ou aumentado no futuro.
- O fluxo completo Pix (OAuth + cobrança + webhook) e o e-mail de confirmação nunca foram testados contra o sandbox real do Mercado Pago (já sinalizado no `ANDAMENTO.md`) — recomendo priorizar esse teste antes de qualquer uso com dinheiro real, junto com o cenário de webhook duplicado.

## 5. Recomendações priorizadas

1. **Corrigir a criação da tabela `payments`** dentro de `ensureRentalDatabase()` — risco real de quebra assim que o primeiro Pix for pago, correção rápida.
2. **Testar o fluxo Pix + webhook contra o sandbox real** do Mercado Pago (incluindo webhook duplicado) antes de operar com dinheiro real.
3. **Atualizar ou aposentar o cronograma** (`outputs/cronograma-aplicacao-alugueis.xlsx`) para refletir o status real e evitar decisões baseadas em informação desatualizada.
4. **Decidir sobre o log de auditoria**: para uso familiar pode não ser crítico, mas vale pelo menos registrar aprovação/rejeição de contrato e edições de valores financeiros.
5. **Rate limiting básico no login** e revisão do comportamento "fail-open" do webhook quando o segredo não está configurado.
6. **Avaliar o limite/streaming de upload** de contratos assinados se o uso crescer.
7. **Regenerar a migration Drizzle** (ou documentar formalmente que o schema real vive no SQL ad-hoc) para eliminar a divergência entre `db/schema.ts` e o banco de produção.
