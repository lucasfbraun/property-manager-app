import { getD1, type D1Binding } from "../../db";
import { hashPassword } from "./auth";
import {
  ensureAuthTables,
  ensureColumn,
  createUser,
} from "./auth-repository";
import { ensureContractDocumentTables } from "./contract-documents";
import { ensureInspectionTables } from "./inspections";
import { ensureRateioTables } from "./rateios";
import {
  charges,
  contracts,
  properties,
  receivers,
  tenants,
  type Charge,
  type Contract,
  type ContractWitness,
  type Owner,
  type Property,
  type Receiver,
  type SignatureStatus,
  type Tenant,
} from "./rentals";

type TenantRow = {
  id: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  status: "active" | "inactive" | "delinquent" | "former";
  resident_count: number | null;
};

type PropertyRow = {
  id: string;
  name: string;
  address: string;
  type: string;
  status: "available" | "rented" | "maintenance" | "inactive";
  owner_id: string | null;
};

type OwnerRow = {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
};

type ReceiverRow = {
  id: string;
  name: string;
  document: string;
  email: string;
  mercado_pago_account: string | null;
  mp_access_token: string | null;
  mp_connected_at: string | null;
  mp_live_mode: number | null;
  mp_user_id: string | null;
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
  template_id: string | null;
  contract_text: string | null;
  signature_status: SignatureStatus | null;
  signed_file_name: string | null;
  signed_uploaded_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  generated_document_key: string | null;
  generated_document_updated_at: string | null;
  owner_signed_at: string | null;
};

type ContractWitnessRow = {
  id: string;
  contract_id: string;
  receiver_id: string;
  signed_at: string | null;
};

type ChargeRow = {
  id: string;
  contract_id: string;
  reference: string;
  due_date: string;
  original_amount: number;
  status: "open" | "overdue" | "paid" | "cancelled";
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_expires_at: string | null;
  rateio_amount: number | null;
};

let initialized = false;

export type RentalData = {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
  charges: Charge[];
  owners: Owner[];
  contractWitnesses: ContractWitness[];
};

const CONTRACT_COLUMNS = `id, property_id, tenant_id, receiver_id, monthly_rent, due_day,
  starts_at, ends_at, fine_rate, monthly_interest_rate, grace_days, status,
  template_id, contract_text, signature_status, signed_file_name, signed_uploaded_at,
  reviewed_at, review_note, generated_document_key, generated_document_updated_at, owner_signed_at`;

