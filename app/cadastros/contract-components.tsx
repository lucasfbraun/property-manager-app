"use client";

import type {
  Charge,
  Contract,
  ContractWitness,
  Owner,
  Property,
  Receiver,
} from "../lib/rentals";
import { formatCurrency, isContractReadyForTenantSignature } from "../lib/rentals";
import { Field, Select } from "./ui";
import { WitnessCheckboxList } from "./checkbox-lists";

/** Same seven fields used to edit a contract, shared by the desktop table row and the mobile card. */
export function ContractEditFields({
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

export function PaymentBadge({ charge }: { charge: Charge | undefined }) {
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

/**
 * Checklist the admin uses to acknowledge (checkbox) that the property
 * owner and each witness physically signed the printed contract, since
 * neither has a portal/login. Once every box here is checked (owner box is
 * skipped/considered satisfied when the property has no owner), the tenant
 * portal unlocks that contract's signature step.
 */
export function ContractSignaturePanel({
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
