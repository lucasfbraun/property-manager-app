import { getD1, type D1Binding } from "../../db";
import {
  charges,
  contracts,
  properties,
  receivers,
  tenants,
  type Charge,
  type Contract,
  type Property,
  type Receiver,
  type Tenant,
} from "./rentals";

type TenantRow = {
  id: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  status: "active" | "inactive" | "delinquent" | "former";
};

type PropertyRow = {
  id: string;
  name: string;
  address: string;
  type: string;
  status: "available" | "rented" | "maintenance" | "inactive";
};

type ReceiverRow = {
  id: string;
  name: string;
  document: string;
  email: string;
  mercado_pago_account: string | null;
};

type ContractRow = {
  id: string;
  property_id: string;
  tenant_id: string;
  receiver_id: string;
  monthly_rent: number;
  due_day: number;
  starts_at: string;
  ends_at: string;
  fine_rate: number;
  monthly_interest_rate: number;
  grace_days: number;
  status: "draft" | "active" | "expiring" | "closed" | "cancelled";
};

type ChargeRow = {
  id: string;
  contract_id: string;
  reference: string;
  due_date: string;
  original_amount: number;
  status: "open" | "overdue" | "paid" | "cancelled";
};

let initialized = false;

export type RentalData = {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
  charges: Charge[];
};

export async function getRentalData(): Promise<RentalData> {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const [tenantRows, propertyRows, receiverRows, contractRows, chargeRows] =
    await Promise.all([
      d1.prepare("SELECT * FROM tenants ORDER BY name").all<TenantRow>(),
      d1.prepare("SELECT * FROM properties ORDER BY name").all<PropertyRow>(),
      d1.prepare("SELECT * FROM receivers ORDER BY name").all<ReceiverRow>(),
      d1.prepare("SELECT * FROM contracts ORDER BY starts_at DESC").all<ContractRow>(),
      d1.prepare("SELECT * FROM charges ORDER BY due_date DESC").all<ChargeRow>(),
    ]);

  return {
    charges: chargeRows.results.map(mapCharge),
    contracts: contractRows.results.map(mapContract),
    properties: propertyRows.results.map(mapProperty),
    receivers: receiverRows.results.map(mapReceiver),
    tenants: tenantRows.results.map(mapTenant),
  };
}

export async function createTenant(input: {
  name: string;
  document: string;
  email: string;
  whatsapp: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("ten");

  await d1
    .prepare(
      "INSERT INTO tenants (id, name, document, email, whatsapp, status) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, input.name, input.document, input.email, input.whatsapp, "active")
    .run();

  return id;
}

export async function deleteTenant(id: string) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const linkedContract = await d1
    .prepare("SELECT id FROM contracts WHERE tenant_id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (linkedContract) {
    throw new Error("Nao e possivel excluir inquilino vinculado a contrato.");
  }

  await d1.prepare("DELETE FROM tenants WHERE id = ?").bind(id).run();
}

export async function deleteProperty(id: string) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const linkedContract = await d1
    .prepare("SELECT id FROM contracts WHERE property_id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (linkedContract) {
    throw new Error("Nao e possivel excluir imovel vinculado a contrato.");
  }

  await d1.prepare("DELETE FROM properties WHERE id = ?").bind(id).run();
}

export async function deleteReceiver(id: string) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const linkedContract = await d1
    .prepare("SELECT id FROM contracts WHERE receiver_id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (linkedContract) {
    throw new Error("Nao e possivel excluir recebedor vinculado a contrato.");
  }

  await d1.prepare("DELETE FROM receivers WHERE id = ?").bind(id).run();
}

export async function deleteContract(id: string) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const linkedCharge = await d1
    .prepare("SELECT id FROM charges WHERE contract_id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (linkedCharge) {
    throw new Error("Nao e possivel excluir contrato com cobranca gerada.");
  }

  await d1.prepare("DELETE FROM contracts WHERE id = ?").bind(id).run();
}

