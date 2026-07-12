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
import { formatCurrency, isContractReadyForTenantSignature } from "../lib/rentals";

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
  const [openSignaturesId, setOpenSignaturesId] = useState<string | null>(null);

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

      <section className="surface-card p-4">
        <h2 className="mb-3 font-semibold">Contratos cadastrados</h2>

        {/* Desktop/tablet: full table, only shown from lg up (wide enough for inline action buttons). */}
        <div className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Inquilino</th>
                  <th className="px-3 py-3">Imovel</th>
                  <th className="px-3 py-3">Recebedor</th>
                  <th className="px-3 py-3 text-right">Valor</th>
                  <th className="px-3 py-3">Vencimento</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Pagamento</th>
                  <th className="px-3 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
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
                  const isEditingContract =
                    editing?.type === "contract" && editing.id === contract.id;
                  const latestCharge = state.charges
                    .filter((charge) => charge.contractId === contract.id)
                    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))[0];

                  return (
                    <>
                      <tr
                        className="hover:bg-slate-50 dark:hover:bg-white/5"
                        key={contract.id}
                      >
                        <td className="px-3 py-3 font-medium">{tenant?.name}</td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          {property?.name}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          {receiver?.name}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatCurrency(contract.monthlyRent)}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          Dia {contract.dueDay}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          {contract.status}
                        </td>
                        <td className="px-3 py-3">
                          <PaymentBadge charge={latestCharge} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                              disabled={isSaving}
                              onClick={() => generateCharge(contract.id)}
                              type="button"
                            >
                              Gerar cobranca
                            </button>
                            <button
                              className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                              disabled={isSaving}
                              onClick={() => syncPayment(contract.id)}
                              type="button"
                            >
                              Verificar pagamento
                            </button>
                            <button
                              className="rounded-md border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-500/10"
                              disabled={isSaving}
                              onClick={() => sendReminder(contract.id)}
                              type="button"
                            >
                              Enviar lembrete WhatsApp
                            </button>
                            <button
                              className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                              disabled={isSaving}
                              onClick={() =>
                                setOpenSignaturesId(
                                  openSignaturesId === contract.id ? null : contract.id,
                                )
                              }
                              type="button"
                            >
                              {openSignaturesId === contract.id
                                ? "Fechar assinaturas"
                                : "Assinaturas"}
                            </button>
                            <button
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                              disabled={isSaving}
                              onClick={() =>
                                setEditing(
                                  isEditingContract
                                    ? null
                                    : { id: contract.id, type: "contract" },
                                )
                              }
                              type="button"
                            >
                              {isEditingContract ? "Fechar" : "Editar"}
                            </button>
                            <button
                              className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
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
                          </div>
                        </td>
                      </tr>
                      {openSignaturesId === contract.id ? (
                        <tr key={`${contract.id}-signatures`}>
                          <td className="bg-slate-50 px-3 py-4 dark:bg-white/5" colSpan={8}>
                            <ContractSignaturePanel
                              contract={contract}
                              contractWitnesses={state.contractWitnesses}
                              isSaving={isSaving}
                              onToggleOwner={(signed) => toggleOwnerSigned(contract.id, signed)}
                              onToggleWitness={toggleWitnessSigned}
                              owners={state.owners}
                              properties={state.properties}
                              receivers={state.receivers}
                            />
                          </td>
                        </tr>
                      ) : null}
                      {isEditingContract ? (
                        <tr key={`${contract.id}-edit`}>
                          <td className="bg-slate-50 px-3 py-4 dark:bg-white/5" colSpan={8}>
                            <EditForm
                              action={(formData) => saveContract(contract.id, formData)}
                              layout="grid"
                              onCancel={() => setEditing(null)}
                            >
                              <ContractEditFields
                                contract={contract}
                                contractWitnesses={state.contractWitnesses}
                                receivers={state.receivers}
                              />
                            </EditForm>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile/tablet: stacked cards instead of a wide table, so editing and actions
            are always inline in the normal document flow (no floating menus, no
            horizontal scrolling required to reach an action or an edit form). */}
        <div className="space-y-3 lg:hidden">
          {state.contracts.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              Nenhum contrato cadastrado.
            </p>
          ) : (
            state.contracts.map((contract) => {
              const tenant = state.tenants.find((item) => item.id === contract.tenantId);
              const property = state.properties.find(
                (item) => item.id === contract.propertyId,
              );
              const receiver = state.receivers.find(
                (item) => item.id === contract.receiverId,
              );
              const isEditingContract =
                editing?.type === "contract" && editing.id === contract.id;
              const latestCharge = state.charges
                .filter((charge) => charge.contractId === contract.id)
                .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))[0];

              return (
                <div
                  className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5"
                  key={contract.id}
                >
                  {isEditingContract ? (
                    <EditForm
                      action={(formData) => saveContract(contract.id, formData)}
                      layout="grid"
                      onCancel={() => setEditing(null)}
                    >
                      <ContractEditFields
                        contract={contract}
                        contractWitnesses={state.contractWitnesses}
                        receivers={state.receivers}
                      />
                    </EditForm>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{tenant?.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {property?.name} - {receiver?.name}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(contract.monthlyRent)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Vencimento dia {contract.dueDay}</span>
                        <span>-</span>
                        <span>{contract.status}</span>
                      </div>
                      <div className="mt-2">
                        <PaymentBadge charge={latestCharge} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
                        <button
                          className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          disabled={isSaving}
                          onClick={() => generateCharge(contract.id)}
                          type="button"
                        >
                          Gerar cobranca
                        </button>
                        <button
                          className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                          disabled={isSaving}
                          onClick={() => syncPayment(contract.id)}
                          type="button"
                        >
                          Verificar pagamento
                        </button>
                        <button
                          className="rounded-md border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-500/10"
                          disabled={isSaving}
                          onClick={() => sendReminder(contract.id)}
                          type="button"
                        >
                          Enviar lembrete WhatsApp
                        </button>
                        <button
                          className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                          disabled={isSaving}
                          onClick={() =>
                            setOpenSignaturesId(
                              openSignaturesId === contract.id ? null : contract.id,
                            )
                          }
                          type="button"
                        >
                          {openSignaturesId === contract.id
                            ? "Fechar assinaturas"
                            : "Assinaturas"}
                        </button>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                          disabled={isSaving}
                          onClick={() => setEditing({ id: contract.id, type: "contract" })}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
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
                      </div>
                      {openSignaturesId === contract.id ? (
                        <ContractSignaturePanel
                          contract={contract}
                          contractWitnesses={state.contractWitnesses}
                          isSaving={isSaving}
                          onToggleOwner={(signed) => toggleOwnerSigned(contract.id, signed)}
                          onToggleWitness={toggleWitnessSigned}
                          owners={state.owners}
                          properties={state.properties}
                          receivers={state.receivers}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

/** Same seven fields used to edit a contract, shared by the desktop table row and the mobile card. */
function ContractEditFields({
  contract,
  contractWitnesses,
  receivers,
}: {
  contract: Contract;
  contractWitnesses: ContractWitness[];
  receivers: Receiver[];
}) {
  return (
    <>
      <Field
        defaultValue={String(contract.monthlyRent)}
        label="Valor"
        name="monthlyRent"
        type="number"
      />
      <Field
        defaultValue={String(contract.dueDay)}
        label="Dia venc."
        name="dueDay"
        type="number"
      />
      <Field defaultValue={contract.endsAt} label="Fim" name="endsAt" type="date" />
      <Select
        defaultValue={contract.status}
        label="Status"
        name="status"
        options={["Ativo", "Vence em breve", "Encerrado"]}
      />
      <Field
        defaultValue={String((contract.fineRate * 100).toFixed(2))}
        label="Multa (%)"
        name="fineRate"
        type="number"
      />
      <Field
        defaultValue={String((contract.monthlyInterestRate * 100).toFixed(2))}
        label="Juros ao mes (%)"
        name="monthlyInterestRate"
        type="number"
      />
      <Field
        defaultValue={String(contract.graceDays)}
        label="Carencia (dias)"
        name="graceDays"
        type="number"
      />
      <div className="sm:col-span-3">
        <WitnessCheckboxList
          defaultSelectedIds={contractWitnesses
            .filter((witness) => witness.contractId === contract.id)
            .map((witness) => witness.receiverId)}
          receivers={receivers}
        />
      </div>
    </>
  );
}

function PaymentBadge({ charge }: { charge: Charge | undefined }) {
  if (!charge) {
    return <span className="text-xs text-slate-400 dark:text-slate-600">Sem cobranca</span>;
  }
  return (
    <span
      className={
        charge.status === "Paga"
          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
          : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
      }
    >
      {charge.reference}: {charge.status}
      {charge.rateioAmount ? ` (+rateio ${formatCurrency(charge.rateioAmount)})` : ""}
    </span>
  );
}

function ManagementPanel<T extends { id: string }>({
  editingId,
  emptyText,
  isSaving,
  items,
  onDelete,
  onEdit,
  renderEditForm,
  renderExtra,
  renderSubtitle,
  renderTitle,
  title,
}: {
  editingId: string | null;
  emptyText: string;
  isSaving: boolean;
  items: T[];
  onDelete: (item: T) => void;
  onEdit: (item: T) => void;
  renderEditForm: (item: T) => React.ReactNode;
  renderExtra?: (item: T) => React.ReactNode;
  renderSubtitle: (item: T) => string;
  renderTitle: (item: T) => string;
  title: string;
}) {
  return (
    <div className="surface-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-3 dark:border-white/10 dark:bg-white/5"
              key={item.id}
            >
              {editingId === item.id ? (
                renderEditForm(item)
              ) : (
                <div className="flex min-h-14 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {renderTitle(item)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {renderSubtitle(item)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      disabled={isSaving}
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      disabled={isSaving}
                      onClick={() => onDelete(item)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
              {editingId !== item.id && renderExtra ? renderExtra(item) : null}
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
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
    <form action={action} className="surface-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
      <button className="btn-primary mt-4" type="submit">
        Adicionar
      </button>
    </form>
  );
}

function EditForm({
  action,
  children,
  layout = "stack",
  onCancel,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  layout?: "stack" | "grid";
  onCancel: () => void;
}) {
  return (
    <form action={action} className="space-y-3">
      <div
        className={
          layout === "grid"
            ? "grid gap-3 sm:grid-cols-3"
            : "space-y-3"
        }
      >
        {children}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          Salvar
        </button>
        <button className="btn-secondary" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required = true,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        className="input-field"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function Select({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <select className="input-field" defaultValue={defaultValue ?? ""} name={name} required>
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

/**
 * Multi-select of properties for the owner form, since a property has at
 * most 1 owner (Property.ownerId) but an owner must be linked to at least 1
 * property. Checking a property already assigned to a different owner will
 * reassign it away from that owner on save (assignOwnerProperties in
 * rental-repository.ts) — the "atual: ..." hint warns the admin before that
 * happens.
 */
function PropertyCheckboxList({
  currentOwnerId,
  defaultSelectedIds,
  owners,
  properties,
}: {
  currentOwnerId?: string;
  defaultSelectedIds?: string[];
  owners: Owner[];
  properties: Property[];
}) {
  return (
    <div className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        Imoveis vinculados
      </span>
      <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3 dark:border-white/10">
        {properties.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum imovel cadastrado.
          </p>
        ) : (
          properties.map((property) => {
            const otherOwner =
              property.ownerId && property.ownerId !== currentOwnerId
                ? owners.find((owner) => owner.id === property.ownerId)
                : null;
            return (
              <label className="flex items-center justify-between gap-2" key={property.id}>
                <span className="flex items-center gap-2">
                  <input
                    className="h-4 w-4"
                    defaultChecked={defaultSelectedIds?.includes(property.id)}
                    name="propertyIds"
                    type="checkbox"
                    value={property.id}
                  />
                  {property.name}
                </span>
                {otherOwner ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    atual: {otherOwner.name}
                  </span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Multi-select of receivers acting as witnesses (testemunhas) for a
 * contract. A contract can have zero or more witnesses; unlike the
 * owner/property relation this is a plain many-to-many, so there's no
 * "atual: ..." reassignment warning here — the same receiver can witness
 * several contracts.
 */
function WitnessCheckboxList({
  defaultSelectedIds,
  receivers,
}: {
  defaultSelectedIds?: string[];
  receivers: Receiver[];
}) {
  return (
    <div className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        Testemunhas (opcional)
      </span>
      <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3 dark:border-white/10">
        {receivers.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum recebedor cadastrado.
          </p>
        ) : (
          receivers.map((receiver) => (
            <label className="flex items-center gap-2" key={receiver.id}>
              <input
                className="h-4 w-4"
                defaultChecked={defaultSelectedIds?.includes(receiver.id)}
                name="witnessIds"
                type="checkbox"
                value={receiver.id}
              />
              {receiver.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Checklist the admin uses to acknowledge (checkbox) that the property
 * owner and each witness physically signed the printed contract, since
 * neither has a portal/login. Once every box here is checked (owner box is
 * skipped/considered satisfied when the property has no owner), the tenant
 * portal unlocks that contract's signature step.
 */
function ContractSignaturePanel({
  contract,
  contractWitnesses,
  isSaving,
  onToggleOwner,
  onToggleWitness,
  owners,
  properties,
  receivers,
}: {
  contract: Contract;
  contractWitnesses: ContractWitness[];
  isSaving: boolean;
  onToggleOwner: (signed: boolean) => void;
  onToggleWitness: (contractWitnessId: string, signed: boolean) => void;
  owners: Owner[];
  properties: Property[];
  receivers: Receiver[];
}) {
  const property = properties.find((item) => item.id === contract.propertyId);
  const owner = property?.ownerId
    ? owners.find((item) => item.id === property.ownerId)
    : undefined;
  const witnesses = contractWitnesses.filter((witness) => witness.contractId === contract.id);
  const ready = isContractReadyForTenantSignature(contract, property, contractWitnesses);

  return (
    <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        Ciencia de assinaturas (testemunhas e proprietario assinam antes do inquilino)
      </p>

      {property?.ownerId ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={Boolean(contract.ownerSignedAt)}
            className="h-4 w-4"
            disabled={isSaving}
            onChange={(event) => onToggleOwner(event.target.checked)}
            type="checkbox"
          />
          Proprietario ({owner?.name ?? "sem cadastro"}) assinou
        </label>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Imovel sem proprietario cadastrado — etapa nao se aplica.
        </p>
      )}

      {witnesses.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhuma testemunha selecionada para este contrato.
        </p>
      ) : (
        witnesses.map((witness) => {
          const receiver = receivers.find((item) => item.id === witness.receiverId);
          return (
            <label className="flex items-center gap-2 text-sm" key={witness.id}>
              <input
                checked={Boolean(witness.signedAt)}
                className="h-4 w-4"
                disabled={isSaving}
                onChange={(event) => onToggleWitness(witness.id, event.target.checked)}
                type="checkbox"
              />
              Testemunha {receiver?.name ?? "?"} assinou
            </label>
          );
        })
      )}

      <p
        className={
          ready
            ? "text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            : "text-xs font-semibold text-amber-600 dark:text-amber-400"
        }
      >
        {ready
          ? "Pronto: o inquilino ja pode assinar."
          : "Aguardando assinaturas antes de liberar o inquilino."}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function reminderEventLabel(event: string | undefined) {
  switch (event) {
    case "before_due":
      return "antes do vencimento";
    case "due_day":
      return "vencimento hoje";
    case "after_due":
      return "atraso";
    case "payment_confirmed":
      return "pagamento confirmado";
    case "contract_expiring":
      return "contrato vencendo";
    default:
      return "lembrete";
  }
}
