import { getD1, getR2, type D1Binding } from "../../db";
import { ensureColumn } from "./auth-repository";
import { formatCurrency, formatDate, type SignatureStatus } from "./rentals";
import { loadInspectionPhotosForPdf } from "./inspections";
import { buildContractPdf } from "./contract-pdf";
import { createId } from "./ids";

export type ContractTemplate = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type ContractTemplateRow = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type ContractJoinRow = {
  id: string;
  tenant_id: string;
  receiver_id: string;
  monthly_rent: number;
  due_day: number;
  starts_at: string;
  ends_at: string;
  fine_rate: number;
  monthly_interest_rate: number;
  grace_days: number;
  signature_status: SignatureStatus;
  tenant_name: string;
  tenant_document: string;
  tenant_email: string;
  tenant_whatsapp: string;
  property_name: string;
  property_address: string;
  property_type: string;
  receiver_name: string;
  receiver_document: string;
  receiver_email: string;
};

/** Reference list shown to the admin while writing/editing a template. */
export const CONTRACT_TEMPLATE_VARIABLES: Array<{ key: string; label: string }> = [
  { key: "inquilino_nome", label: "Nome do inquilino" },
  { key: "inquilino_documento", label: "CPF/CNPJ do inquilino" },
  { key: "inquilino_email", label: "E-mail do inquilino" },
  { key: "inquilino_whatsapp", label: "WhatsApp do inquilino" },
  { key: "imovel_nome", label: "Nome/identificacao do imovel" },
  { key: "imovel_endereco", label: "Endereco do imovel" },
  { key: "imovel_tipo", label: "Tipo do imovel" },
  { key: "recebedor_nome", label: "Nome do recebedor" },
  { key: "recebedor_documento", label: "CPF/CNPJ do recebedor" },
  { key: "valor_aluguel", label: "Valor mensal do aluguel (formatado)" },
  { key: "dia_vencimento", label: "Dia de vencimento" },
  { key: "data_inicio", label: "Data de inicio do contrato" },
  { key: "data_fim", label: "Data de termino do contrato" },
  { key: "multa_percentual", label: "Percentual de multa por atraso" },
  { key: "juros_percentual", label: "Percentual de juros ao mes" },
  { key: "carencia_dias", label: "Dias de carencia antes de multa/juros" },
  { key: "data_geracao", label: "Data em que o contrato foi gerado" },
];

const DEFAULT_TEMPLATE_CONTENT = `CONTRATO DE LOCACAO RESIDENCIAL

LOCADOR (recebedor): {{recebedor_nome}}, CPF/CNPJ {{recebedor_documento}}.
LOCATARIO (inquilino): {{inquilino_nome}}, CPF/CNPJ {{inquilino_documento}}, e-mail {{inquilino_email}}, WhatsApp {{inquilino_whatsapp}}.

IMOVEL LOCADO: {{imovel_nome}} ({{imovel_tipo}}), localizado em {{imovel_endereco}}.

CLAUSULA 1 - DO PRAZO
O presente contrato vigora de {{data_inicio}} ate {{data_fim}}.

CLAUSULA 2 - DO ALUGUEL
O valor mensal do aluguel e de {{valor_aluguel}}, com vencimento todo dia {{dia_vencimento}} de cada mes.

CLAUSULA 3 - DO ATRASO
Em caso de atraso no pagamento, apos {{carencia_dias}} dia(s) de carencia, incidirao multa de {{multa_percentual}}% e juros de {{juros_percentual}}% ao mes sobre o valor em aberto.

CLAUSULA 4 - DISPOSICOES GERAIS
As partes elegem o presente instrumento como prova de acordo. Este documento foi gerado automaticamente em {{data_geracao}} e deve ser revisado por um profissional antes do uso definitivo.

_____________________________________
Assinatura do locador ({{recebedor_nome}})

_____________________________________
Assinatura do locatario ({{inquilino_nome}})`;

