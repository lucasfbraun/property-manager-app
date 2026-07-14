"use client";

import type { Owner, Property, Receiver } from "../lib/rentals";

/**
 * Multi-select of properties for the owner form, since a property has at
 * most 1 owner (Property.ownerId) but an owner must be linked to at least 1
 * property. Checking a property already assigned to a different owner will
 * reassign it away from that owner on save (assignOwnerProperties in
 * rental-repository.ts) — the "atual: ..." hint warns the admin before that
 * happens.
 */
export function PropertyCheckboxList({
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
export function WitnessCheckboxList({
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
