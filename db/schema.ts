import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ATENCAO - fonte de verdade do schema
 *
 * Em producao o schema e provisionado em RUNTIME pelas funcoes `ensure*`
 * (ensureRentalDatabase em app/lib/rental-repository.ts e as ensure*Tables
 * de contract-documents/inspections/rateios), nao pelas migrations do
 * Drizzle. Este arquivo existe como documentacao tipada do schema e para o
 * drizzle-kit; ele foi sincronizado com o DDL runtime em 2026-07-13.
 *
 * Ao adicionar coluna/tabela: altere o `ensure*` correspondente E este
 * arquivo, na mesma mudanca. As migrations em /drizzle estao obsoletas e nao
 * devem ser aplicadas por cima de um banco ja provisionado pelo runtime.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "receiver", "tenant"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const receivers = sqliteTable("receivers", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  document: text("document").notNull(),
  email: text("email").notNull(),
  mercadoPagoAccount: text("mercado_pago_account"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  mpUserId: text("mp_user_id"),
  mpAccessToken: text("mp_access_token"),
  mpRefreshToken: text("mp_refresh_token"),
  mpTokenExpiresAt: text("mp_token_expires_at"),
  mpConnectedAt: text("mp_connected_at"),
  // 1 = token de producao (APP_USR), 0 = sandbox/TEST (ver mercadopago.ts).
  mpLiveMode: integer("mp_live_mode"),
});

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  document: text("document").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp").notNull(),
  status: text("status", {
    enum: ["active", "inactive", "delinquent", "former"],
  }).notNull(),
  // Qtde de moradores; usada pelo rateio no modo "residents".
  residentCount: integer("resident_count"),
});

export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
});

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("type").notNull(),
  status: text("status", {
    enum: ["available", "rented", "maintenance", "inactive"],
  }).notNull(),
  ownerId: text("owner_id").references(() => owners.id),
});

export const contractTemplates = sqliteTable("contract_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => receivers.id),
  monthlyRent: real("monthly_rent").notNull(),
  dueDay: integer("due_day").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  fineRate: real("fine_rate").notNull(),
  monthlyInterestRate: real("monthly_interest_rate").notNull(),
  graceDays: integer("grace_days").notNull().default(0),
  status: text("status", {
    enum: ["draft", "active", "expiring", "closed", "cancelled"],
  }).notNull(),
  templateId: text("template_id").references(() => contractTemplates.id),
  contractText: text("contract_text"),
  signatureStatus: text("signature_status", {
    enum: [
      "not_generated",
      "awaiting_signature",
      "in_review",
      "approved",
      "rejected",
    ],
  }).default("not_generated"),
  signedDocumentKey: text("signed_document_key"),
  signedFileName: text("signed_file_name"),
  signedUploadedAt: text("signed_uploaded_at"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  // PDF gerado a partir do template (chave R2) + quando foi regenerado.
  generatedDocumentKey: text("generated_document_key"),
  generatedDocumentUpdatedAt: text("generated_document_updated_at"),
  ownerSignedAt: text("owner_signed_at"),
  // Lembrete de contrato expirando ja enviado (ver reminders.ts).
  expiringReminderSentAt: text("expiring_reminder_sent_at"),
});

export const contractWitnesses = sqliteTable("contract_witnesses", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => receivers.id),
  signedAt: text("signed_at"),
});

export const charges = sqliteTable("charges", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => receivers.id),
  reference: text("reference").notNull(),
  dueDate: text("due_date").notNull(),
  originalAmount: real("original_amount").notNull(),
  status: text("status", {
    enum: ["open", "waiting_payment", "paid", "overdue", "cancelled"],
  }).notNull(),
  mercadoPagoPaymentId: text("mercado_pago_payment_id"),
  paymentUrl: text("payment_url"),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixExpiresAt: text("pix_expires_at"),
  // Parcela de rateio embutida em original_amount (exibicao separada na UI).
  rateioAmount: real("rateio_amount"),
  // Controle de lembretes WhatsApp por cobranca (ver reminders.ts).
  lastReminderEvent: text("last_reminder_event"),
  lastReminderSentAt: text("last_reminder_sent_at"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  chargeId: text("charge_id")
    .notNull()
    .references(() => charges.id),
  amountPaid: real("amount_paid").notNull(),
  netAmount: real("net_amount"),
  fees: real("fees"),
  method: text("method", { enum: ["pix", "credit_card", "manual"] }).notNull(),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "cancelled", "refunded"],
  }).notNull(),
  paidAt: text("paid_at"),
  externalId: text("external_id"),
});

export const contractInspectionPhotos = sqliteTable(
  "contract_inspection_photos",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    caption: text("caption"),
    room: text("room"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
);

export const contractOccurrences = sqliteTable("contract_occurrences", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolutionNote: text("resolution_note"),
});

export const contractOccurrencePhotos = sqliteTable(
  "contract_occurrence_photos",
  {
    id: text("id").primaryKey(),
    occurrenceId: text("occurrence_id")
      .notNull()
      .references(() => contractOccurrences.id),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: text("created_at").notNull(),
  },
);

export const rateios = sqliteTable("rateios", {
  id: text("id").primaryKey(),
  category: text("category").notNull().default("outro"),
  description: text("description"),
  reference: text("reference").notNull(),
  totalAmount: real("total_amount").notNull(),
  invoiceKey: text("invoice_key"),
  invoiceContentType: text("invoice_content_type"),
  invoiceFileName: text("invoice_file_name"),
  createdAt: text("created_at").notNull(),
  // Como o rateio foi dividido ("residents" | "equal"), para reedicao.
  splitMode: text("split_mode").default("residents"),
});

export const rateioAllocations = sqliteTable("rateio_allocations", {
  id: text("id").primaryKey(),
  rateioId: text("rateio_id")
    .notNull()
    .references(() => rateios.id),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id),
  amount: real("amount").notNull(),
  chargeId: text("charge_id"),
  appliedAt: text("applied_at"),
});
