import { getD1, getR2, type D1Binding } from "../../db";
import { ensureColumn } from "./auth-repository";

/**
 * Water bill rateio (apportionment): the admin enters the total water bill
 * for a given month, picks which properties share it (not necessarily all of
 * them — e.g. a property with its own separate hydrometer would be left
 * out), optionally attaches the invoice file, and the amount is split evenly
 * across the selected properties. Each property's share is added on top of
 * that month's rent charge for the contract tied to it.
 *
 * Ordering isn't assumed: the charge for a given contract/month may already
 * exist (rateio entered after the automatic charge sweep already ran) or not
 * yet (rateio entered ahead of time). Allocations that can't be applied
 * immediately are left pending (`applied_at` null) and picked up later by
 * `applyPendingWaterAllocations`, called right after a new charge is
 * inserted (see app/lib/charge-scheduler.ts).
 */

export const ACCEPTED_INVOICE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export type AcceptedInvoiceContentType = (typeof ACCEPTED_INVOICE_CONTENT_TYPES)[number];

export const MAX_INVOICE_BYTES = 8 * 1024 * 1024; // 8MB

export type WaterBillAllocation = {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  applied: boolean;
  chargeId: string | null;
};

export type WaterBill = {
  id: string;
  reference: string;
  totalAmount: number;
  invoiceFileName: string | null;
  createdAt: string;
  allocations: WaterBillAllocation[];
};

export async function ensureWaterBillTables(d1: D1Binding = getD1()) {
  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS water_bills (
        id text PRIMARY KEY NOT NULL,
        reference text NOT NULL,
        total_amount real NOT NULL,
        invoice_key text,
        invoice_content_type text,
        invoice_file_name text,
        created_at text NOT NULL
      )`,
    )
    .run();

  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS water_bill_allocations (
        id text PRIMARY KEY NOT NULL,
        water_bill_id text NOT NULL REFERENCES water_bills(id),
        property_id text NOT NULL REFERENCES properties(id),
        amount real NOT NULL,
        charge_id text,
        applied_at text
      )`,
    )
    .run();

  // Additive: lets a charge show "aluguel + agua" separately even though
  // `original_amount` already includes the water share (see mercadopago.ts).
  await ensureColumn(d1, "charges", "water_amount", "water_amount real");
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

function assertAcceptedInvoiceType(contentType: string) {
  if (!ACCEPTED_INVOICE_CONTENT_TYPES.includes(contentType as AcceptedInvoiceContentType)) {
    throw new Error("Formato nao suportado. Envie a fatura em JPG, PNG ou PDF.");
  }
}