export async function getRentalData(): Promise<RentalData> {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  const [
    tenantRows,
    propertyRows,
    receiverRows,
    contractRows,
    chargeRows,
    ownerRows,
    contractWitnessRows,
  ] = await Promise.all([
    d1.prepare("SELECT * FROM tenants ORDER BY name").all<TenantRow>(),
    d1.prepare("SELECT * FROM properties ORDER BY name").all<PropertyRow>(),
    d1.prepare("SELECT * FROM receivers ORDER BY name").all<ReceiverRow>(),
    d1
      .prepare(`SELECT ${CONTRACT_COLUMNS} FROM contracts ORDER BY starts_at DESC`)
      .all<ContractRow>(),
    d1.prepare("SELECT * FROM charges ORDER BY due_date DESC").all<ChargeRow>(),
    d1.prepare("SELECT * FROM owners ORDER BY name").all<OwnerRow>(),
    d1.prepare("SELECT * FROM contract_witnesses ORDER BY id").all<ContractWitnessRow>(),
  ]);

  return {
    charges: chargeRows.results.map(mapCharge),
    contracts: contractRows.results.map(mapContract),
    contractWitnesses: contractWitnessRows.results.map(mapContractWitness),
    owners: ownerRows.results.map(mapOwner),
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
  /** Number of people living at the property, used to split rateios fairly. */
  residentCount?: number | null;
  /** Optional: when provided, creates a login account for the tenant portal. */
  password?: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("ten");
  const userId = await createLinkedUserIfRequested(
    input.password,
    input.name,
    input.email,
    "tenant",
  );

  await d1
    .prepare(
      "INSERT INTO tenants (id, user_id, name, document, email, whatsapp, status, resident_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      userId,
      input.name,
      input.document,
      input.email,
      input.whatsapp,
      "active",
      input.residentCount ?? null,
    )
    .run();

  return id;
}

export async function updateTenant(input: {
  id: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  status: "Ativo" | "Inadimplente" | "Inativo";
  /** Number of people living at the property, used to split rateios fairly. */
  residentCount?: number | null;
  /** Optional: sets/resets the login password for the tenant portal. */
  password?: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const statusValue =
    input.status === "Inadimplente"
      ? "delinquent"
      : input.status === "Inativo"
        ? "inactive"
        : "active";

  await d1
    .prepare(
      "UPDATE tenants SET name = ?, document = ?, email = ?, whatsapp = ?, status = ?, resident_count = ? WHERE id = ?",
    )
    .bind(
      input.name,
      input.document,
      input.email,
      input.whatsapp,
      statusValue,
      input.residentCount ?? null,
      input.id,
    )
    .run();

  if (input.password) {
    await setOrCreateLinkedUser(
      "tenants",
      input.id,
      input.password,
      input.name,
      input.email,
      "tenant",
    );
  }
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

export async function deleteOwner(id: string) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  // Owners are admin-only records (no contract references them directly), so
  // deleting one just releases its properties back to "sem proprietario"
  // instead of being blocked like tenant/property/receiver/contract deletes.
  await d1.prepare("UPDATE properties SET owner_id = NULL WHERE owner_id = ?").bind(id).run();
  await d1.prepare("DELETE FROM owners WHERE id = ?").bind(id).run();
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

export async function updateProperty(input: {
  id: string;
  name: string;
  address: string;
  type: string;
  status: "Alugado" | "Disponivel" | "Manutencao";
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const statusValue =
    input.status === "Alugado"
      ? "rented"
      : input.status === "Manutencao"
        ? "maintenance"
        : "available";

  await d1
    .prepare(
      "UPDATE properties SET name = ?, address = ?, type = ?, status = ? WHERE id = ?",
    )
    .bind(input.name, input.address, input.type, statusValue, input.id)
    .run();
}

/**
 * Owners (proprietarios) are admin-only records: no login/portal, unlike
 * Tenant/Receiver. Each owner must be linked to at least 1 property, and each
 * property has at most 1 owner (see Property.ownerId) — so assigning a
 * property here automatically takes it away from whichever owner had it
 * before.
 */
export async function createOwner(input: {
  name: string;
  document: string;
  email: string;
  phone: string;
  propertyIds: string[];
}) {
  if (input.propertyIds.length === 0) {
    throw new Error("Selecione ao menos 1 imovel para o proprietario.");
  }

  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("own");

  await d1
    .prepare("INSERT INTO owners (id, name, document, email, phone) VALUES (?, ?, ?, ?, ?)")
    .bind(id, input.name, input.document, input.email, input.phone)
    .run();

  await assignOwnerProperties(d1, id, input.propertyIds);

  return id;
}

export async function updateOwner(input: {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  propertyIds: string[];
}) {
  if (input.propertyIds.length === 0) {
    throw new Error("Selecione ao menos 1 imovel para o proprietario.");
  }

  const d1 = getD1();
  await ensureRentalDatabase(d1);

  await d1
    .prepare("UPDATE owners SET name = ?, document = ?, email = ?, phone = ? WHERE id = ?")
    .bind(input.name, input.document, input.email, input.phone, input.id)
    .run();

  await assignOwnerProperties(d1, input.id, input.propertyIds);
}

/** Sets owner_id = ownerId on exactly propertyIds, releasing every other property currently pointing at this owner. */
async function assignOwnerProperties(d1: D1Binding, ownerId: string, propertyIds: string[]) {
  const placeholders = propertyIds.map(() => "?").join(", ");
  await d1
    .prepare(
      `UPDATE properties SET owner_id = NULL WHERE owner_id = ? AND id NOT IN (${placeholders})`,
    )
    .bind(ownerId, ...propertyIds)
    .run();

  await d1
    .prepare(`UPDATE properties SET owner_id = ? WHERE id IN (${placeholders})`)
    .bind(ownerId, ...propertyIds)
    .run();
}

export async function createReceiver(input: {
  name: string;
  document: string;
  email: string;
  mpAccount: string;
  /** Optional: when provided, creates a login account for the receiver portal. */
  password?: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const id = createId("rec");
  const userId = await createLinkedUserIfRequested(
    input.password,
    input.name,
    input.email,
    "receiver",
  );

  await d1
    .prepare(
      "INSERT INTO receivers (id, user_id, name, document, email, mercado_pago_account, active) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, userId, input.name, input.document, input.email, input.mpAccount, true)
    .run();

  return id;
}

export async function updateReceiver(input: {
  id: string;
  name: string;
  document: string;
  email: string;
  mpAccount: string;
  /** Optional: sets/resets the login password for the receiver portal. */
  password?: string;
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);

  await d1
    .prepare(
      "UPDATE receivers SET name = ?, document = ?, email = ?, mercado_pago_account = ? WHERE id = ?",
    )
    .bind(input.name, input.document, input.email, input.mpAccount, input.id)
    .run();

  if (input.password) {
    await setOrCreateLinkedUser(
      "receivers",
      input.id,
      input.password,
      input.name,
      input.email,
      "receiver",
    );
  }
}

export async function createContract(input: {
  tenantId: string;
  propertyId: string;
  receiverId: string;
  monthlyRent: number;
  dueDay: number;
  endsAt: string;
  /** Receivers acting as witnesses (testemunhas) for this contract. Optional, defaults to none. */
  witnessIds?: string[];
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

  await syncContractWitnesses(d1, id, input.witnessIds ?? []);

  return id;
}

export async function updateContract(input: {
  id: string;
  monthlyRent: number;
  dueDay: number;
  endsAt: string;
  status: "Ativo" | "Vence em breve" | "Encerrado";
  fineRate: number;
  monthlyInterestRate: number;
  graceDays: number;
  /** Receivers acting as witnesses (testemunhas) for this contract. Optional: when omitted, the existing witness list is left untouched. */
  witnessIds?: string[];
}) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  const statusValue =
    input.status === "Vence em breve"
      ? "expiring"
      : input.status === "Encerrado"
        ? "closed"
        : "active";

  const previous = await d1
    .prepare("SELECT monthly_rent, due_day FROM contracts WHERE id = ?")
    .bind(input.id)
    .first<{ monthly_rent: number; due_day: number }>();
  const rentChanged = Boolean(previous) && previous!.monthly_rent !== input.monthlyRent;
  const dueDayChanged = Boolean(previous) && previous!.due_day !== input.dueDay;

  await d1
    .prepare(
      `UPDATE contracts SET
        monthly_rent = ?, due_day = ?, ends_at = ?, status = ?,
        fine_rate = ?, monthly_interest_rate = ?, grace_days = ?
      WHERE id = ?`,
    )
    .bind(
      input.monthlyRent,
      input.dueDay,
      input.endsAt,
      statusValue,
      input.fineRate,
      input.monthlyInterestRate,
      input.graceDays,
      input.id,
    )
    .run();

  if (rentChanged) {
    // Charges are snapshotted with their own `original_amount` at generation
    // time (see charge-scheduler.ts), so updating the contract's monthly_rent
    // alone leaves any already-generated charge showing the stale value in
    // the tenant portal. Refresh every not-yet-paid charge of this contract
    // to the new rent, preserving whatever rateio_amount was folded in on
    // top (see rateios.ts: original_amount = base rent + rateio_amount).
    //
    // Also wipe any Pix QR code already generated for those charges: a Pix
    // "copia e cola" is created at Mercado Pago with a fixed amount baked
    // in, so once the rent changes an old QR code would still charge the
    // previous value even though our own amount field is now correct.
    // Clearing these fields makes the tenant portal fall back to "gerar
    // Pix", forcing a fresh QR code with the updated amount.
    await d1
      .prepare(
        `UPDATE charges SET
          original_amount = ? + COALESCE(rateio_amount, 0),
          mercado_pago_payment_id = NULL,
          payment_url = NULL,
          pix_qr_code = NULL,
          pix_qr_code_base64 = NULL,
          pix_expires_at = NULL
         WHERE contract_id = ? AND status != 'paid'`,
      )
      .bind(input.monthlyRent, input.id)
      .run();
  }

  if (dueDayChanged) {
    // The due date shown to the tenant per charge (`charges.due_date`) is
    // also snapshotted at generation time from the contract's due_day, so it
    // goes stale the same way `original_amount` does. Shift every not-yet-paid
    // charge's due date to the new day-of-month, keeping the same
    // reference month/year it was generated for.
    const pendingCharges = await d1
      .prepare("SELECT id, due_date FROM charges WHERE contract_id = ? AND status != 'paid'")
      .bind(input.id)
      .all<{ id: string; due_date: string }>();

    for (const charge of pendingCharges.results) {
      const [yearStr, monthStr] = charge.due_date.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const newDay = Math.min(input.dueDay, lastDayOfMonth);
      const newDueDate = `${yearStr}-${monthStr}-${String(newDay).padStart(2, "0")}`;

      await d1
        .prepare("UPDATE charges SET due_date = ? WHERE id = ?")
        .bind(newDueDate, charge.id)
        .run();
    }
  }

  if (input.witnessIds) {
    await syncContractWitnesses(d1, input.id, input.witnessIds);
  }
}

/**
 * Testemunhas (witnesses) are receivers linked to a contract via the
 * contract_witnesses join table. This reconciles the desired set with what's
 * already stored: rows for witnesses no longer selected are deleted, rows
 * for newly selected witnesses are inserted (signed_at starts null), and
 * rows for witnesses that remain selected are left untouched so an
 * already-recorded signature isn't lost on an unrelated contract edit.
 */
async function syncContractWitnesses(d1: D1Binding, contractId: string, receiverIds: string[]) {
  const existing = await d1
    .prepare("SELECT id, receiver_id FROM contract_witnesses WHERE contract_id = ?")
    .bind(contractId)
    .all<{ id: string; receiver_id: string }>();

  const desired = new Set(receiverIds);
  const alreadyLinked = new Set(existing.results.map((row) => row.receiver_id));

  const statements = [];
  for (const row of existing.results) {
    if (!desired.has(row.receiver_id)) {
      statements.push(d1.prepare("DELETE FROM contract_witnesses WHERE id = ?").bind(row.id));
    }
  }
  for (const receiverId of receiverIds) {
    if (!alreadyLinked.has(receiverId)) {
      statements.push(
        d1
          .prepare(
            "INSERT INTO contract_witnesses (id, contract_id, receiver_id, signed_at) VALUES (?, ?, ?, NULL)",
          )
          .bind(createId("wit"), contractId, receiverId),
      );
    }
  }

  if (statements.length > 0) {
    await d1.batch(statements);
  }
}

export async function setContractOwnerSigned(contractId: string, signed: boolean) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  await d1
    .prepare("UPDATE contracts SET owner_signed_at = ? WHERE id = ?")
    .bind(signed ? new Date().toISOString() : null, contractId)
    .run();
}

export async function setContractWitnessSigned(contractWitnessId: string, signed: boolean) {
  const d1 = getD1();
  await ensureRentalDatabase(d1);
  await d1
    .prepare("UPDATE contract_witnesses SET signed_at = ? WHERE id = ?")
    .bind(signed ? new Date().toISOString() : null, contractWitnessId)
    .run();
}

export async function ensureRentalDatabase(d1: D1Binding = getD1()) {
  if (initialized) {
    return;
  }

  await ensureAuthTables(d1);

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
    // Previously only created by the (stale/unapplied) Drizzle migration;
    // provisioned here too so a fresh D1 database works without depending on
    // `db:migrate:remote` having been run first (see recordApprovedPayment).
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS payments (id text PRIMARY KEY NOT NULL, charge_id text NOT NULL, amount_paid real NOT NULL, net_amount real, fees real, method text NOT NULL, status text NOT NULL, paid_at text, external_id text)",
    ),
    // Proprietarios (owners): admin-only records, no login. Exactly 1 owner
    // per property (see properties.owner_id below).
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS owners (id text PRIMARY KEY NOT NULL, name text NOT NULL, document text NOT NULL, email text NOT NULL, phone text NOT NULL)",
    ),
    // Testemunhas (witnesses) linked to a contract, sourced from the
    // receivers list. signed_at is set by the admin once the printed
    // contract has been physically signed by that witness.
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS contract_witnesses (id text PRIMARY KEY NOT NULL, contract_id text NOT NULL, receiver_id text NOT NULL, signed_at text)",
    ),
  ]);

  // `receivers` may already exist from before authentication was added, so
  // the column has to be backfilled instead of relying on CREATE TABLE.
  await ensureColumn(d1, "receivers", "user_id", "user_id text REFERENCES users(id)");

  // Mercado Pago OAuth (per-receiver connected account) and Pix fields,
  // backfilled the same additive way as the auth/contract columns above.
  await ensureColumn(d1, "receivers", "mp_user_id", "mp_user_id text");
  await ensureColumn(d1, "receivers", "mp_access_token", "mp_access_token text");
  await ensureColumn(d1, "receivers", "mp_refresh_token", "mp_refresh_token text");
  await ensureColumn(d1, "receivers", "mp_token_expires_at", "mp_token_expires_at text");
  await ensureColumn(d1, "receivers", "mp_connected_at", "mp_connected_at text");
  await ensureColumn(d1, "receivers", "mp_live_mode", "mp_live_mode integer");
  await ensureColumn(d1, "charges", "pix_qr_code", "pix_qr_code text");
  await ensureColumn(d1, "charges", "pix_qr_code_base64", "pix_qr_code_base64 text");
  await ensureColumn(d1, "charges", "pix_expires_at", "pix_expires_at text");
  // Portion of a charge that came from a rateio (app/lib/rateios.ts) — water, condominio, gas, etc.
  await ensureColumn(d1, "charges", "rateio_amount", "rateio_amount real");
  // Number of people living at the property, used to split rateios fairly (app/lib/rateios.ts).
  await ensureColumn(d1, "tenants", "resident_count", "resident_count integer");
  // Tracks the last automatic WhatsApp reminder sent for a charge, so the daily
  // sweep (app/lib/reminders.ts) doesn't re-send the same event every run.
  await ensureColumn(d1, "charges", "last_reminder_event", "last_reminder_event text");
  await ensureColumn(d1, "charges", "last_reminder_sent_at", "last_reminder_sent_at text");
  // Marks that the "contrato vencendo" WhatsApp reminder was already sent once
  // for this contract (set to "Vence em breve"), so it isn't repeated on
  // every unrelated edit while the status stays the same.
  await ensureColumn(d1, "contracts", "expiring_reminder_sent_at", "expiring_reminder_sent_at text");
  // Links a property to its proprietario (owners table above). Nullable so
  // existing properties keep working until an owner is assigned.
  await ensureColumn(d1, "properties", "owner_id", "owner_id text REFERENCES owners(id)");
  // Admin acknowledgement that the property owner physically signed the
  // printed contract. Gates the tenant's turn to sign (see
  // isContractReadyForTenantSignature in app/lib/rentals.ts) — the tenant
  // always signs last.
  await ensureColumn(d1, "contracts", "owner_signed_at", "owner_signed_at text");

  await ensureContractDocumentTables(d1);
  await ensureInspectionTables(d1);
  await ensureRateioTables(d1);

  await seedIfEmpty(d1);
  await seedAuthUsers(d1);
  initialized = true;
}

