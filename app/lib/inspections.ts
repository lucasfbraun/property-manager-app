import { getD1, getR2, type D1Binding } from "../../db";
import { ensureColumn } from "./auth-repository";
import { createId } from "./ids";

/** Only formats pdf-lib can embed directly (no transcoding pipeline available in Workers). */
export const ACCEPTED_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;
export type AcceptedPhotoContentType = (typeof ACCEPTED_PHOTO_CONTENT_TYPES)[number];

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB per photo
export const MAX_INSPECTION_PHOTOS = 30;
export const MAX_OCCURRENCE_PHOTOS = 8;

export type InspectionPhoto = {
  id: string;
  contractId: string;
  fileName: string;
  contentType: string;
  caption: string | null;
  room: string | null;
  position: number;
  createdAt: string;
};

export type OccurrenceStatus = "open" | "in_review" | "resolved";

export type ContractOccurrence = {
  id: string;
  contractId: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  description: string;
  status: OccurrenceStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  photos: OccurrencePhoto[];
};

export type OccurrencePhoto = {
  id: string;
  occurrenceId: string;
  fileName: string;
  contentType: string;
  createdAt: string;
};

export function occurrenceStatusLabel(status: OccurrenceStatus): string {
  switch (status) {
    case "in_review":
      return "Em analise";
    case "resolved":
      return "Resolvida";
    default:
      return "Aberta";
  }
}

/** Ensures the vistoria/ocorrencia tables and the PDF-with-photos columns on `contracts` exist. */
export async function ensureInspectionTables(d1: D1Binding = getD1()) {
  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS contract_inspection_photos (
        id text PRIMARY KEY NOT NULL,
        contract_id text NOT NULL REFERENCES contracts(id),
        r2_key text NOT NULL,
        file_name text NOT NULL,
        content_type text NOT NULL,
        caption text,
        room text,
        position integer NOT NULL DEFAULT 0,
        created_at text NOT NULL
      )`,
    )
    .run();

  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS contract_occurrences (
        id text PRIMARY KEY NOT NULL,
        contract_id text NOT NULL REFERENCES contracts(id),
        tenant_id text NOT NULL REFERENCES tenants(id),
        description text NOT NULL,
        status text NOT NULL DEFAULT 'open',
        created_at text NOT NULL,
        resolved_at text,
        resolution_note text
      )`,
    )
    .run();

  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS contract_occurrence_photos (
        id text PRIMARY KEY NOT NULL,
        occurrence_id text NOT NULL REFERENCES contract_occurrences(id),
        r2_key text NOT NULL,
        file_name text NOT NULL,
        content_type text NOT NULL,
        created_at text NOT NULL
      )`,
    )
    .run();

  // The PDF generated from a template now embeds the vistoria photos; stored
  // separately from `contract_text` (plain text) so both remain available.
  await ensureColumn(d1, "contracts", "generated_document_key", "generated_document_key text");
  await ensureColumn(
    d1,
    "contracts",
    "generated_document_updated_at",
    "generated_document_updated_at text",
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

function assertAcceptedContentType(contentType: string) {
  if (!ACCEPTED_PHOTO_CONTENT_TYPES.includes(contentType as AcceptedPhotoContentType)) {
    throw new Error(
      "Formato de imagem nao suportado. Envie uma foto em JPG ou PNG (fotos em HEIC precisam ser convertidas antes do envio).",
    );
  }
}

function assertSizeWithinLimit(fileBase64: string) {
  const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_PHOTO_BYTES) {
    throw new Error(
      `Foto muito grande (limite de ${(MAX_PHOTO_BYTES / (1024 * 1024)).toFixed(0)}MB por arquivo).`,
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

// ---------------------------------------------------------------------------
// Vistoria (inspection) photos
// ---------------------------------------------------------------------------

type InspectionPhotoRow = {
  id: string;
  contract_id: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  caption: string | null;
  room: string | null;
  position: number;
  created_at: string;
};

function mapInspectionPhoto(row: InspectionPhotoRow): InspectionPhoto {
  return {
    caption: row.caption,
    contentType: row.content_type,
    contractId: row.contract_id,
    createdAt: row.created_at,
    fileName: row.file_name,
    id: row.id,
    position: row.position,
    room: row.room,
  };
}

export async function listInspectionPhotos(contractId: string): Promise<InspectionPhoto[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare(
      "SELECT * FROM contract_inspection_photos WHERE contract_id = ? ORDER BY position ASC, created_at ASC",
    )
    .bind(contractId)
    .all<InspectionPhotoRow>();
  return rows.results.map(mapInspectionPhoto);
}

export async function addInspectionPhoto(input: {
  contractId: string;
  fileBase64: string;
  fileName: string;
  contentType: string;
  caption?: string;
  room?: string;
}): Promise<string> {
  assertAcceptedContentType(input.contentType);
  assertSizeWithinLimit(input.fileBase64);

  const d1 = getD1();

  const contract = await d1
    .prepare("SELECT id FROM contracts WHERE id = ?")
    .bind(input.contractId)
    .first<{ id: string }>();
  if (!contract) {
    throw new Error("Contrato nao encontrado.");
  }

  const countRow = await d1
    .prepare("SELECT COUNT(*) AS total FROM contract_inspection_photos WHERE contract_id = ?")
    .bind(input.contractId)
    .first<{ total: number }>();
  const currentCount = countRow?.total ?? 0;
  if (currentCount >= MAX_INSPECTION_PHOTOS) {
    throw new Error(`Limite de ${MAX_INSPECTION_PHOTOS} fotos de vistoria por contrato atingido.`);
  }

  const id = createId("insp");
  const objectKey = `inspections/${input.contractId}/${Date.now()}-${sanitizeFileName(input.fileName)}`;
  const bytes = base64ToBytes(input.fileBase64);

  await getR2().put(objectKey, bytes, {
    httpMetadata: { contentType: input.contentType },
  });

  await d1
    .prepare(
      `INSERT INTO contract_inspection_photos
        (id, contract_id, r2_key, file_name, content_type, caption, room, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.contractId,
      objectKey,
      input.fileName,
      input.contentType,
      input.caption?.trim() || null,
      input.room?.trim() || null,
      currentCount,
      new Date().toISOString(),
    )
    .run();

  return id;
}

