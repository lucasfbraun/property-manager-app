"use client";

import { useState } from "react";
import { OccurrenceReporter } from "../contrato/OccurrenceReporter";

export type OccurrenceContractOption = {
  id: string;
  propertyName: string;
};

/**
 * Wraps the existing OccurrenceReporter (already used inside a single
 * contract's page) so it can live on the tenant portal home page. Since a
 * tenant can have more than one contract (see app/inquilino/page.tsx), this
 * adds a property picker when there's more than one — otherwise it just
 * renders the reporter directly for the only contract.
 */
export function OccurrencePanel({ contracts }: { contracts: OccurrenceContractOption[] }) {
  const [selectedId, setSelectedId] = useState(contracts[0]?.id ?? "");

  if (contracts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      {contracts.length > 1 ? (
        <div className="surface-card p-4">
          <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" htmlFor="occurrence-property">
            Imovel relacionado a ocorrencia
          </label>
          <select
            className="input-field"
            id="occurrence-property"
            onChange={(event) => setSelectedId(event.target.value)}
            value={selectedId}
          >
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.propertyName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedId ? <OccurrenceReporter contractId={selectedId} /> : null}
    </section>
  );
}
