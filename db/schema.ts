import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("type").notNull(),
  status: text("status", {
    enum: ["available", "rented", "maintenance", "inactive"],
  }).notNull(),
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
  })
    .notNull()
    .default("not_generated"),
  signedDocumentKey: text("signed_document_key"),
  signedFileName: text("signed_file_name"),
  signedUploadedAt: text("signed_uploaded_at"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
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

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  chargeId: text("charge_id")
    .notNull()
    .references(() => charges.id),
  channel: text("channel", { enum: ["whatsapp", "email"] }).notNull(),
  event: text("event", {
    enum: ["before_due", "due_day", "after_due", "payment_confirmed"],
  }).notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  sentAt: text("sent_at"),
  status: text("status", {
    enum: ["scheduled", "sent", "failed", "cancelled"],
  }).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  justification: text("justification"),
  createdAt: text("created_at").notNull(),
});