function assertInvoiceSizeWithinLimit(fileBase64: string) {
  const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_INVOICE_BYTES) {
    throw new Error(
      `Arquivo muito grande (limite de ${(MAX_INVOICE_BYTES / (1024 * 1024)).toFixed(0)}MB).`,
    );
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Creates a water bill rateio: splits `totalAmount` evenly across
 * `propertyIds` and applies each share to that property's contract charge
 * for `reference` (immediately if the charge already exists; otherwise the
 * share is left pending for `applyPendingWaterAllocations` to pick up once
 * the charge is generated).
 */
export async function createWaterBillRateio(input: {
  reference: string;
  totalAmount: number;
  propertyIds: string[];
  invoiceBase64?: string;
  invoiceContentType?: string;
  invoiceFileName?: string;
}): Promise<{ waterBillId: string; perPropertyAmount: number; appliedCount: number; pendingCount: number }> {
  const d1 = getD1();
  await ensureWaterBillTables(d1);

  const reference = input.reference.trim();
  if (!reference) {
    throw new Error("Informe o mes/ano de referencia.");
  }
  const uniquePropertyIds = Array.from(new Set(input.propertyIds));
  if (uniquePropertyIds.length === 0) {
    throw new Error("Selecione ao menos um imovel para o rateio.");
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("Informe um valor total valido para a fatura de agua.");
  }

  let invoiceKey: string | null = null;
  const waterBillId = createId("water");

  if (input.invoiceBase64) {
    if (!input.invoiceContentType || !input.invoiceFileName) {
      throw new Error("Dados do arquivo da fatura incompletos.");
    }
    assertAcceptedInvoiceType(input.invoiceContentType);
    assertInvoiceSizeWithinLimit(input.invoiceBase64);

    const bytes = base64ToBytes(input.invoiceBase64);
    invoiceKey = `water-bills/${waterBillId}/${Date.now()}-${sanitizeFileName(input.invoiceFileName)}`;
    await getR2().put(invoiceKey, bytes, {
      httpMetadata: { contentType: input.invoiceContentType },
    });
  }

  const perPropertyAmount = roundCents(input.totalAmount / uniquePropertyIds.length);

  await d1
    .prepare(
      `INSERT INTO water_bills (id, reference, total_amount, invoice_key, invoice_content_type, invoice_file_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      waterBillId,
      reference,
      input.totalAmount,
      invoiceKey,
      input.invoiceContentType ?? null,
      input.invoiceFileName ?? null,
      new Date().toISOString(),
    )
    .run();

  for (const propertyId of uniquePropertyIds) {
    await d1
      .prepare(
        `INSERT INTO water_bill_allocations (id, water_bill_id, property_id, amount, charge_id, applied_at)
         VALUES (?, ?, ?, ?, NULL, NULL)`,
      )
      .bind(createId("wsh"), waterBillId, propertyId, perPropertyAmount)
      .run();
  }

  let appliedCount = 0;
  for (const propertyId of uniquePropertyIds) {
    const applied = await tryApplyAllocation(d1, propertyId, reference);
    if (applied) {
      appliedCount += 1;
    }
  }

  return {
    appliedCount,
    pendingCount: uniquePropertyIds.length - appliedCount,
    perPropertyAmount,
    waterBillId,
  };
}

/** Applies one property's still-unapplied allocation(s) for `reference` to that property's existing charge, if any. */
async function tryApplyAllocation(
  d1: D1Binding,
  propertyId: string,
  reference: string,
): Promise<boolean> {
  const contract = await d1
    .prepare(
      "SELECT id FROM contracts WHERE property_id = ? AND status IN ('active', 'expiring') LIMIT 1",
    )
    .bind(propertyId)
    .first<{ id: string }>();
  if (!contract) {
    return false;
  }

  const charge = await d1
    .prepare(
      "SELECT id FROM charges WHERE contract_id = ? AND reference = ? AND status != 'cancelled' LIMIT 1",
    )
    .bind(contract.id, reference)
    .first<{ id: string }>();
  if (!charge) {
    return false;
  }

  return applyPendingWaterAllocations(propertyId, reference, charge.id);
}

/**
 * Folds every still-unapplied water allocation for (propertyId, reference)
 * into `chargeId`: adds the total to `original_amount` and `water_amount`,
 * then marks those allocations as applied. Called both right after a new
 * charge is created (see charge-scheduler.ts) and from
 * `createWaterBillRateio` when the charge already existed. Safe to call even
 * when there's nothing pending (no-op).
 */
export async function applyPendingWaterAllocations(
  propertyId: string,
  reference: string,
  chargeId: string,
): Promise<boolean> {
  const d1 = getD1();
  const pending = await d1
    .prepare(
      "SELECT id, amount FROM water_bill_allocations WHERE property_id = ? AND applied_at IS NULL AND water_bill_id IN (SELECT id FROM water_bills WHERE reference = ?)",
    )
    .bind(propertyId, reference)
    .all<{ id: string; amount: number }>();

  if (pending.results.length === 0) {
    return false;
  }

  const total = roundCents(pending.results.reduce((sum, row) => sum + row.amount, 0));

  await d1
    .prepare(
      "UPDATE charges SET original_amount = original_amount + ?, water_amount = COALESCE(water_amount, 0) + ? WHERE id = ?",
    )
    .bind(total, total, chargeId)
    .run();

  const now = new Date().toISOString();
  for (const row of pending.results) {
    await d1
      .prepare("UPDATE water_bill_allocations SET applied_at = ?, charge_id = ? WHERE id = ?")
      .bind(now, chargeId, row.id)
      .run();
  }

  return true;
}

type WaterBillRow = {
  id: string;
  reference: string;
  total_amount: number;
  invoice_key: string | null;
  invoice_file_name: string | null;
  created_at: string;
};

type WaterBillAllocationRow = {
  id: string;
  water_bill_id: string;
  property_id: string;
  property_name: string;
  amount: number;
  charge_id: string | null;
  applied_at: string | null;
};

export async function listWaterBills(): Promise<WaterBill[]> {
  const d1 = getD1();
  await ensureWaterBillTables(d1);

  const [bills, allocations] = await Promise.all([
    d1.prepare("SELECT * FROM water_bills ORDER BY created_at DESC").all<WaterBillRow>(),
    d1
      .prepare(
        `SELECT a.*, p.name as property_name
         FROM water_bill_allocations a
         JOIN properties p ON p.id = a.property_id
         ORDER BY p.name ASC`,
      )
      .all<WaterBillAllocationRow>(),
  ]);

  const allocationsByBill = new Map<string, WaterBillAllocation[]>();
  for (const row of allocations.results) {
    const list = allocationsByBill.get(row.water_bill_id) ?? [];
    list.push({
      amount: row.amount,
      applied: Boolean(row.applied_at),
      chargeId: row.charge_id,
      id: row.id,
      propertyId: row.property_id,
      propertyName: row.property_name,
    });
    allocationsByBill.set(row.water_bill_id, list);
  }

  return bills.results.map((row) => ({
    allocations: allocationsByBill.get(row.id) ?? [],
    createdAt: row.created_at,
    id: row.id,
    invoiceFileName: row.invoice_file_name,
    reference: row.reference,
    totalAmount: row.total_amount,
  }));
}

export async function getWaterBillInvoiceBinary(waterBillId: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT invoice_key, invoice_content_type, invoice_file_name FROM water_bills WHERE id = ?",
    )
    .bind(waterBillId)
    .first<{ invoice_key: string | null; invoice_content_type: string | null; invoice_file_name: string | null }>();

  if (!row?.invoice_key) {
    return null;
  }

  const object = await getR2().get(row.invoice_key);
  if (!object) {
    return null;
  }

  return {
    bytes: await object.arrayBuffer(),
    contentType: row.invoice_content_type ?? "application/octet-stream",
    fileName: row.invoice_file_name ?? "fatura-agua",
  };
}
