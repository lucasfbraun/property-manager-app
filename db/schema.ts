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
