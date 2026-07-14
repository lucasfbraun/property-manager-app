"use client";

import { useState } from "react";
import type { AdminUser } from "../lib/auth-repository";
import { Field, FormPanel, EditForm } from "./ui";
import { ManagementPanel } from "./ManagementPanel";
import { getErrorMessage } from "./support";

/**
 * Gestao de contas de administrador (tabela users, role='admin'). Secao
 * autocontida: mantem o proprio estado/mensagens em vez de participar do
 * DraftState do CadastroWorkspace, ja que admins nao fazem parte de
 * /api/rentals. Regras aplicadas pela API: e-mail unico, senha minima de 8
 * caracteres, nao excluir a propria conta nem o ultimo admin.
 */
export function AdminsSection({
  currentUserId,
  initialAdmins,
}: {
  currentUserId: string;
  initialAdmins: AdminUser[];
}) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
  const [message, setMessage] = useState(
    "Contas com acesso total ao painel administrativo.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admins");
    if (!response.ok) {
      throw new Error("Nao foi possivel recarregar os administradores.");
    }
    const data = (await response.json()) as { admins: AdminUser[] };
    setAdmins(data.admins);
  }

  async function send(
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, unknown>,
  ) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admins", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao salvar.");
      }
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function addAdmin(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    if (!name || !email || !password) {
      setMessage("Preencha nome, e-mail e senha do novo administrador.");
      return;
    }

    try {
      await send("POST", { email, name, password });
      setMessage(`Administrador ${name} criado com acesso ao painel.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveAdmin(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    try {
      await send("PATCH", {
        email,
        id,
        name,
        password: password || undefined,
      });
      setMessage(
        password
          ? `Administrador ${name} atualizado (senha trocada).`
          : `Administrador ${name} atualizado.`,
      );
      setEditingId(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function deleteAdmin(admin: AdminUser) {
    const confirmed = window.confirm(
      `Excluir o administrador ${admin.name}? As sessoes ativas dele serao encerradas.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await send("DELETE", { id: admin.id });
      setMessage(`Administrador ${admin.name} excluido.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Administradores</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {isSaving ? "Salvando..." : message}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <FormPanel
          action={addAdmin}
          description="Nova conta com acesso total ao painel (cadastros, contratos, cobrancas e integracoes)."
          title="Novo administrador"
        >
          <Field label="Nome completo" name="name" />
          <Field label="E-mail de acesso" name="email" type="email" />
          <Field label="Senha (minimo 8 caracteres)" name="password" type="password" />
        </FormPanel>

        <ManagementPanel
          editingId={editingId}
          emptyText="Nenhum administrador cadastrado."
          isSaving={isSaving}
          items={admins}
          onDelete={deleteAdmin}
          onEdit={(admin) => setEditingId(admin.id)}
          renderEditForm={(admin) => (
            <EditForm
              key={admin.id}
              action={(formData) => saveAdmin(admin.id, formData)}
              onCancel={() => setEditingId(null)}
            >
              <Field defaultValue={admin.name} label="Nome completo" name="name" />
              <Field
                defaultValue={admin.email}
                label="E-mail de acesso"
                name="email"
                type="email"
              />
              <Field
                label="Nova senha (opcional, minimo 8 caracteres)"
                name="password"
                required={false}
                type="password"
              />
            </EditForm>
          )}
          renderSubtitle={(admin) =>
            `${admin.email}${admin.id === currentUserId ? " - voce" : ""}`
          }
          renderTitle={(admin) => admin.name}
          title="Contas de administrador"
        />
      </div>
    </section>
  );
}