export async function deleteInspectionPhoto(input: { id: string; contractId: string }) {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT r2_key FROM contract_inspection_photos WHERE id = ? AND contract_id = ?",
    )
    .bind(input.id, input.contractId)
    .first<{ r2_key: string }>();

  if (!row) {
    throw new Error("Foto de vistoria nao encontrada.");
  }

  await d1
    .prepare("DELETE FROM contract_inspection_photos WHERE id = ?")
    .bind(input.id)
    .run();

  try {
    await getR2().delete(row.r2_key);
  } catch (error) {
    console.error("[inspections] falha ao remover foto do R2:", error);
  }
}

/** Binary fetch for the `<img>` streaming endpoint; returns null if not found. */
export async function getInspectionPhotoBinary(photoId: string): Promise<{
  contractId: string;
  contentType: string;
  fileName: string;
  bytes: ArrayBuffer;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT contract_id, r2_key, content_type, file_name FROM contract_inspection_photos WHERE id = ?")
    .bind(photoId)
    .first<{ contract_id: string; r2_key: string; content_type: string; file_name: string }>();

  if (!row) {
    return null;
  }

  const object = await getR2().get(row.r2_key);
  if (!object) {
    return null;
  }

  return {
    bytes: await object.arrayBuffer(),
    contentType: row.content_type,
    contractId: row.contract_id,
    fileName: row.file_name,
  };
}

/** Loads photo bytes for every inspection photo of a contract, for embedding into the generated PDF. */
export async function loadInspectionPhotosForPdf(contractId: string): Promise<
  Array<{ bytes: ArrayBuffer; contentType: string; caption: string | null; room: string | null }>
