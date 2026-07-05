"use client";

import { useState } from "react";
import { signatureStatusLabel, type SignatureStatus } from "../lib/rentals";

type TemplateItem = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type ContractRow = {
  id: string;
  tenantName: string;
  propertyName: string;
  templateId: string | null;
  signatureStatus: SignatureStatus;
  signedFileName: string | null;
  signedUploadedAt: string | null;
  reviewNote: string | null;
};

type VariableRef = { key: string; label: string };

const statusTone: Record<string, string> = {
  not_generated: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
  awaiting_signature: "bg-[#DBEAFE] text-[#1D4ED8] ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
};

export function ContractsWorkspace({
  initialContracts,
  initialTemplates,
  variables,
}: {
  initialContracts: ContractRow[];
  initialTemplates: TemplateItem[];
  variables: VariableRef[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [contracts, setContracts] = useState(initialContracts);
  const [message, setMessage] = useState("Pronto.");
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplateByContract, setSelectedTemplateByContract] = useState<
    Record<string, string>
  >({});

  async function refreshAll() {
    const [templatesRes, rentalsRes] = await Promise.all([
      fetch("/api/contract-templates"),
      fetch("/api/rentals"),
    ]);

    if (templatesRes.ok) {
      const data = (await templatesRes.json()) as { templates: TemplateItem[] };
      setTemplates(data.templates);
    }

    if (rentalsRes.ok) {
      const data = (await rentalsRes.json()) as {
        tenants: Array<{ id: string; name: string }>;
        properties: Array<{ id: string; name: string }>;
        contracts: Array<{
          id: string;
          tenantId: string;
          propertyId: string;
          templateId: string | null;
          signatureStatus: SignatureStatus;
          signedFileName: string | null;
          signedUploadedAt: string | null;
          reviewNote: string | null;
        }>;
      };
      setContracts(
        data.contracts.map((contract) => ({
          id: contract.id,
          propertyName:
            data.properties.find((item) => item.id === contract.propertyId)?.name ?? "-",
          reviewNote: contract.reviewNote,
          signatureStatus: contract.signatureStatus,
          signedFileName: contract.signedFileName,
          signedUploadedAt: contract.signedUploadedAt,
          templateId: contract.templateId,
          tenantName:
            data.tenants.find((item) => item.id === contract.tenantId)?.name ?? "-",
        })),
      );
    }
  }

  async function sendJson(
    method: "POST" | "PATCH" | "DELETE",
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    setIsSaving(true);
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao salvar.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function createTemplate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!name || !content) {
      setMessage("Preencha nome e conteudo do modelo.");
      return;
    }
    try {
      await sendJson("POST", "/api/contract-templates", { content, name });
      setMessage(`Modelo "${name}" criado.`);
      await refreshAll();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveTemplate(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!name || !content) {
      setMessage("Preencha nome e conteudo do modelo.");
      return;
    }
    try {
      await sendJson("PATCH", "/api/contract-templates", { content, id, name });
      setMessage(`Modelo "${name}" atualizado.`);
      setEditingTemplateId(null);
      await refreshAll();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function deleteTemplate(template: TemplateItem) {
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) {
      return;
    }
    try {
      await sendJson("DELETE", "/api/contract-templates", { id: template.id });
      setMessage(`Modelo "${template.name}" excluido.`);
      await refreshAll();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function generateDocument(contractId: string) {
    const templateId = selectedTemplateByContract[contractId];
    if (!templateId) {
      setMessage("Selecione um modelo antes de gerar o contrato.");
      return;
    }
    try {
      await sendJson("POST", "/api/contracts/generate-document", {
        contractId,
        templateId,
      });
      setMessage("Documento do contrato gerado/atualizado.");
      await refreshAll();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function reviewContract(contractId: string, decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "rejected") {
      note = window.prompt("Motivo da rejeicao (opcional):") ?? undefined;
    }
    try {
      await sendJson("POST", "/api/contracts/review", { contractId, decision, note });
      setMessage(decision === "approved" ? "Contrato aprovado." : "Contrato rejeitado.");
      await refreshAll();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function viewSignedDocument(contractId: string) {
    try {
      const response = await fetch(
        `/api/contracts/signed-document?contractId=${encodeURIComponent(contractId)}`,
      );
      const result = (await response.json()) as {
        fileName?: string;
        dataBase64?: string;
        error?: string;
      };
      if (!response.ok || !result.dataBase64) {
        throw new Error(result.error ?? "Documento nao encontrado.");
      }
      const byteChars = atob(result.dataBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  const pendingApproval = contracts.filter((item) => item.signatureStatus === "in_review");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1D4ED8] shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:shadow-none">
        {isSaving ? "Salvando..." : message}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="surface-card p-4">
          <h2 className="font-semibold">Modelos de contrato</h2>
          <div className="mt-3 space-y-3">
            {templates.map((template) => (
              <div
                className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5"
                key={template.id}
              >
                {editingTemplateId === template.id ? (
                  <form
                    action={(formData) => saveTemplate(template.id, formData)}
                    className="space-y-2"
                  >
                    <input
                      className="input-field"
                      defaultValue={template.name}
                      name="name"
                      required
                    />
                    <textarea
                      className="input-field min-h-48 font-mono text-xs"
                      defaultValue={template.content}
                      name="content"
                      required
                    />
                    <div className="flex gap-2">
                      <button className="btn-primary" type="submit">
                        Salvar
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setEditingTemplateId(null)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{template.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Atualizado em {new Date(template.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        onClick={() => setEditingTemplateId(template.id)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        onClick={() => deleteTemplate(template)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form action={createTemplate} className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <h3 className="text-sm font-semibold">Novo modelo</h3>
            <input className="input-field" name="name" placeholder="Nome do modelo" required />
            <textarea
              className="input-field min-h-48 font-mono text-xs"
              name="content"
              placeholder="Texto do contrato com variaveis, ex: {{inquilino_nome}}"
              required
            />
            <button className="btn-primary" type="submit">
              Adicionar modelo
            </button>
          </form>
        </div>

        <div className="surface-card p-4">
          <h2 className="font-semibold">Variaveis disponiveis</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Use estas variaveis no texto do modelo, entre chaves duplas.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {variables.map((variable) => (
              <li
                className="rounded-md bg-[#0F172A] px-3 py-2 font-mono text-white dark:bg-black/40 dark:text-blue-200"
                key={variable.key}
              >
                {`{{${variable.key}}}`}
                <span className="ml-2 font-sans text-slate-300 dark:text-slate-400">
                  {variable.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="surface-card p-4">
        <h2 className="mb-3 font-semibold">Gerar contrato por inquilino</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3">Inquilino</th>
                <th className="px-3 py-3">Imovel</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Modelo</th>
                <th className="px-3 py-3 text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="px-3 py-3 font-medium">{contract.tenantName}</td>
                  <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                    {contract.propertyName}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[contract.signatureStatus]}`}
                    >
                      {signatureStatusLabel(contract.signatureStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="input-field"
                      defaultValue={contract.templateId ?? ""}
                      onChange={(event) =>
                        setSelectedTemplateByContract((prev) => ({
                          ...prev,
                          [contract.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione um modelo</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      className="btn-secondary"
                      disabled={isSaving}
                      onClick={() => generateDocument(contract.id)}
                      type="button"
                    >
                      {contract.templateId ? "Atualizar contrato" : "Gerar contrato"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card p-4">
        <h2 className="mb-3 font-semibold">Aprovacao de contratos assinados</h2>
        {pendingApproval.length > 0 ? (
          <div className="space-y-3">
            {pendingApproval.map((contract) => (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
                key={contract.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{contract.tenantName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {contract.propertyName}
                      {contract.signedFileName ? ` - ${contract.signedFileName}` : ""}
                    </p>
                    {contract.signedUploadedAt ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Enviado em{" "}
                        {new Date(contract.signedUploadedAt).toLocaleString("pt-BR")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      onClick={() => viewSignedDocument(contract.id)}
                      type="button"
                    >
                      Ver documento
                    </button>
                    <button
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() => reviewContract(contract.id, "approved")}
                      type="button"
                    >
                      Aprovar
                    </button>
                    <button
                      className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() => reviewContract(contract.id, "rejected")}
                      type="button"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum contrato aguardando aprovacao no momento.
          </p>
        )}
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
