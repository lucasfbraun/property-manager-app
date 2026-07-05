"use client";

import { useMemo, useState } from "react";
import type {
  Contract,
  Property,
  Receiver,
  Tenant,
} from "../lib/rentals";
import { formatCurrency } from "../lib/rentals";

type DraftState = {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
};

export function CadastroWorkspace({
  initialContracts,
  initialProperties,
  initialReceivers,
  initialTenants,
}: {
  initialContracts: Contract[];
  initialProperties: Property[];
  initialReceivers: Receiver[];
  initialTenants: Tenant[];
}) {
  const [state, setState] = useState<DraftState>({
    contracts: initialContracts,
    properties: initialProperties,
    receivers: initialReceivers,
    tenants: initialTenants,
  });
  const [message, setMessage] = useState("Pronto para cadastrar.");
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(
    () => ({
      tenants: state.tenants.length,
      properties: state.properties.length,
      receivers: state.receivers.length,
      contracts: state.contracts.length,
      monthlyRent: state.contracts.reduce(
        (sum, contract) => sum + contract.monthlyRent,
        0,
      ),
    }),
    [state],
  );

  async function refreshData() {
    const response = await fetch("/api/rentals");
    if (!response.ok) {
      throw new Error("Nao foi possivel recarregar os dados.");
    }
    setState((await response.json()) as DraftState);
  }

  async function postAndRefresh(endpoint: string, payload: Record<string, unknown>) {
    setIsSaving(true);
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao salvar.");
      }
      await refreshData();
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAndRefresh(endpoint: string, id: string, label: string) {
    const confirmed = window.confirm(`Excluir ${label}?`);
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao excluir.");
      }
      await refreshData();
      setMessage(`${label} excluido com sucesso.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function addTenant(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const whatsapp = String(formData.get("whatsapp") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    if (!name || !document || !email || !whatsapp) {
      setMessage("Preencha todos os campos obrigatorios do inquilino.");
      return;
    }

    try {
      await postAndRefresh("/api/tenants", {
        document,
        email,
        name,
        password: password || undefined,
        whatsapp,
      });
      setMessage(
        password
          ? `Inquilino ${name} salvo com acesso ao portal.`
          : `Inquilino ${name} salvo no banco (sem login no portal).`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function addProperty(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim();
    if (!name || !address || !type) {
      setMessage("Preencha todos os campos obrigatorios do imovel.");
      return;
    }

    try {
      await postAndRefresh("/api/properties", { address, name, type });
      setMessage(`Imovel ${name} salvo no banco.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function addReceiver(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const mpAccount = String(formData.get("mpAccount") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    if (!name || !document || !email) {
      setMessage("Preencha todos os campos obrigatorios do recebedor.");
      return;
    }

    try {
      await postAndRefresh("/api/receivers", {
        document,
        email,
        mpAccount,
        name,
        password: password || undefined,
      });
      setMessage(
        password
          ? `Recebedor ${name} salvo com acesso ao portal.`
          : `Recebedor ${name} salvo no banco (sem login no portal).`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function addContract(formData: FormData) {
    const tenantId = String(formData.get("tenantId") ?? "");
    const propertyId = String(formData.get("propertyId") ?? "");
    const receiverId = String(formData.get("receiverId") ?? "");
    const monthlyRent = Number(formData.get("monthlyRent") ?? 0);
    const dueDay = Number(formData.get("dueDay") ?? 0);
    const endsAt = String(formData.get("endsAt") ?? "");
    if (!tenantId || !propertyId || !receiverId || monthlyRent <= 0 || !dueDay) {
      setMessage("Preencha os dados obrigatorios do contrato.");
      return;
    }

    try {
      await postAndRefresh("/api/contracts", {
        dueDay,
        endsAt,
        monthlyRent,
        propertyId,
        receiverId,
        tenantId,
      });
      setMessage("Contrato salvo no banco com recebedor preservado.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Inquilinos" value={String(totals.tenants)} />
        <Metric label="Imoveis" value={String(totals.properties)} />
        <Metric label="Recebedores" value={String(totals.receivers)} />
        <Metric label="Contratos" value={String(totals.contracts)} />
        <Metric label="Aluguel mensal" value={formatCurrency(totals.monthlyRent)} />
      </section>

      <div className="rounded-lg border border-blue-200 bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1D4ED8] shadow-sm">
        {isSaving ? "Salvando..." : message}
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <FormPanel
          action={addTenant}
          description="Dados essenciais para o portal e cobranças."
          title="Novo inquilino"
        >
          <Field label="Nome completo" name="name" />
          <Field label="CPF/CNPJ" name="document" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="WhatsApp" name="whatsapp" />
          <Field
            label="Senha de acesso ao portal (opcional)"
            name="password"
            required={false}
            type="password"
          />
        </FormPanel>

        <FormPanel
          action={addProperty}
          description="Identifique o imovel antes de gerar contrato."
          title="Novo imovel"
        >
          <Field label="Nome interno" name="name" />
          <Field label="Endereco" name="address" />
          <Select
            label="Tipo"
            name="type"
            options={["Apartamento", "Casa", "Comercial", "Terreno"]}
          />
        </FormPanel>

        <FormPanel
          action={addReceiver}
          description="Pessoa ou conta que recebera os valores."
          title="Novo recebedor"
        >
          <Field label="Nome" name="name" />
          <Field label="CPF/CNPJ" name="document" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="Conta Mercado Pago" name="mpAccount" required={false} />
          <Field
            label="Senha de acesso ao portal (opcional)"
            name="password"
            required={false}
            type="password"
          />
        </FormPanel>

        <FormPanel
          action={addContract}
          description="O recebedor fica registrado no contrato."
          title="Novo contrato"
        >
          <Select
            label="Inquilino"
            name="tenantId"
            options={state.tenants.map((tenant) => ({
              label: tenant.name,
              value: tenant.id,
            }))}
          />
          <Select
            label="Imovel"
            name="propertyId"
            options={state.properties.map((property) => ({
              label: property.name,
              value: property.id,
            }))}
          />
          <Select
            label="Recebedor"
            name="receiverId"
            options={state.receivers.map((receiver) => ({
              label: receiver.name,
              value: receiver.id,
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Valor" name="monthlyRent" type="number" />
            <Field label="Dia venc." name="dueDay" type="number" />
            <Field label="Fim" name="endsAt" type="date" />
          </div>
        </FormPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ManagementPanel
          emptyText="Nenhum inquilino cadastrado."
          isSaving={isSaving}
          items={state.tenants}
          onDelete={(tenant) =>
            deleteAndRefresh("/api/tenants", tenant.id, tenant.name)
          }
          renderSubtitle={(tenant) => `${tenant.email} - ${tenant.whatsapp}`}
          renderTitle={(tenant) => tenant.name}
          title="Inquilinos"
        />

        <ManagementPanel
          emptyText="Nenhum imovel cadastrado."
          isSaving={isSaving}
          items={state.properties}
          onDelete={(property) =>
            deleteAndRefresh("/api/properties", property.id, property.name)
          }
          renderSubtitle={(property) => `${property.address} - ${property.status}`}
          renderTitle={(property) => property.name}
          title="Imoveis"
        />

        <ManagementPanel
          emptyText="Nenhum recebedor cadastrado."
          isSaving={isSaving}
          items={state.receivers}
          onDelete={(receiver) =>
            deleteAndRefresh("/api/receivers", receiver.id, receiver.name)
          }
          renderSubtitle={(receiver) => `${receiver.email} - ${receiver.mpAccount}`}
          renderTitle={(receiver) => receiver.name}
          title="Recebedores"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Contratos cadastrados</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Inquilino</th>
                <th className="px-3 py-3">Imovel</th>
                <th className="px-3 py-3">Recebedor</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3">Vencimento</th>
                <th className="px-3 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.contracts.map((contract) => {
                const tenant = state.tenants.find(
                  (item) => item.id === contract.tenantId,
                );
                const property = state.properties.find(
                  (item) => item.id === contract.propertyId,
                );
                const receiver = state.receivers.find(
                  (item) => item.id === contract.receiverId,
                );
                return (
                  <tr className="hover:bg-slate-50" key={contract.id}>
                    <td className="px-3 py-3 font-medium">{tenant?.name}</td>
                    <td className="px-3 py-3 text-neutral-600">
                      {property?.name}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">
                      {receiver?.name}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {formatCurrency(contract.monthlyRent)}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">
                      Dia {contract.dueDay}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() =>
                          deleteAndRefresh(
                            "/api/contracts",
                            contract.id,
                            `contrato de ${tenant?.name ?? "inquilino"}`,
                          )
                        }
                        type="button"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ManagementPanel<T extends { id: string }>({
  emptyText,
  isSaving,
  items,
  onDelete,
  renderSubtitle,
  renderTitle,
  title,
}: {
  emptyText: string;
  isSaving: boolean;
  items: T[];
  onDelete: (item: T) => void;
  renderSubtitle: (item: T) => string;
  renderTitle: (item: T) => string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="flex min-h-20 items-center justify-between gap-3 rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-3"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {renderTitle(item)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {renderSubtitle(item)}
                </p>
              </div>
              <button
                className="shrink-0 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                onClick={() => onDelete(item)}
                type="button"
              >
                Excluir
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

function FormPanel({
  action,
  children,
  description,
  title,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
      <button
        className="mt-4 rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
        type="submit"
      >
        Adicionar
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  required = true,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
        name={name}
        required
      >
        <option value="">Selecione</option>
        {options.map((option) => {
          const normalized =
            typeof option === "string" ? { label: option, value: option } : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}