/** Ensures the template/signature tables and columns exist, seeding one default template. */
export async function ensureContractDocumentTables(d1: D1Binding = getD1()) {
  await d1
    .prepare(
      "CREATE TABLE IF NOT EXISTS contract_templates (id text PRIMARY KEY NOT NULL, name text NOT NULL, content text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL)",
    )
    .run();

  await ensureColumn(d1, "contracts", "template_id", "template_id text REFERENCES contract_templates(id)");
  await ensureColumn(d1, "contracts", "contract_text", "contract_text text");
  await ensureColumn(
    d1,
    "contracts",
    "signature_status",
    "signature_status text DEFAULT 'not_generated'",
  );
  // Signed PDFs are stored in R2; this column only holds the R2 object key.
  await ensureColumn(d1, "contracts", "signed_document_key", "signed_document_key text");
  await ensureColumn(d1, "contracts", "signed_file_name", "signed_file_name text");
  await ensureColumn(d1, "contracts", "signed_uploaded_at", "signed_uploaded_at text");
  await ensureColumn(d1, "contracts", "reviewed_at", "reviewed_at text");
  await ensureColumn(d1, "contracts", "review_note", "review_note text");

  const count = await d1
    .prepare("SELECT COUNT(*) AS total FROM contract_templates")
    .first<{ total: number }>();

  if ((count?.total ?? 0) === 0) {
    const now = new Date().toISOString();
    await d1
      .prepare(
        "INSERT INTO contract_templates (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        "tpl-residencial-padrao",
        "Locacao residencial padrao",
        DEFAULT_TEMPLATE_CONTENT,
        now,
        now,
      )
      .run();
  }
}

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare("SELECT * FROM contract_templates ORDER BY name")
    .all<ContractTemplateRow>();
  return rows.results.map(mapTemplate);
}

