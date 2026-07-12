import { getD1, getR2, type D1Binding } from "../../db";
import { ensureColumn } from "./auth-repository";

/**
 * Rateio (apportionment): the admin enters the total amount of a shared bill
 * for a given month — water, condominio, gas, internet, or anything else
 * (see RATEIO_CATEGORIES) — picks which properties share it (not necessarily
 * all of them, e.g. a property with its own separate hydrometer would be left
 * out), optionally attaches the invoice/receipt file, and the amount is split
 * across the selected properties (evenly, or weighted by each property's
 * number of residents). Each property's share is added on top of that
 * month's rent charge for the contract tied to it.
 *
 * This was originally water-bill-only ("water_bills" table); generalized so
 * a single mechanism covers any recurring shared expense. Renamed cleanly
 * (no migration/back-compat needed) since the feature had not yet reached a
 * working production deploy under the old name.
 *
 * Ordering isn't assumed: the charge for a given contract/month may already
 * exist (rateio entered after the automatic charge sweep already ran) or not
 * yet (rateio entered ahead of time). Allocations that can't be applied
 * immediately are left pending (`applied_at` null) and picked up later by
 * `applyPendingRateioAllocations`, called right after a new charge is
 * inserted (see app/lib/charge-scheduler.ts).
 */

export const ACCEPTED_INVOICE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export type AcceptedInvoiceContentType = (typeof ACCEPTED_INVOICE_CONTENT_TYPES)[number];

export const MAX_INVOICE_BYTES = 8 * 1024 * 1024; // 8MB

/** Suggested categories shown in the UI. "outro" covers anything not listed — describe it in `description`. */
export const RATEIO_CATEGORIES = [
  { label: "Agua", value: "agua" },
  { label: "Condominio", value: "condominio" },
  { label: "Gas", value: "gas" },
  { label: "Internet/TV", value: "internet" },
  { label: "IPTU", value: "iptu" },
  { label: "Outro", value: "outro" },
] as const;
export type RateioCategory = (typeof RATEIO_CATEGORIES)[number]["value"];

export function rateioCategoryLabel(category: string): string {
  return RATEIO_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export type RateioAllocation = {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  applied: boolean;
  chargeId: string | null;
};

export type Rateio = {
  id: string;
  category: string;
  description: string | null;
  reference: string;
  totalAmount: number;
  invoiceFileName: string | null;
  createdAt: string;
  allocations: RateioAllocation[];
  splitMode: RateioSplitMode;
};

export type RateioSplitMode = "equal" | "residents";

export type PropertyResidentInfo = {
  propertyId: string;
  tenantName: string | null;
  /** Null when the property has no active contract/tenant, or the tenant never informed it. */
  residentCount: number | null;
};

/**
 * For each property, looks up the tenant on its currently active (or
 * expiring) contract and returns how many residents they declared. Used both
 * to preview a "fair" rateio (weighted by headcount instead of split evenly)
 * and to compute it server-side. Properties without an active contract, or
 * whose tenant never informed a resident count, come back with
 * `residentCount: null` — callers should treat that as 1 (i.e. don't let a
 * missing number zero out that property's share).
 */
export async function getResidentInfoForProperties(
  propertyIds: string[],
): Promise<Map<string, PropertyResidentInfo>> {
  const d1 = getD1();
  const result = new Map<string, PropertyResidentInfo>();
  if (propertyIds.length === 0) {
    return result;
  }

  const placeholders = propertyIds.map(() => "?").join(", ");
  const rows = await d1
    .prepare(
      `SELECT c.property_id as property_id, t.name as tenant_name, t.resident_count as resident_count
       FROM contracts c
       JOIN tenants t ON t.id = c.tenant_id
       WHERE c.property_id IN (${placeholders}) AND c.status IN ('active', 'expiring')`,
    )
    .bind(...propertyIds)
    .all<{ property_id: string; tenant_name: string; resident_count: number | null }>();

  for (const row of rows.results) {
    result.set(row.property_id, {
      propertyId: row.property_id,
      residentCount: row.resident_count ?? null,
      tenantName: row.tenant_name,
    });
  }

  for (const propertyId of propertyIds) {
    if (!result.has(propertyId)) {
      result.set(propertyId, { propertyId, residentCount: null, tenantName: null });
    }
  }

  return result;
}

/**
 * Splits `totalAmount` across `weights` (one non-negative number per key),
 * proportionally. Rounds every share to cents and folds the rounding
 * remainder into the last entry so the shares always add up exactly to
 * `totalAmount`.
 */
function splitByWeights(
  totalAmount: number,
  weights: Array<{ key: string; weight: number }>,
): Map<string, number> {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0) || weights.length;
  const shares = new Map<string, number>();
  let allocated = 0;

  weights.forEach((item, index) => {
    const isLast = index === weights.length - 1;
    if (isLast) {
      shares.set(item.key, roundCents(totalAmount - allocated));
      return;
    }
    const share = roundCents((totalAmount * item.weight) / totalWeight);
    shares.set(item.key, share);
    allocated += share;
  });

  return shares;
}