async function createLinkedUserIfRequested(
  password: string | undefined,
  name: string,
  email: string,
  role: "tenant" | "receiver",
): Promise<string | null> {
  if (!password) {
    return null;
  }

  const userId = createId("usr");
  const passwordHash = await hashPassword(password);
  await createUser({ email, id: userId, name, passwordHash, role });
  return userId;
}

/**
 * Sets a new password for the user already linked to a tenant/receiver row,
 * or creates and links a new user account if none exists yet.
 */
async function setOrCreateLinkedUser(
  table: "tenants" | "receivers",
  recordId: string,
  password: string,
  name: string,
  email: string,
  role: "tenant" | "receiver",
) {
  const d1 = getD1();
  const row = await d1
    .prepare(`SELECT user_id FROM ${table} WHERE id = ?`)
    .bind(recordId)
    .first<{ user_id: string | null }>();

  const passwordHash = await hashPassword(password);

  if (row?.user_id) {
    await d1
      .prepare("UPDATE users SET password_hash = ?, email = ?, name = ? WHERE id = ?")
      .bind(passwordHash, email, name, row.user_id)
      .run();
    return;
  }

  const userId = createId("usr");
  await createUser({ email, id: userId, name, passwordHash, role });
  await d1
    .prepare(`UPDATE ${table} SET user_id = ? WHERE id = ?`)
    .bind(userId, recordId)
    .run();
}

