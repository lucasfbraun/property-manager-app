"use client";

import { useState } from "react";
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
import { EditForm } from "./ui";
import {
  ContractEditFields,
  ContractSignaturePanel,
  PaymentBadge,
} from "./contract-components";

type Props = {
  charges: Charge[];
  contracts: Contract[];
  contractWitnesses: ContractWitness[];
  /** id do contrato em edicao (ou null); controlado pelo CadastroWorkspace. */
  editingContractId: string | null;
  isSaving: boolean;
  onDelete: (contractId: string, label: string) => void;
  onGenerateCharge: (contractId: string) => void;
  onSave: (contractId: string, formData: FormData) => void;
  onSendReminder: (contractId: string) => void;
  /** null fecha o formulario de edicao. */
  onStartEdit: (contractId: string | null) => void;
  onSyncPayment: (contractId: string) => void;
  onToggleOwnerSigned: (contractId: string, signed: boolean) => void;
  onToggleWitnessSigned: (contractWitnessId: string, signed: boolean) => void;
  owners: Owner[];
  properties: Property[];
  receivers: Receiver[];
  tenants: Tenant[];
};

/**
 * Secao "Contratos cadastrados" do workspace: tabela completa no desktop e
 * cards empilhados no mobile. O estado de qual painel de assinaturas esta
 * aberto vive aqui; a edicao de contrato continua no pai porque divide o
 * mesmo EditingTarget das demais entidades.
 */
export function ContractsSection({
  charges,
  contracts,
  contractWitnesses,
  editingContractId,
  isSaving,
  onDelete,
  onGenerateCharge,
  onSave,
  onSendReminder,
  onStartEdit,
  onSyncPayment,
  onToggleOwnerSigned,
  onToggleWitnessSigned,
  owners,
  properties,
  receivers,
  tenants,
}: Props) {
  const [openSignaturesId, setOpenSignaturesId] = useState<string | null>(null);

  return (
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
              {contracts.map((contract) => {
                const tenant = tenants.find((item) => item.id === contract.tenantId);
                const property = properties.find(
                  (item) => item.id === contract.propertyId,
                );
                const receiver = receivers.find(
                  (item) => item.id === contract.receiverId,
                );
                const isEditingContract = editingContractId === contract.id;
                const latestCharge = charges
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
                            onClick={() => onGenerateCharge(contract.id)}
                            type="button"
                          >
                            Gerar cobranca
                          </button>
                          <button
                            className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            disabled={isSaving}
                            onClick={() => onSyncPayment(contract.id)}
                            type="button"
                          >
                            Verificar pagamento
                          </button>
                          <button
                            className="rounded-md border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-500/10"
                            disabled={isSaving}
                            onClick={() => onSendReminder(contract.id)}
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
                              onStartEdit(isEditingContract ? null : contract.id)
                            }
                            type="button"
                          >
                            {isEditingContract ? "Fechar" : "Editar"}
                          </button>
                          <button
                            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            disabled={isSaving}
                            onClick={() =>
                              onDelete(
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
                            contractWitnesses={contractWitnesses}
                            isSaving={isSaving}
                            onToggleOwner={(signed) => onToggleOwnerSigned(contract.id, signed)}
                            onToggleWitness={onToggleWitnessSigned}
                            owners={owners}
                            properties={properties}
                            receivers={receivers}
                          />
                        </td>
                      </tr>
                    ) : null}
                    {isEditingContract ? (
                      <tr key={`${contract.id}-edit`}>
                        <td className="bg-slate-50 px-3 py-4 dark:bg-white/5" colSpan={8}>
                          <EditForm
                            action={(formData) => onSave(contract.id, formData)}
                            layout="grid"
                            onCancel={() => onStartEdit(null)}
                          >
                            <ContractEditFields
                              contract={contract}
                              contractWitnesses={contractWitnesses}
                              receivers={receivers}
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
        {contracts.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            Nenhum contrato cadastrado.
          </p>
        ) : (
          contracts.map((contract) => {
            const tenant = tenants.find((item) => item.id === contract.tenantId);
            const property = properties.find(
              (item) => item.id === contract.propertyId,
            );
            const receiver = receivers.find(
              (item) => item.id === contract.receiverId,
            );
            const isEditingContract = editingContractId === contract.id;
            const latestCharge = charges
              .filter((charge) => charge.contractId === contract.id)
              .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))[0];

            return (
              <div
                className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5"
                key={contract.id}
              >
                {isEditingContract ? (
                  <EditForm
                    action={(formData) => onSave(contract.id, formData)}
                    layout="grid"
                    onCancel={() => onStartEdit(null)}
                  >
                    <ContractEditFields
                      contract={contract}
                      contractWitnesses={contractWitnesses}
                      receivers={receivers}
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
                        onClick={() => onGenerateCharge(contract.id)}
                        type="button"
                      >
                        Gerar cobranca
                      </button>
                      <button
                        className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        disabled={isSaving}
                        onClick={() => onSyncPayment(contract.id)}
                        type="button"
                      >
                        Verificar pagamento
                      </button>
                      <button
                        className="rounded-md border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-500/10"
                        disabled={isSaving}
                        onClick={() => onSendReminder(contract.id)}
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
                        onClick={() => onStartEdit(contract.id)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        disabled={isSaving}
                        onClick={() =>
                          onDelete(
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
                        contractWitnesses={contractWitnesses}
                        isSaving={isSaving}
                        onToggleOwner={(signed) => onToggleOwnerSigned(contract.id, signed)}
                        onToggleWitness={onToggleWitnessSigned}
                        owners={owners}
                        properties={properties}
                        receivers={receivers}
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
  );
}