export async function ensureRateioTables(d1: D1Binding = getD1()) {
  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS rateios (
        id text PRIMARY KEY NOT NULL,
        category text NOT NULL DEFAULT 'outro',
        description text,
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
      `CREATE TABLE IF NOT EXISTS rateio_allocations (
        id text PRIMARY KEY NOT NULL,
        rateio_id text NOT NULL REFERENCES rateios(id),
        property_id text NOT NULL REFERENCES properties(id),
        amount real NOT NULL,
        charge_id text,
        applied_at text
      )`,
    )
    .run();

  // Additive: lets a charge show "aluguel + rateio" separately even though
  // `original_amount` already includes the rateio share (see mercadopago.ts).
  await ensureColumn(d1, "charges", "rateio_amount", "rateio_amount real");

  // Remembers how the rateio was split so editing it later (updateRateio)
  // recomputes allocations the same way by default, instead of silently
  // switching modes. Rateios created before this column existed default to
  // "residents" (the UI's historical default) — best-effort guess, not a
  // guarantee of how they were actually split originally.
  await ensureColumn(d1, "rateios", "split_mode", "split_mode text DEFAULT 'residents'");
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

function assertAcceptedInvoiceType(contentType: string) {
  if (!ACCEPTED_INVOICE_CONTENT_TYPES.includes(contentType as AcceptedInvoiceContentType)) {
    throw new Error("Formato nao suportado. Envie o comprovante em JPG, PNG ou PDF.");
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
 * Shared by createRateio and updateRateio: computes each property's share
 * (evenly, or weighted by resident count), inserts one `rateio_allocations`
 * row per property (all starting unapplied), then immediately tries to fold
 * each into its property's existing charge for `reference` (see
 * `tryApplyAllocation`) — same as before, just factored out so editing an
 * existing rateio recomputes and re-applies exactly like creating one does.
 */
async function computeAndInsertAllocations(
  d1: D1Binding,
  rateioId: string,
  totalAmount: number,
  propertyIds: string[],
  splitMode: RateioSplitMode,
  reference: string,
): Promise<{ amountsByProperty: Record<string, number>; appliedCount: number }> {
  let weights: Array<{ key: string; weight: number }>;
  if (splitMode === "residents") {
    const residentInfo = await getResidentInfoForProperties(propertyIds);
    weights = propertyIds.map((propertyId) => ({
      key: propertyId,
      weight: residentInfo.get(propertyId)?.residentCount ?? 1,
    }));
  } else {
    weights = propertyIds.map((propertyId) => ({ key: propertyId, weight: 1 }));
  }

  const amountsByProperty = Object.fromEntries(splitByWeights(totalAmount, weights));

  for (const propertyId of propertyIds) {
    await d1
      .prepare(
        `INSERT INTO rateio_allocations (id, rateio_id, property_id, amount, charge_id, applied_at)
         VALUES (?, ?, ?, ?, NULL, NULL)`,
      )
      .bind(createId("rlc"), rateioId, propertyId, amountsByProperty[propertyId])
      .run();
  }

  let appliedCount = 0;
  for (const propertyId of propertyIds) {
    const applied = await tryApplyAllocation(d1, propertyId, reference);
    if (applied) {
      appliedCount += 1;
    }
  }

  return { amountsByProperty, appliedCount };
}

/**
 * Subtracts every already-applied allocation of this rateio back out of the
 * charge it was folded into (undoing `applyPendingRateioAllocations`), then
 * leaves the allocation rows themselves untouched — callers delete them
 * right after. Allocations that were never applied (no linked charge yet)
 * need no reversal. Floors at 0 as a defensive guard; should never actually
 * go negative since we only ever subtract what this rateio itself added.
 */
async function reverseAppliedAllocations(d1: D1Binding, rateioId: string): Promise<void> {
  const allocations = await d1
    .prepare(
      "SELECT amount, charge_id, applied_at FROM rateio_allocations WHERE rateio_id = ?",
    )
    .bind(rateioId)
    .all<{ amount: number; charge_id: string | null; applied_at: string | null }>();

  for (const row of allocations.results) {
    if (row.applied_at && row.charge_id) {
      await d1
        .prepare(
          `UPDATE charges SET
             original_amount = MAX(0, original_amount - ?),
             rateio_amount = MAX(0, COALESCE(rateio_amount, 0) - ?)
           WHERE id = ?`,
        )
        .bind(row.amount, row.amount, row.charge_id)
        .run();
    }
  }
}

/**
 * Editing or deleting a rateio whose allocation was already folded into a
 * *paid* charge would silently change a charge amount after the tenant
 * already paid it — that's a bigger problem than the operational mistake
 * being fixed, so it's blocked outright. Unpaid charges (open/overdue) are
 * fine to adjust, since nothing has been reconciled against them yet.
 */
async function assertNoLinkedPaidCharge(d1: D1Binding, rateioId: string): Promise<void> {
  const paidCharge = await d1
    .prepare(
      `SELECT c.id FROM rateio_allocations a
       JOIN charges c ON c.id = a.charge_id
       WHERE a.rateio_id = ? AND c.status = 'paid'
       LIMIT 1`,
    )
    .bind(rateioId)
    .first<{ id: string }>();

  if (paidCharge) {
    throw new Error(
      "Nao e possivel editar ou excluir: este rateio ja esta aplicado a uma cobranca paga. Ajuste a cobranca manualmente se necessario.",
    );
  }
}

/**
 * Creates a rateio: splits `totalAmount` across `propertyIds` — evenly, or
 * weighted by each property's number of residents (see `splitMode`) — and
 * applies each share to that property's contract charge for `reference`
 * (immediately if the charge already exists; otherwise the share is left
 * pending for `applyPendingRateioAllocations` to pick up once the charge is
 * generated).
 */
export async function createRateio(input: {
  category: string;
  description?: string;
  reference: string;
  totalAmount: number;
  propertyIds: string[];
  /** "equal" (default) splits the total evenly; "residents" weights each property's share by its tenant's resident count (properties with no count informed count as 1 resident). */
  splitMode?: RateioSplitMode;
  invoiceBase64?: string;
  invoiceContentType?: string;
  invoiceFileName?: string;
}): Promise<{
  rateioId: string;
  perPropertyAmount: number;
  appliedCount: number;
  pendingCount: number;
  amountsByProperty: Record<string, number>;
}> {
  const d1 = getD1();
  await ensureRateioTables(d1);

  const category = input.category.trim();
  if (!category) {
    throw new Error("Informe a categoria do rateio.");
  }
  const reference = input.reference.trim();
  if (!reference) {
    throw new Error("Informe o mes/ano de referencia.");
  }
  const uniquePropertyIds = Array.from(new Set(input.propertyIds));
  if (uniquePropertyIds.length === 0) {
    throw new Error("Selecione ao menos um imovel para o rateio.");
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("Informe um valor total valido para o rateio.");
  }

  let invoiceKey: string | null = null;
  const rateioId = createId("rateio");

  if (input.invoiceBase64) {
    if (!input.invoiceContentType || !input.invoiceFileName) {
      throw new Error("Dados do arquivo do comprovante incompletos.");
    }
    assertAcceptedInvoiceType(input.invoiceContentType);
    assertInvoiceSizeWithinLimit(input.invoiceBase64);

    const bytes = base64ToBytes(input.invoiceBase64);
    invoiceKey = `rateios/${rateioId}/${Date.now()}-${sanitizeFileName(input.invoiceFileName)}`;
    await getR2().put(invoiceKey, bytes, {
      httpMetadata: { contentType: input.invoiceContentType },
    });
  }

  const splitMode = input.splitMode ?? "equal";
  const perPropertyAmount = roundCents(input.totalAmount / uniquePropertyIds.length);

  await d1
    .prepare(
      `INSERT INTO rateios (id, category, description, reference, total_amount, invoice_key, invoice_content_type, invoice_file_name, created_at, split_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      rateioId,
      category,
      input.description?.trim() || null,
      reference,
      input.totalAmount,
      invoiceKey,
      input.invoiceContentType ?? null,
      input.invoiceFileName ?? null,
      new Date().toISOString(),
      splitMode,
    )
    .run();

  const { amountsByProperty, appliedCount } = await computeAndInsertAllocations(
    d1,
    rateioId,
    input.totalAmount,
    uniquePropertyIds,
    splitMode,
    reference,
  );

  return {
    amountsByProperty,
    appliedCount,
    pendingCount: uniquePropertyIds.length - appliedCount,
    perPropertyAmount,
    rateioId,
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

  return applyPendingRateioAllocations(propertyId, reference, charge.id);
}

/**
 * Folds every still-unapplied rateio allocation for (propertyId, reference)
 * into `chargeId`: adds the total to `original_amount` and `rateio_amount`,
 * then marks those allocations as applied. Called both right after a new
 * charge is created (see charge-scheduler.ts) and from `createRateio` when
 * the charge already existed. Safe to call even when there's nothing pending
 * (no-op).
 */
export async function applyPendingRateioAllocations(
  propertyId: string,
  reference: string,
  chargeId: string,
): Promise<boolean> {
  const d1 = getD1();
  const pending = await d1
    .prepare(
      "SELECT id, amount FROM rateio_allocations WHERE property_id = ? AND applied_at IS NULL AND rateio_id IN (SELECT id FROM rateios WHERE reference = ?)",
    )
    .bind(propertyId, reference)
    .all<{ id: string; amount: number }>();

  if (pending.results.length === 0) {
    return false;
  }

  const total = roundCents(pending.results.reduce((sum, row) => sum + row.amount, 0));

  await d1
    .prepare(
      "UPDATE charges SET original_amount = original_amount + ?, rateio_amount = COALESCE(rateio_amount, 0) + ? WHERE id = ?",
    )
    .bind(total, total, chargeId)
    .run();

  const now = new Date().toISOString();
  for (const row of pending.results) {
    await d1
      .prepare("UPDATE rateio_allocations SET applied_at = ?, charge_id = ? WHERE id = ?")
      .bind(now, chargeId, row.id)
      .run();
  }

  return true;
}

/**
 * Corrects an existing rateio (wrong amount, wrong properties, wrong
 * category/mes, etc.) — operational mistakes are expected here. Reverses
 * whatever this rateio had already applied to charges, replaces the
 * allocation rows entirely, and recomputes/re-applies from scratch with the
 * new inputs — same math `createRateio` uses, just against an existing row
 * instead of a new one. Blocked (see `assertNoLinkedPaidCharge`) if any of
 * its allocations already landed on a paid charge.
 */
export async function updateRateio(input: {
  id: string;
  category: string;
  description?: string;
  reference: string;
  totalAmount: number;
  propertyIds: string[];
  splitMode?: RateioSplitMode;
  /** Optional: replaces the attached invoice/receipt. Omit to keep the existing one untouched. */
  invoiceBase64?: string;
  invoiceContentType?: string;
  invoiceFileName?: string;
}): Promise<{
  perPropertyAmount: number;
  appliedCount: number;
  pendingCount: number;
  amountsByProperty: Record<string, number>;
}> {
  const d1 = getD1();
  await ensureRateioTables(d1);

  const existing = await d1
    .prepare("SELECT id FROM rateios WHERE id = ?")
    .bind(input.id)
    .first<{ id: string }>();
  if (!existing) {
    throw new Error("Rateio nao encontrado.");
  }

  await assertNoLinkedPaidCharge(d1, input.id);

  const category = input.category.trim();
  if (!category) {
    throw new Error("Informe a categoria do rateio.");
  }
  const reference = input.reference.trim();
  if (!reference) {
    throw new Error("Informe o mes/ano de referencia.");
  }
  const uniquePropertyIds = Array.from(new Set(input.propertyIds));
  if (uniquePropertyIds.length === 0) {
    throw new Error("Selecione ao menos um imovel para o rateio.");
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("Informe um valor total valido para o rateio.");
  }

  // Undo whatever this rateio had already folded into charges, then drop the
  // old allocation rows — computeAndInsertAllocations below rebuilds them.
  await reverseAppliedAllocations(d1, input.id);
  await d1.prepare("DELETE FROM rateio_allocations WHERE rateio_id = ?").bind(input.id).run();

  const splitMode = input.splitMode ?? "equal";
  const perPropertyAmount = roundCents(input.totalAmount / uniquePropertyIds.length);

  await d1
    .prepare(
      "UPDATE rateios SET category = ?, description = ?, reference = ?, total_amount = ?, split_mode = ? WHERE id = ?",
    )
    .bind(category, input.description?.trim() || null, reference, input.totalAmount, splitMode, input.id)
    .run();

  if (input.invoiceBase64) {
    if (!input.invoiceContentType || !input.invoiceFileName) {
      throw new Error("Dados do arquivo do comprovante incompletos.");
    }
    assertAcceptedInvoiceType(input.invoiceContentType);
    assertInvoiceSizeWithinLimit(input.invoiceBase64);

    const previous = await d1
      .prepare("SELECT invoice_key FROM rateios WHERE id = ?")
      .bind(input.id)
      .first<{ invoice_key: string | null }>();
    if (previous?.invoice_key) {
      await getR2()
        .delete(previous.invoice_key)
        .catch(() => undefined);
    }

    const bytes = base64ToBytes(input.invoiceBase64);
    const invoiceKey = `rateios/${input.id}/${Date.now()}-${sanitizeFileName(input.invoiceFileName)}`;
    await getR2().put(invoiceKey, bytes, {
      httpMetadata: { contentType: input.invoiceContentType },
    });

    await d1
      .prepare(
        "UPDATE rateios SET invoice_key = ?, invoice_content_type = ?, invoice_file_name = ? WHERE id = ?",
      )
      .bind(invoiceKey, input.invoiceContentType, input.invoiceFileName, input.id)
      .run();
  }

  const { amountsByProperty, appliedCount } = await computeAndInsertAllocations(
    d1,
    input.id,
    input.totalAmount,
    uniquePropertyIds,
    splitMode,
    reference,
  );

  return {
    amountsByProperty,
    appliedCount,
    pendingCount: uniquePropertyIds.length - appliedCount,
    perPropertyAmount,
  };
}

/**
 * Removes a rateio entirely: reverses its effect on any charge it had
 * already been folded into, deletes its allocation rows, its attached
 * invoice/receipt (if any) from R2, and finally the rateio row itself.
 * Blocked (see `assertNoLinkedPaidCharge`) if any of its allocations already
 * landed on a paid charge.
 */
export async function deleteRateio(rateioId: string): Promise<void> {
  const d1 = getD1();
  await ensureRateioTables(d1);

  const existing = await d1
    .prepare("SELECT invoice_key FROM rateios WHERE id = ?")
    .bind(rateioId)
    .first<{ invoice_key: string | null }>();
  if (!existing) {
    throw new Error("Rateio nao encontrado.");
  }

  await assertNoLinkedPaidCharge(d1, rateioId);
  await reverseAppliedAllocations(d1, rateioId);

  if (existing.invoice_key) {
    await getR2()
      .delete(existing.invoice_key)
      .catch(() => undefined);
  }

  await d1.prepare("DELETE FROM rateio_allocations WHERE rateio_id = ?").bind(rateioId).run();
  await d1.prepare("DELETE FROM rateios WHERE id = ?").bind(rateioId).run();
}

/** Distinct rateio categories (e.g. ["agua", "condominio"]) already folded into a given charge. */
export async function getRateioCategoriesForCharge(chargeId: string): Promise<string[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare(
      `SELECT DISTINCT r.category as category
       FROM rateio_allocations a
       JOIN rateios r ON r.id = a.rateio_id
       WHERE a.charge_id = ?`,
    )
    .bind(chargeId)
    .all<{ category: string }>();
  return rows.results.map((row) => row.category);
}

type RateioRow = {
  id: string;
  category: string;
  description: string | null;
  reference: string;
  total_amount: number;
  invoice_key: string | null;
  invoice_file_name: string | null;
  created_at: string;
  split_mode: string | null;
};

type RateioAllocationRow = {
  id: string;
  rateio_id: string;
  property_id: string;
  property_name: string;
  amount: number;
  charge_id: string | null;
  applied_at: string | null;
};

export async function listRateios(): Promise<Rateio[]> {
  const d1 = getD1();
  await ensureRateioTables(d1);

  const [rateios, allocations] = await Promise.all([
    d1.prepare("SELECT * FROM rateios ORDER BY created_at DESC").all<RateioRow>(),
    d1
      .prepare(
        `SELECT a.*, p.name as property_name
         FROM rateio_allocations a
         JOIN properties p ON p.id = a.property_id
         ORDER BY p.name ASC`,
      )
      .all<RateioAllocationRow>(),
  ]);

  const allocationsByRateio = new Map<string, RateioAllocation[]>();
  for (const row of allocations.results) {
    const list = allocationsByRateio.get(row.rateio_id) ?? [];
    list.push({
      amount: row.amount,
      applied: Boolean(row.applied_at),
      chargeId: row.charge_id,
      id: row.id,
      propertyId: row.property_id,
      propertyName: row.property_name,
    });
    allocationsByRateio.set(row.rateio_id, list);
  }

  return rateios.results.map((row) => ({
    allocations: allocationsByRateio.get(row.id) ?? [],
    category: row.category,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    invoiceFileName: row.invoice_file_name,
    reference: row.reference,
    splitMode: row.split_mode === "equal" ? "equal" : "residents",
    totalAmount: row.total_amount,
  }));
}

export async function getRateioInvoiceBinary(rateioId: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT invoice_key, invoice_content_type, invoice_file_name FROM rateios WHERE id = ?",
    )
    .bind(rateioId)
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
    fileName: row.invoice_file_name ?? "comprovante-rateio",
  };
}