/**
 * Seeds an initial admin account plus demo logins for the seeded tenants and
 * receivers, so every role can be tested right after the first deploy. Only
 * runs once (checks the `users` table, independent from the domain-data
 * seed) so it also backfills logins on a database that already had
 * tenants/receivers before authentication existed.
 */
async function seedAuthUsers(d1: D1Binding) {
  const count = await d1
    .prepare("SELECT COUNT(*) AS total FROM users")
    .first<{ total: number }>();

  if ((count?.total ?? 0) > 0) {
    return;
  }

  const adminPassword = "TrocarSenha!2026";
  const demoPassword = "Demo123!";
  const adminHash = await hashPassword(adminPassword);
  const demoHash = await hashPassword(demoPassword);
  const now = new Date().toISOString();

  const tenantLinks = [
    { email: "marina@example.com", id: "ten-marina", name: "Marina Souza" },
    { email: "rafael@example.com", id: "ten-rafael", name: "Rafael Lima" },
    { email: "carlos@example.com", id: "ten-carlos", name: "Carlos Mendes" },
  ];
  const receiverLinks = [
    { email: "lucas@example.com", id: "rec-lucas", name: "Lucas" },
    { email: "guilherme@example.com", id: "rec-guilherme", name: "Guilherme" },
  ];

  const statements = [
    d1
      .prepare(
        "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "usr-admin",
        "Administrador",
        "sistemas@grupoflexivel.com.br",
        adminHash,
        "admin",
        now,
      ),
  ];

  for (const link of tenantLinks) {
    const userId = `usr-${link.id}`;
    statements.push(
      d1
        .prepare(
          "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(userId, link.name, link.email, demoHash, "tenant", now),
    );
    statements.push(
      d1
        .prepare("UPDATE tenants SET user_id = ? WHERE id = ?")
        .bind(userId, link.id),
    );
  }

  for (const link of receiverLinks) {
    const userId = `usr-${link.id}`;
    statements.push(
      d1
        .prepare(
          "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(userId, link.name, link.email, demoHash, "receiver", now),
    );
    statements.push(
      d1
        .prepare("UPDATE receivers SET user_id = ? WHERE id = ?")
        .bind(userId, link.id),
    );
  }

  await d1.batch(statements);
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
          "INSERT INTO tenants (id, name, document, email, whatsapp, status, resident_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          tenant.id,
          tenant.name,
          tenant.document,
          tenant.email,
          tenant.whatsapp,
          tenant.status === "Inadimplente" ? "delinquent" : "active",
          tenant.residentCount ?? null,
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
    residentCount: row.resident_count ?? null,
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
    ownerId: row.owner_id ?? null,
    status:
      row.status === "rented"
        ? "Alugado"
        : row.status === "maintenance"
          ? "Manutencao"
          : "Disponivel",
    type: row.type,
  };
}

function mapOwner(row: OwnerRow): Owner {
  return {
    document: row.document,
    email: row.email,
    id: row.id,
    name: row.name,
    phone: row.phone,
  };
}

function mapReceiver(row: ReceiverRow): Receiver {
  return {
    document: row.document,
    email: row.email,
    id: row.id,
    mpAccount: row.mercado_pago_account ?? "Conta Mercado Pago pendente",
    mpConnected: Boolean(row.mp_access_token),
    mpConnectedAt: row.mp_connected_at,
    mpLiveMode: row.mp_live_mode === null ? null : Boolean(row.mp_live_mode),
    mpUserId: row.mp_user_id,
    name: row.name,
  };
}

function mapContractWitness(row: ContractWitnessRow): ContractWitness {
  return {
    contractId: row.contract_id,
    id: row.id,
    receiverId: row.receiver_id,
    signedAt: row.signed_at,
  };
}

function mapContract(row: ContractRow): Contract {
  return {
    contractText: row.contract_text,
    dueDay: row.due_day,
    endsAt: row.ends_at,
    fineRate: row.fine_rate,
    generatedDocumentKey: row.generated_document_key,
    generatedDocumentUpdatedAt: row.generated_document_updated_at,
    graceDays: row.grace_days,
    id: row.id,
    monthlyInterestRate: row.monthly_interest_rate,
    monthlyRent: row.monthly_rent,
    ownerSignedAt: row.owner_signed_at,
    propertyId: row.property_id,
    receiverId: row.receiver_id,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    signatureStatus: row.signature_status ?? "not_generated",
    signedFileName: row.signed_file_name,
    signedUploadedAt: row.signed_uploaded_at,
    startsAt: row.starts_at,
    status:
      row.status === "expiring"
        ? "Vence em breve"
        : row.status === "closed"
          ? "Encerrado"
          : "Ativo",
    templateId: row.template_id,
    tenantId: row.tenant_id,
  };
}

function mapCharge(row: ChargeRow): Charge {
  return {
    amount: row.original_amount,
    contractId: row.contract_id,
    dueDate: row.due_date,
    id: row.id,
    pixExpiresAt: row.pix_expires_at,
    pixQrCode: row.pix_qr_code,
    pixQrCodeBase64: row.pix_qr_code_base64,
    reference: row.reference,
    status:
      row.status === "paid"
        ? "Paga"
        : row.status === "overdue"
          ? "Vencida"
          : "Aberta",
    rateioAmount: row.rateio_amount ?? null,
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