> {
  const photos = await listInspectionPhotos(contractId);
  const d1 = getD1();
  const results: Array<{
    bytes: ArrayBuffer;
    contentType: string;
    caption: string | null;
    room: string | null;
  }> = [];

  for (const photo of photos) {
    const row = await d1
      .prepare("SELECT r2_key FROM contract_inspection_photos WHERE id = ?")
      .bind(photo.id)
      .first<{ r2_key: string }>();
    if (!row) continue;

    try {
      const object = await getR2().get(row.r2_key);
      if (!object) continue;
      results.push({
        bytes: await object.arrayBuffer(),
        caption: photo.caption,
        contentType: photo.contentType,
        room: photo.room,
      });
    } catch (error) {
      console.error(`[inspections] falha ao carregar foto ${photo.id} do R2:`, error);
    }
  }

  return results;
}

export async function getContractIdForInspectionPhoto(photoId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT contract_id FROM contract_inspection_photos WHERE id = ?")
    .bind(photoId)
    .first<{ contract_id: string }>();
  return row?.contract_id ?? null;
}

// ---------------------------------------------------------------------------
// Ocorrencias (tenant-reported disputes / property damage)
// ---------------------------------------------------------------------------

type OccurrenceRow = {
  id: string;
  contract_id: string;
  tenant_id: string;
  tenant_name: string;
  property_name: string;
  description: string;
  status: OccurrenceStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

type OccurrencePhotoRow = {
  id: string;
  occurrence_id: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  created_at: string;
};

function mapOccurrencePhoto(row: OccurrencePhotoRow): OccurrencePhoto {
  return {
    contentType: row.content_type,
    createdAt: row.created_at,
    fileName: row.file_name,
    id: row.id,
    occurrenceId: row.occurrence_id,
  };
}

async function attachPhotos(d1: D1Binding, occurrences: OccurrenceRow[]): Promise<ContractOccurrence[]> {
  if (occurrences.length === 0) {
    return [];
  }

  const placeholders = occurrences.map(() => "?").join(",");
  const photoRows = await d1
    .prepare(
      `SELECT * FROM contract_occurrence_photos WHERE occurrence_id IN (${placeholders}) ORDER BY created_at ASC`,
    )
    .bind(...occurrences.map((item) => item.id))
    .all<OccurrencePhotoRow>();

  const photosByOccurrence = new Map<string, OccurrencePhoto[]>();
  for (const row of photoRows.results) {
    const list = photosByOccurrence.get(row.occurrence_id) ?? [];
    list.push(mapOccurrencePhoto(row));
    photosByOccurrence.set(row.occurrence_id, list);
  }

  return occurrences.map((row) => ({
    contractId: row.contract_id,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    photos: photosByOccurrence.get(row.id) ?? [],
    propertyName: row.property_name,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    status: row.status,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
  }));
}

const OCCURRENCE_JOIN_SELECT = `
  SELECT o.*, t.name as tenant_name, p.name as property_name
  FROM contract_occurrences o
  JOIN tenants t ON t.id = o.tenant_id
  JOIN contracts c ON c.id = o.contract_id
  JOIN properties p ON p.id = c.property_id
`;

export async function listOccurrencesForAdmin(): Promise<ContractOccurrence[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare(`${OCCURRENCE_JOIN_SELECT} ORDER BY o.created_at DESC`)
    .all<OccurrenceRow>();
  return attachPhotos(d1, rows.results);
}

export async function listOccurrencesForTenant(tenantId: string): Promise<ContractOccurrence[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare(`${OCCURRENCE_JOIN_SELECT} WHERE o.tenant_id = ? ORDER BY o.created_at DESC`)
    .bind(tenantId)
    .all<OccurrenceRow>();
  return attachPhotos(d1, rows.results);
}

export async function createOccurrence(input: {
  contractId: string;
  tenantId: string;
  description: string;
  photos: Array<{ fileBase64: string; fileName: string; contentType: string }>;
}): Promise<{
  id: string;
  tenantName: string;
  propertyName: string;
}> {
  if (input.photos.length > MAX_OCCURRENCE_PHOTOS) {
    throw new Error(`Envie no maximo ${MAX_OCCURRENCE_PHOTOS} fotos por ocorrencia.`);
  }
  for (const photo of input.photos) {
    assertAcceptedContentType(photo.contentType);
    assertSizeWithinLimit(photo.fileBase64);
  }

  const d1 = getD1();
  const contractRow = await d1
    .prepare(
      `SELECT c.tenant_id as tenant_id, t.name as tenant_name, p.name as property_name
       FROM contracts c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN properties p ON p.id = c.property_id
       WHERE c.id = ?`,
    )
    .bind(input.contractId)
    .first<{ tenant_id: string; tenant_name: string; property_name: string }>();

  if (!contractRow || contractRow.tenant_id !== input.tenantId) {
    throw new Error("Contrato nao encontrado para este inquilino.");
  }

  const id = createId("occ");
  const now = new Date().toISOString();

  await d1
    .prepare(
      `INSERT INTO contract_occurrences (id, contract_id, tenant_id, description, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`,
    )
    .bind(id, input.contractId, input.tenantId, input.description, now)
    .run();

  for (const photo of input.photos) {
    const photoId = createId("occph");
    const objectKey = `occurrences/${id}/${Date.now()}-${sanitizeFileName(photo.fileName)}`;
    const bytes = base64ToBytes(photo.fileBase64);
    await getR2().put(objectKey, bytes, { httpMetadata: { contentType: photo.contentType } });
    await d1
      .prepare(
        `INSERT INTO contract_occurrence_photos (id, occurrence_id, r2_key, file_name, content_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(photoId, id, objectKey, photo.fileName, photo.contentType, new Date().toISOString())
      .run();
  }

  return {
    id,
    propertyName: contractRow.property_name,
    tenantName: contractRow.tenant_name,
  };
}

export async function updateOccurrenceStatus(input: {
  id: string;
  status: OccurrenceStatus;
  resolutionNote?: string;
}): Promise<{
  tenantEmail: string;
  tenantName: string;
  propertyName: string;
}> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT o.id as id, t.email as tenant_email, t.name as tenant_name, p.name as property_name
       FROM contract_occurrences o
       JOIN tenants t ON t.id = o.tenant_id
       JOIN contracts c ON c.id = o.contract_id
       JOIN properties p ON p.id = c.property_id
       WHERE o.id = ?`,
    )
    .bind(input.id)
    .first<{ id: string; tenant_email: string; tenant_name: string; property_name: string }>();

  if (!row) {
    throw new Error("Ocorrencia nao encontrada.");
  }

  await d1
    .prepare(
      `UPDATE contract_occurrences SET status = ?, resolution_note = ?, resolved_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.status,
      input.resolutionNote?.trim() || null,
      input.status === "resolved" ? new Date().toISOString() : null,
      input.id,
    )
    .run();

  return {
    propertyName: row.property_name,
    tenantEmail: row.tenant_email,
    tenantName: row.tenant_name,
  };
}

export async function getOccurrencePhotoBinary(photoId: string): Promise<{
  occurrenceId: string;
  contentType: string;
  fileName: string;
  bytes: ArrayBuffer;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT occurrence_id, r2_key, content_type, file_name FROM contract_occurrence_photos WHERE id = ?",
    )
    .bind(photoId)
    .first<{ occurrence_id: string; r2_key: string; content_type: string; file_name: string }>();

  if (!row) {
    return null;
  }

  const object = await getR2().get(row.r2_key);
  if (!object) {
    return null;
  }

  return {
    bytes: await object.arrayBuffer(),
    contentType: row.content_type,
    fileName: row.file_name,
    occurrenceId: row.occurrence_id,
  };
}

/** Returns the tenant id who owns the contract behind an occurrence photo, for authorization checks. */
export async function getTenantIdForOccurrencePhoto(photoId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT o.tenant_id as tenant_id
       FROM contract_occurrence_photos ph
       JOIN contract_occurrences o ON o.id = ph.occurrence_id
       WHERE ph.id = ?`,
    )
    .bind(photoId)
    .first<{ tenant_id: string }>();
  return row?.tenant_id ?? null;
}

export async function getTenantIdForOccurrence(occurrenceId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT tenant_id FROM contract_occurrences WHERE id = ?")
    .bind(occurrenceId)
    .first<{ tenant_id: string }>();
  return row?.tenant_id ?? null;
}