export async function createProperty(input: {
  name: string;
  address: string;
  type: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("prop");

  await d1
    .prepare(
      "INSERT INTO properties (id, name, address, type, status) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, input.name, input.address, input.type, "available")
    .run();

  return id;
}

export async function createReceiver(input: {
  name: string;
  document: string;
  email: string;
  mpAccount: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("rec");

  await d1
    .prepare(
      "INSERT INTO receivers (id, name, document, email, mercado_pago_account, active) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, input.name, input.document, input.email, input.mpAccount, true)
    .run();

  return id;
}

export async function createContract(input: {
  tenantId: string;
  propertyId: string;
  receiverId: string;
  monthlyRent: number;
  dueDay: number;
  endsAt: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("ctr");
  const startsAt = new Date().toISOString().slice(0, 10);

  await d1
    .prepare(
      `INSERT INTO contracts (
        id, property_id, tenant_id, receiver_id, monthly_rent, due_day, starts_at,
        ends_at, fine_rate, monthly_interest_rate, grace_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.propertyId,
      input.tenantId,
      input.receiverId,
      input.monthlyRent,
      input.dueDay,
      startsAt,
      input.endsAt,
      0.02,
      0.01,
      0,
      "active",
    )
    .run();

  return id;
}

export async function ensureRentalDatabase(d1: D1Binding = getD1()) {
  if (initialized) {
    return;
  }

  await d1.batch([
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS receivers (id text PRIMARY KEY NOT NULL, name text NOT NULL, document text NOT NULL, email text NOT NULL, mercado_pago_account text, active integer DEFAULT true NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS tenants (id text PRIMARY KEY NOT NULL, user_id text, name text NOT NULL, document text NOT NULL, email text NOT NULL, whatsapp text NOT NULL, status text NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS properties (id text PRIMARY KEY NOT NULL, name text NOT NULL, address text NOT NULL, type text NOT NULL, status text NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS contracts (id text PRIMARY KEY NOT NULL, property_id text NOT NULL, tenant_id text NOT NULL, receiver_id text NOT NULL, monthly_rent real NOT NULL, due_day integer NOT NULL, starts_at text NOT NULL, ends_at text NOT NULL, fine_rate real NOT NULL, monthly_interest_rate real NOT NULL, grace_days integer DEFAULT 0 NOT NULL, status text NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS charges (id text PRIMARY KEY NOT NULL, contract_id text NOT NULL, receiver_id text NOT NULL, reference text NOT NULL, due_date text NOT NULL, original_amount real NOT NULL, status text NOT NULL, mercado_pago_payment_id text, payment_url text)",
    ),
  ]);

  await seedIfEmpty(d1);
  initialized = true;
}

async function seedIfEmpty(d1: D1Binding) {
  const count = await d1
    .prepare("SELECT COUNT(*) AS total FROM tenants")
    .first<{ total: number }>();

  if ((count?.total ?? 0) > 0) {
    return;
  }

  await d1.batch([
    ...receivers.map((receiver) =>
      d1
        .prepare(
          "INSERT INTO receivers (id, name, document, email, mercado_pago_account, active) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          receiver.id,
          receiver.name,
          receiver.document,
          receiver.email,
          receiver.mpAccount,
          true,
        ),
    ),
    ...tenants.map((tenant) =>
      d1
        .prepare(
          "INSERT INTO tenants (id, name, document, email, whatsapp, status) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          tenant.id,
          tenant.name,
          tenant.document,
          tenant.email,
          tenant.whatsapp,
          tenant.status === "Inadimplente" ? "delinquent" : "active",
        ),
    ),
    ...properties.map((property) =>
      d1
        .prepare(
          "INSERT INTO properties (id, name, address, type, status) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          property.id,
          property.name,
          property.address,
          property.type,
          property.status === "Alugado" ? "rented" : "available",
        ),
    ),
    ...contracts.map((contract) =>
      d1
        .prepare(
          `INSERT INTO contracts (
            id, property_id, tenant_id, receiver_id, monthly_rent, due_day, starts_at,
            ends_at, fine_rate, monthly_interest_rate, grace_days, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          contract.id,
          contract.propertyId,
          contract.tenantId,
          contract.receiverId,
          contract.monthlyRent,
          contract.dueDay,
          contract.startsAt,
          contract.endsAt,
          contract.fineRate,
          contract.monthlyInterestRate,
          contract.graceDays,
          contract.status === "Vence em breve" ? "expiring" : "active",
        ),
    ),
    ...charges.map((charge) => {
      const contract = contracts.find((item) => item.id === charge.contractId);
      return d1
        .prepare(
          "INSERT INTO charges (id, contract_id, receiver_id, reference, due_date, original_amount, status, mercado_pago_payment_id, payment_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          charge.id,
          charge.contractId,
          contract?.receiverId ?? "",
          charge.reference,
          charge.dueDate,
          charge.amount,
          charge.status === "Paga"
            ? "paid"
            : charge.status === "Vencida"
              ? "overdue"
              : "open",
          null,
          null,
        );
    }),
  ]);
}

function mapTenant(row: TenantRow): Tenant {
  return {
    document: row.document,
    email: row.email,
    id: row.id,
    name: row.name,
    status:
      row.status === "delinquent"
        ? "Inadimplente"
        : row.status === "inactive"
          ? "Inativo"
          : "Ativo",
    whatsapp: row.whatsapp,
  };
}

function mapProperty(row: PropertyRow): Property {
  return {
    address: row.address,
    id: row.id,
    name: row.name,
    status:
      row.status === "rented"
        ? "Alugado"
        : row.status === "maintenance"
          ? "Manutencao"
          : "Disponivel",
    type: row.type,
  };
}

function mapReceiver(row: ReceiverRow): Receiver {
  return {
    document: row.document,
    email: row.email,
    id: row.id,
    mpAccount: row.mercado_pago_account ?? "Conta Mercado Pago pendente",
    name: row.name,
  };
}

function mapContract(row: ContractRow): Contract {
  return {
    dueDay: row.due_day,
    endsAt: row.ends_at,
    fineRate: row.fine_rate,
    graceDays: row.grace_days,
    id: row.id,
    monthlyInterestRate: row.monthly_interest_rate,
    monthlyRent: row.monthly_rent,
    propertyId: row.property_id,
    receiverId: row.receiver_id,
    startsAt: row.starts_at,
    status:
      row.status === "expiring"
        ? "Vence em breve"
        : row.status === "closed"
          ? "Encerrado"
          : "Ativo",
    tenantId: row.tenant_id,
  };
}

function mapCharge(row: ChargeRow): Charge {
  return {
    amount: row.original_amount,
    contractId: row.contract_id,
    dueDate: row.due_date,
    id: row.id,
    reference: row.reference,
    status:
      row.status === "paid"
        ? "Paga"
        : row.status === "overdue"
          ? "Vencida"
          : "Aberta",
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