export async function createContractTemplate(input: {
  name: string;
  content: string;
}): Promise<string> {
  const d1 = getD1();
  const id = createId("tpl");
  const now = new Date().toISOString();
  await d1
    .prepare(
      "INSERT INTO contract_templates (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, input.name, input.content, now, now)
    .run();
  return id;
}

export async function updateContractTemplate(input: {
  id: string;
  name: string;
  content: string;
}) {
  const d1 = getD1();
  await d1
    .prepare(
      "UPDATE contract_templates SET name = ?, content = ?, updated_at = ? WHERE id = ?",
    )
    .bind(input.name, input.content, new Date().toISOString(), input.id)
    .run();
}

export async function deleteContractTemplate(id: string) {
  const d1 = getD1();
  const linked = await d1
    .prepare("SELECT id FROM contracts WHERE template_id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (linked) {
    throw new Error(
      "Nao e possivel excluir um modelo em uso por algum contrato.",
    );
  }

  await d1.prepare("DELETE FROM contract_templates WHERE id = ?").bind(id).run();
}

function renderContractTemplate(content: string, vars: Record<string, string>): string {
  return content.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

function buildContractVariables(row: ContractJoinRow): Record<string, string> {
  return {
    inquilino_nome: row.tenant_name,
    inquilino_documento: row.tenant_document,
    inquilino_email: row.tenant_email,
    inquilino_whatsapp: row.tenant_whatsapp,
    imovel_nome: row.property_name,
    imovel_endereco: row.property_address,
    imovel_tipo: row.property_type,
    recebedor_nome: row.receiver_name,
    recebedor_documento: row.receiver_document,
    valor_aluguel: formatCurrency(row.monthly_rent),
    dia_vencimento: String(row.due_day),
    data_inicio: formatDate(row.starts_at),
    data_fim: formatDate(row.ends_at),
    multa_percentual: (row.fine_rate * 100).toFixed(0),
    juros_percentual: (row.monthly_interest_rate * 100).toFixed(0),
    carencia_dias: String(row.grace_days),
    data_geracao: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  };
}

async function loadContractJoin(d1: D1Binding, contractId: string) {
  return d1
    .prepare(
      `SELECT c.id as id, c.tenant_id as tenant_id, c.receiver_id as receiver_id,
              c.monthly_rent as monthly_rent, c.due_day as due_day, c.starts_at as starts_at,
              c.ends_at as ends_at, c.fine_rate as fine_rate,
              c.monthly_interest_rate as monthly_interest_rate, c.grace_days as grace_days,
              c.signature_status as signature_status,
              t.name as tenant_name, t.document as tenant_document, t.email as tenant_email,
              t.whatsapp as tenant_whatsapp,
              p.name as property_name, p.address as property_address, p.type as property_type,
              r.name as receiver_name, r.document as receiver_document, r.email as receiver_email
       FROM contracts c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN properties p ON p.id = c.property_id
       JOIN receivers r ON r.id = c.receiver_id
       WHERE c.id = ?`,
    )
    .bind(contractId)
    .first<ContractJoinRow & { receiver_email: string }>();
}

export async function generateContractDocument(input: {
  contractId: string;
  templateId: string;
}) {
  const d1 = getD1();
  const contractRow = await loadContractJoin(d1, input.contractId);
  if (!contractRow) {
    throw new Error("Contrato nao encontrado.");
  }

  const templateRow = await d1
    .prepare("SELECT * FROM contract_templates WHERE id = ?")
    .bind(input.templateId)
    .first<ContractTemplateRow>();

  if (!templateRow) {
    throw new Error("Modelo de contrato nao encontrado.");
  }

  const variables = buildContractVariables(contractRow);
  const contractText = renderContractTemplate(templateRow.content, variables);

  // Embeds the vistoria (property inspection) photos, if any were taken,
  // directly into the generated PDF: the tenant's signature then covers both
  // the contract terms and the photographic record of the property's state.
  const photos = await loadInspectionPhotosForPdf(input.contractId);
  const pdfBytes = await buildContractPdf({ contractText, photos });

  const previousKeyRow = await d1
    .prepare("SELECT generated_document_key FROM contracts WHERE id = ?")
    .bind(input.contractId)
    .first<{ generated_document_key: string | null }>();

  const generatedDocumentKey = `contracts/${input.contractId}/generated-${Date.now()}.pdf`;
  await getR2().put(generatedDocumentKey, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
  });

  await d1
    .prepare(
      `UPDATE contracts SET template_id = ?, contract_text = ?, signature_status = 'awaiting_signature',
        signed_document_key = NULL, signed_file_name = NULL, signed_uploaded_at = NULL,
        reviewed_at = NULL, review_note = NULL, generated_document_key = ?, generated_document_updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.templateId,
      contractText,
      generatedDocumentKey,
      new Date().toISOString(),
      input.contractId,
    )
    .run();

  if (previousKeyRow?.generated_document_key) {
    try {
      await getR2().delete(previousKeyRow.generated_document_key);
    } catch (error) {
      console.error("[contract-documents] falha ao remover PDF gerado antigo do R2:", error);
    }
  }
}

/** Streams the generated (unsigned) contract PDF — includes vistoria photos when present. */
export async function getGeneratedDocumentBinary(
  contractId: string,
): Promise<{ bytes: ArrayBuffer; fileName: string } | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT generated_document_key FROM contracts WHERE id = ?")
    .bind(contractId)
    .first<{ generated_document_key: string | null }>();

  if (!row?.generated_document_key) {
    return null;
  }

  const object = await getR2().get(row.generated_document_key);
  if (!object) {
    return null;
  }

  return {
    bytes: await object.arrayBuffer(),
    fileName: `contrato-${contractId}.pdf`,
  };
}

/**
 * Signed PDFs are stored in R2 (binding SIGNED_CONTRACTS), so the size limit
 * here only guards against abuse/oversized uploads, not a storage-engine
 * limit like D1's ~2MB per value.
 */
const MAX_SIGNED_FILE_BYTES = 15 * 1024 * 1024;

export async function uploadSignedContract(input: {
  contractId: string;
  tenantId: string;
  fileBase64: string;
  fileName: string;
}): Promise<{
  tenantName: string;
  tenantEmail: string;
  receiverName: string;
  receiverEmail: string;
  propertyName: string;
}> {
  const d1 = getD1();
  const row = await loadContractJoin(d1, input.contractId);

  if (!row || row.tenant_id !== input.tenantId) {
    throw new Error("Contrato nao encontrado para este inquilino.");
  }

  if (row.signature_status === "not_generated") {
    throw new Error(
      "O contrato ainda nao foi gerado a partir de um modelo. Aguarde o administrador.",
    );
  }

  if (row.signature_status === "approved") {
    throw new Error(
      "Este contrato ja foi aprovado. Fale com o administrador caso precise reenviar.",
    );
  }

  const approxBytes = Math.ceil((input.fileBase64.length * 3) / 4);
  if (approxBytes > MAX_SIGNED_FILE_BYTES) {
    throw new Error(
      `Arquivo muito grande (limite de ${(MAX_SIGNED_FILE_BYTES / (1024 * 1024)).toFixed(0)}MB). Envie um PDF mais leve.`,
    );
  }

  const previousKeyRow = await d1
    .prepare("SELECT signed_document_key FROM contracts WHERE id = ?")
    .bind(input.contractId)
    .first<{ signed_document_key: string | null }>();

  const objectKey = `contracts/${input.contractId}/${Date.now()}-${sanitizeFileName(input.fileName)}`;
  const bytes = base64ToBytes(input.fileBase64);

  await getR2().put(objectKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
  });

  await d1
    .prepare(
      `UPDATE contracts SET signed_document_key = ?, signed_file_name = ?, signed_uploaded_at = ?,
        signature_status = 'in_review', reviewed_at = NULL, review_note = NULL
       WHERE id = ?`,
    )
    .bind(objectKey, input.fileName, new Date().toISOString(), input.contractId)
    .run();

  if (previousKeyRow?.signed_document_key) {
    try {
      await getR2().delete(previousKeyRow.signed_document_key);
    } catch (error) {
      console.error("[contract-documents] falha ao remover objeto R2 antigo:", error);
    }
  }

  return {
    tenantName: row.tenant_name,
    tenantEmail: row.tenant_email,
    receiverName: row.receiver_name,
    receiverEmail: row.receiver_email,
    propertyName: row.property_name,
  };
}

export async function reviewSignedContract(input: {
  contractId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<{
  tenantName: string;
  tenantEmail: string;
  receiverName: string;
  receiverEmail: string;
  propertyName: string;
  decision: "approved" | "rejected";
  note?: string;
}> {
  const d1 = getD1();
  const row = await loadContractJoin(d1, input.contractId);

  if (!row) {
    throw new Error("Contrato nao encontrado.");
  }

  if (row.signature_status !== "in_review") {
    throw new Error("Este contrato nao esta aguardando aprovacao no momento.");
  }

  await d1
    .prepare(
      "UPDATE contracts SET signature_status = ?, reviewed_at = ?, review_note = ? WHERE id = ?",
    )
    .bind(input.decision, new Date().toISOString(), input.note ?? null, input.contractId)
    .run();

  return {
    tenantName: row.tenant_name,
    tenantEmail: row.tenant_email,
    receiverName: row.receiver_name,
    receiverEmail: row.receiver_email,
    propertyName: row.property_name,
    decision: input.decision,
    note: input.note,
  };
}

export async function getSignedDocumentBlob(
  contractId: string,
): Promise<{ fileName: string; dataBase64: string } | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT signed_document_key, signed_file_name FROM contracts WHERE id = ?",
    )
    .bind(contractId)
    .first<{ signed_document_key: string | null; signed_file_name: string | null }>();

  if (!row?.signed_document_key) {
    return null;
  }

  const object = await getR2().get(row.signed_document_key);
  if (!object) {
    return null;
  }

  const arrayBuffer = await object.arrayBuffer();

  return {
    fileName: row.signed_file_name ?? "contrato-assinado.pdf",
    dataBase64: bytesToBase64(new Uint8Array(arrayBuffer)),
  };
}

export async function getContractTenantId(contractId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT tenant_id FROM contracts WHERE id = ?")
    .bind(contractId)
    .first<{ tenant_id: string }>();
  return row?.tenant_id ?? null;
}

export async function listPendingApprovalContracts(): Promise<
  Array<{
    id: string;
    tenantName: string;
    propertyName: string;
    signedFileName: string | null;
    signedUploadedAt: string | null;
  }>
> {
  const d1 = getD1();
  const rows = await d1
    .prepare(
      `SELECT c.id as id, t.name as tenant_name, p.name as property_name,
              c.signed_file_name as signed_file_name, c.signed_uploaded_at as signed_uploaded_at
       FROM contracts c
       JOIN tenants t ON t.id = c.tenant_id
       JOIN properties p ON p.id = c.property_id
       WHERE c.signature_status = 'in_review'
       ORDER BY c.signed_uploaded_at ASC`,
    )
    .all<{
      id: string;
      tenant_name: string;
      property_name: string;
      signed_file_name: string | null;
      signed_uploaded_at: string | null;
    }>();

  return rows.results.map(
    (row: {
      id: string;
      tenant_name: string;
      property_name: string;
      signed_file_name: string | null;
      signed_uploaded_at: string | null;
    }) => ({
      id: row.id,
      tenantName: row.tenant_name,
      propertyName: row.property_name,
      signedFileName: row.signed_file_name,
      signedUploadedAt: row.signed_uploaded_at,
    }),
  );
}

export async function listAdminEmails(): Promise<string[]> {
  const d1 = getD1();
  const rows = await d1
    .prepare("SELECT email FROM users WHERE role = 'admin'")
    .all<{ email: string }>();
  return rows.results.map((row: { email: string }) => row.email);
}

function mapTemplate(row: ContractTemplateRow): ContractTemplate {
  return {
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
