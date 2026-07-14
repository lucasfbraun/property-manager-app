"use client";

import { useMemo, useState } from "react";
import type {
  Charge,
  Contract,
  ContractWitness,
  Owner,
  Property,
  Receiver,
  Tenant,
} from "../lib/rentals";
import { formatCurrency } from "../lib/rentals";
import { Field, FormPanel, EditForm, Metric, Select } from "./ui";
import { ManagementPanel } from "./ManagementPanel";
import { PropertyCheckboxList, WitnessCheckboxList } from "./checkbox-lists";
import { ContractsSection } from "./ContractsSection";
import { getErrorMessage, reminderEventLabel } from "./support";

type DraftState = {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
  charges: Charge[];
  owners: Owner[];
  contractWitnesses: ContractWitness[];
};

type EditingTarget =
  | { type: "tenant"; id: string }
  | { type: "property"; id: string }
  | { type: "receiver"; id: string }
  | { type: "owner"; id: string }
  | { type: "contract"; id: string }
  | null;

export function CadastroWorkspace({
  initialCharges,
  initialContracts,
  initialContractWitnesses,
  initialOwners,
  initialProperties,
  initialReceivers,
  initialTenants,
}: {
  initialCharges: Charge[];
  initialContracts: Contract[];
  initialContractWitnesses: ContractWitness[];
  initialOwners: Owner[];
  initialProperties: Property[];
  initialReceivers: Receiver[];
  initialTenants: Tenant[];
}) {
  const [state, setState] = useState<DraftState>({
    charges: initialCharges,
    contracts: initialContracts,
    contractWitnesses: initialContractWitnesses,
    owners: initialOwners,
    properties: initialProperties,
    receivers: initialReceivers,
    tenants: initialTenants,
  });
  const [message, setMessage] = useState("Pronto para cadastrar.");
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<EditingTarget>(null);

  const totals = useMemo(
    () => ({
      tenants: state.tenants.length,
      properties: state.properties.length,
      receivers: state.receivers.length,
      owners: state.owners.length,
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

  async function sendAndRefresh(
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

    try {
      await sendAndRefresh("DELETE", endpoint, { id });
      setMessage(`${label} excluido com sucesso.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function generateCharge(contractId: string) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/charges/generate", {
        body: JSON.stringify({ contractId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        created?: boolean;
        updated?: boolean;
        reference?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao gerar cobranca.");
      }
      setMessage(
        result.created
          ? `Cobranca de ${result.reference} gerada.`
          : result.updated
            ? `Cobranca de ${result.reference} ja existia e foi atualizada com o valor atual do contrato.`
            : `Cobranca de ${result.reference} ja existia e esta paga, entao nao foi alterada.`,
      );
      await refreshData();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function syncPayment(contractId: string) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/charges/sync-payment", {
        body: JSON.stringify({ contractId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        status?: string;
        updated?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao verificar pagamento.");
      }
      if (result.status === "already_paid") {
        setMessage("Essa cobranca ja estava marcada como paga.");
      } else if (result.updated) {
        setMessage("Pagamento confirmado na Mercado Pago! Cobranca marcada como paga.");
      } else {
        setMessage(`Pagamento ainda nao aprovado na Mercado Pago (status: ${result.status}).`);
      }
      await refreshData();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function sendReminder(contractId: string) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/charges/send-reminder", {
        body: JSON.stringify({ contractId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        event?: string;
        tenantName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao enviar lembrete por WhatsApp.");
      }
      setMessage(
        `Lembrete (${reminderEventLabel(result.event)}) enviado para ${result.tenantName} no WhatsApp.`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Owner/witnesses have no portal login, so "signing" is the admin
   * acknowledging (checkbox) that the printed contract was physically
   * signed by that person. Once every witness and the owner (when the
   * property has one) are checked, the tenant portal unlocks that
   * contract's signature step — the tenant always signs last.
   */
  async function toggleOwnerSigned(contractId: string, signed: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/signatures", {
        body: JSON.stringify({ contractId, signed, target: "owner" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao atualizar assinatura do proprietario.");
      }
      await refreshData();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleWitnessSigned(contractWitnessId: string, signed: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/signatures", {
        body: JSON.stringify({ contractWitnessId, signed, target: "witness" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao atualizar assinatura da testemunha.");
      }
      await refreshData();
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
    const residentCountRaw = String(formData.get("residentCount") ?? "").trim();
    if (!name || !document || !email || !whatsapp) {
      setMessage("Preencha todos os campos obrigatorios do inquilino.");
      return;
    }

    try {
      await sendAndRefresh("POST", "/api/tenants", {
        document,
        email,
        name,
        password: password || undefined,
        residentCount: residentCountRaw ? Number(residentCountRaw) : undefined,
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

  async function saveTenant(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const whatsapp = String(formData.get("whatsapp") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const residentCountRaw = String(formData.get("residentCount") ?? "").trim();

    try {
      await sendAndRefresh("PATCH", "/api/tenants", {
        document,
        email,
        id,
        name,
        password: password || undefined,
        residentCount: residentCountRaw ? Number(residentCountRaw) : undefined,
        status,
        whatsapp,
      });
      setMessage(`Inquilino ${name} atualizado.`);
      setEditing(null);
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
      await sendAndRefresh("POST", "/api/properties", { address, name, type });
      setMessage(`Imovel ${name} salvo no banco.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveProperty(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();

    try {
      await sendAndRefresh("PATCH", "/api/properties", {
        address,
        id,
        name,
        status,
        type,
      });
      setMessage(`Imovel ${name} atualizado.`);
      setEditing(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function addOwner(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const propertyIds = formData.getAll("propertyIds").map(String);
    if (!name || !document || !email || !phone) {
      setMessage("Preencha todos os campos obrigatorios do proprietario.");
      return;
    }
    if (propertyIds.length === 0) {
      setMessage("Selecione ao menos 1 imovel para o proprietario.");
      return;
    }

    try {
      await sendAndRefresh("POST", "/api/owners", {
        document,
        email,
        name,
        phone,
        propertyIds,
      });
      setMessage(`Proprietario ${name} salvo no banco.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveOwner(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const propertyIds = formData.getAll("propertyIds").map(String);
    if (propertyIds.length === 0) {
      setMessage("Selecione ao menos 1 imovel para o proprietario.");
      return;
    }

    try {
      await sendAndRefresh("PATCH", "/api/owners", {
        document,
        email,
        id,
        name,
        phone,
        propertyIds,
      });
      setMessage(`Proprietario ${name} atualizado.`);
      setEditing(null);
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
      await sendAndRefresh("POST", "/api/receivers", {
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

  async function saveReceiver(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const document = String(formData.get("document") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const mpAccount = String(formData.get("mpAccount") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    try {
      await sendAndRefresh("PATCH", "/api/receivers", {
        document,
        email,
        id,
        mpAccount,
        name,
        password: password || undefined,
      });
      setMessage(`Recebedor ${name} atualizado.`);
      setEditing(null);
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
    const witnessIds = formData.getAll("witnessIds").map(String);
    if (!tenantId || !propertyId || !receiverId || monthlyRent <= 0 || !dueDay) {
      setMessage("Preencha os dados obrigatorios do contrato.");
      return;
    }

    try {
      await sendAndRefresh("POST", "/api/contracts", {
        dueDay,
        endsAt,
        monthlyRent,
        propertyId,
        receiverId,
        tenantId,
        witnessIds,
      });
      setMessage("Contrato salvo no banco com recebedor preservado.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveContract(id: string, formData: FormData) {
    const monthlyRent = Number(formData.get("monthlyRent") ?? 0);
    const dueDay = Number(formData.get("dueDay") ?? 0);
    const endsAt = String(formData.get("endsAt") ?? "");
    const status = String(formData.get("status") ?? "");
    const fineRate = Number(formData.get("fineRate") ?? 0) / 100;
    const monthlyInterestRate = Number(formData.get("monthlyInterestRate") ?? 0) / 100;
    const graceDays = Number(formData.get("graceDays") ?? 0);
    const witnessIds = formData.getAll("witnessIds").map(String);

    try {
      await sendAndRefresh("PATCH", "/api/contracts", {
        dueDay,
        endsAt,
        fineRate,
        graceDays,
        id,
        monthlyInterestRate,
        monthlyRent,
        status,
        witnessIds,
      });
      setMessage("Contrato atualizado.");
      setEditing(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Inquilinos" value={String(totals.tenants)} />
        <Metric label="Imoveis" value={String(totals.properties)} />
        <Metric label="Recebedores" value={String(totals.receivers)} />
        <Metric label="Proprietarios" value={String(totals.owners)} />
        <Metric label="Contratos" value={String(totals.contracts)} />
        <Metric label="Aluguel mensal" value={formatCurrency(totals.monthlyRent)} />
      </section>

      <div className="rounded-lg border border-blue-200 bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1D4ED8] shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:shadow-none">
        {isSaving ? "Salvando..." : message}
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <FormPanel
          action={addTenant}
          description="Dados essenciais para o portal e cobrancas."
          title="Novo inquilino"
        >
          <Field label="Nome completo" name="name" />
          <Field label="CPF/CNPJ" name="document" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="WhatsApp" name="whatsapp" />
          <Field
            label="Quantidade de moradores"
            name="residentCount"
            required={false}
            type="number"
          />
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
          action={addOwner}
          description="Cadastro apenas administrativo (sem login/portal). Vincule ao menos 1 imovel."
          title="Novo proprietario"
        >
          <Field label="Nome completo" name="name" />
          <Field label="CPF/CNPJ" name="document" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefone" name="phone" />
          <PropertyCheckboxList owners={state.owners} properties={state.properties} />
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
          <WitnessCheckboxList receivers={state.receivers} />
        </FormPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <ManagementPanel
          editingId={editing?.type === "tenant" ? editing.id : null}
          emptyText="Nenhum inquilino cadastrado."
          isSaving={isSaving}
          items={state.tenants}
          onDelete={(tenant) =>
            deleteAndRefresh("/api/tenants", tenant.id, tenant.name)
          }
          onEdit={(tenant) => setEditing({ id: tenant.id, type: "tenant" })}
          renderEditForm={(tenant) => (
            <EditForm
              key={tenant.id}
              action={(formData) => saveTenant(tenant.id, formData)}
              onCancel={() => setEditing(null)}
            >
              <Field defaultValue={tenant.name} label="Nome completo" name="name" />
              <Field defaultValue={tenant.document} label="CPF/CNPJ" name="document" />
              <Field
                defaultValue={tenant.email}
                label="E-mail"
                name="email"
                type="email"
              />
              <Field defaultValue={tenant.whatsapp} label="WhatsApp" name="whatsapp" />
              <Field
                defaultValue={
                  tenant.residentCount != null ? String(tenant.residentCount) : undefined
                }
                label="Quantidade de moradores"
                name="residentCount"
                required={false}
                type="number"
              />
              <Select
                defaultValue={tenant.status}
                label="Status"
                name="status"
                options={["Ativo", "Inadimplente", "Inativo"]}
              />
              <Field
                label="Nova senha (opcional)"
                name="password"
                required={false}
                type="password"
              />
            </EditForm>
          )}
          renderSubtitle={(tenant) =>
            `${tenant.email} - ${tenant.whatsapp}${
              tenant.residentCount != null ? ` - ${tenant.residentCount} morador(es)` : ""
            }`
          }
          renderTitle={(tenant) => tenant.name}
          title="Inquilinos"
        />

        <ManagementPanel
          editingId={editing?.type === "property" ? editing.id : null}
          emptyText="Nenhum imovel cadastrado."
          isSaving={isSaving}
          items={state.properties}
          onDelete={(property) =>
            deleteAndRefresh("/api/properties", property.id, property.name)
          }
          onEdit={(property) => setEditing({ id: property.id, type: "property" })}
          renderEditForm={(property) => (
            <EditForm
              key={property.id}
              action={(formData) => saveProperty(property.id, formData)}
              onCancel={() => setEditing(null)}
            >
              <Field defaultValue={property.name} label="Nome interno" name="name" />
              <Field defaultValue={property.address} label="Endereco" name="address" />
              <Select
                defaultValue={property.type}
                label="Tipo"
                name="type"
                options={["Apartamento", "Casa", "Comercial", "Terreno"]}
              />
              <Select
                defaultValue={property.status}
                label="Status"
                name="status"
                options={["Disponivel", "Alugado", "Manutencao"]}
              />
            </EditForm>
          )}
          renderSubtitle={(property) => {
            const owner = state.owners.find((item) => item.id === property.ownerId);
            return `${property.address} - ${property.status} - ${
              owner ? `Proprietario: ${owner.name}` : "Sem proprietario"
            }`;
          }}
          renderTitle={(property) => property.name}
          title="Imoveis"
        />

        <ManagementPanel
          editingId={editing?.type === "owner" ? editing.id : null}
          emptyText="Nenhum proprietario cadastrado."
          isSaving={isSaving}
          items={state.owners}
          onDelete={(owner) => deleteAndRefresh("/api/owners", owner.id, owner.name)}
          onEdit={(owner) => setEditing({ id: owner.id, type: "owner" })}
          renderEditForm={(owner) => (
            <EditForm
              key={owner.id}
              action={(formData) => saveOwner(owner.id, formData)}
              onCancel={() => setEditing(null)}
            >
              <Field defaultValue={owner.name} label="Nome completo" name="name" />
              <Field defaultValue={owner.document} label="CPF/CNPJ" name="document" />
              <Field defaultValue={owner.email} label="E-mail" name="email" type="email" />
              <Field defaultValue={owner.phone} label="Telefone" name="phone" />
              <PropertyCheckboxList
                currentOwnerId={owner.id}
                defaultSelectedIds={state.properties
                  .filter((property) => property.ownerId === owner.id)
                  .map((property) => property.id)}
                owners={state.owners}
                properties={state.properties}
              />
            </EditForm>
          )}
          renderSubtitle={(owner) => {
            const linkedNames = state.properties
              .filter((property) => property.ownerId === owner.id)
              .map((property) => property.name);
            return `${owner.document} - ${owner.email} - ${
              linkedNames.length > 0
                ? `Imoveis: ${linkedNames.join(", ")}`
                : "Sem imovel vinculado"
            }`;
          }}
          renderTitle={(owner) => owner.name}
          title="Proprietarios"
        />

        <ManagementPanel
          editingId={editing?.type === "receiver" ? editing.id : null}
          emptyText="Nenhum recebedor cadastrado."
          isSaving={isSaving}
          items={state.receivers}
          onDelete={(receiver) =>
            deleteAndRefresh("/api/receivers", receiver.id, receiver.name)
          }
          onEdit={(receiver) => setEditing({ id: receiver.id, type: "receiver" })}
          renderEditForm={(receiver) => (
            <EditForm
              key={receiver.id}
              action={(formData) => saveReceiver(receiver.id, formData)}
              onCancel={() => setEditing(null)}
            >
              <Field defaultValue={receiver.name} label="Nome" name="name" />
              <Field defaultValue={receiver.document} label="CPF/CNPJ" name="document" />
              <Field
                defaultValue={receiver.email}
                label="E-mail"
                name="email"
                type="email"
              />
              <Field
                defaultValue={receiver.mpAccount}
                label="Conta Mercado Pago"
                name="mpAccount"
                required={false}
              />
              <Field
                label="Nova senha (opcional)"
                name="password"
                required={false}
                type="password"
              />
            </EditForm>
          )}
          renderExtra={(receiver) => (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
              <span
                className={
                  receiver.mpConnected
                    ? "text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-xs font-semibold text-amber-600 dark:text-amber-400"
                }
              >
                {receiver.mpConnected
                  ? `Mercado Pago conectado (token ${receiver.mpLiveMode ? "PRODUCAO" : "TESTE"}, user_id ${receiver.mpUserId ?? "?"})`
                  : "Mercado Pago nao conectado"}
              </span>
              <a
                className="btn-secondary"
                href={`/api/mercadopago/connect?receiverId=${receiver.id}`}
              >
                {receiver.mpConnected ? "Reconectar" : "Conectar Mercado Pago"}
              </a>
            </div>
          )}
          renderSubtitle={(receiver) => `${receiver.email} - ${receiver.mpAccount}`}
          renderTitle={(receiver) => receiver.name}
          title="Recebedores"
        />
      </section>
      <ContractsSection
        charges={state.charges}
        contracts={state.contracts}
        contractWitnesses={state.contractWitnesses}
        editingContractId={editing?.type === "contract" ? editing.id : null}
        isSaving={isSaving}
        onDelete={(contractId, label) =>
          deleteAndRefresh("/api/contracts", contractId, label)
        }
        onGenerateCharge={generateCharge}
        onSave={saveContract}
        onSendReminder={sendReminder}
        onStartEdit={(contractId) =>
          setEditing(contractId ? { id: contractId, type: "contract" } : null)
        }
        onSyncPayment={syncPayment}
        onToggleOwnerSigned={toggleOwnerSigned}
        onToggleWitnessSigned={toggleWitnessSigned}
        owners={state.owners}
        properties={state.properties}
        receivers={state.receivers}
        tenants={state.tenants}
      />
    </div>
  );
}
