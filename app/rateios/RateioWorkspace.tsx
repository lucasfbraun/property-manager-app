"use client";

import { useMemo, useState } from "react";
import type { Property } from "../lib/rentals";
import { formatCurrency } from "../lib/rentals";
import { fileToBase64 } from "../lib/client-files";

const RATEIO_CATEGORIES = [
  { label: "Agua", value: "agua" },
  { label: "Condominio", value: "condominio" },
  { label: "Gas", value: "gas" },
  { label: "Internet/TV", value: "internet" },
  { label: "IPTU", value: "iptu" },
  { label: "Outro", value: "outro" },
];

type PropertyWithResidents = Property & {
  residentCount: number | null;
  tenantName: string | null;
};

type SplitMode = "equal" | "residents";

type RateioAllocation = {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  applied: boolean;
  chargeId: string | null;
};

type Rateio = {
  id: string;
  category: string;
  description: string | null;
  reference: string;
  totalAmount: number;
  invoiceFileName: string | null;
  createdAt: string;
  allocations: RateioAllocation[];
};

const ACCEPTED_INVOICE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function categoryLabel(category: string): string {
  return RATEIO_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

/** "2026-07" -> "Julho/2026", matching the same reference format charges use (app/lib/charge-scheduler.ts). */
function formatMonthReference(monthValue: string): string {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return monthValue;
  }
  const date = new Date(Date.UTC(year, month - 1, 15));
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    date,
  );
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized}/${year}`;
}

/**
 * Mirrors the server-side split in app/lib/rateios.ts (splitByWeights) so
 * the preview shown to the admin matches what will actually be charged.
 */
function previewShares(
  totalAmount: number,
  properties: PropertyWithResidents[],
  splitMode: SplitMode,
): Array<{ property: PropertyWithResidents; weight: number; amount: number }> {
  const weights = properties.map((property) =>
    splitMode === "residents" ? property.residentCount ?? 1 : 1,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || properties.length;

  let allocated = 0;
  return properties.map((property, index) => {
    const isLast = index === properties.length - 1;
    const amount = isLast
      ? Math.round((totalAmount - allocated) * 100) / 100
      : Math.round(((totalAmount * weights[index]) / totalWeight) * 100) / 100;
    if (!isLast) {
      allocated += amount;
    }
    return { amount, property, weight: weights[index] };
  });
}

export function RateioWorkspace({
  initialProperties,
  initialRateios,
}: {
  initialProperties: PropertyWithResidents[];
  initialRateios: Rateio[];
}) {
  const [rateios, setRateios] = useState<Rateio[]>(initialRateios);
  const [category, setCategory] = useState("agua");
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("residents");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleProperty(propertyId: string) {
    setSelectedPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  }

  const selectedProperties = initialProperties.filter((property) =>
    selectedPropertyIds.includes(property.id),
  );
  const parsedAmount = Number(totalAmount.replace(",", "."));
  const preview = useMemo(() => {
    if (selectedProperties.length === 0 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return [];
    }
    return previewShares(parsedAmount, selectedProperties, splitMode);
  }, [parsedAmount, selectedProperties, splitMode]);

  async function refreshRateios() {
    const response = await fetch("/api/rateios");
    if (!response.ok) {
      return;
    }
    const result = (await response.json()) as { rateios: Rateio[] };
    setRateios(result.rateios);
  }

  async function submitRateio() {
    setMessage(null);

    if (!month) {
      setMessage("Escolha o mes de referencia.");
      return;
    }
    const amount = Number(totalAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Informe um valor total valido.");
      return;
    }
    if (selectedPropertyIds.length === 0) {
      setMessage("Selecione ao menos um imovel para o rateio.");
      return;
    }
    if (invoiceFile && !ACCEPTED_INVOICE_TYPES.includes(invoiceFile.type)) {
      setMessage("O comprovante precisa ser JPG, PNG ou PDF.");
      return;
    }

    setIsSaving(true);
    try {
      const invoiceBase64 = invoiceFile ? await fileToBase64(invoiceFile) : undefined;

      const response = await fetch("/api/rateios", {
        body: JSON.stringify({
          category,
          description: description || undefined,
          invoiceBase64,
          invoiceContentType: invoiceFile?.type,
          invoiceFileName: invoiceFile?.name,
          propertyIds: selectedPropertyIds,
          reference: formatMonthReference(month),
          splitMode,
          totalAmount: amount,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        perPropertyAmount?: number;
        appliedCount?: number;
        pendingCount?: number;
        amountsByProperty?: Record<string, number>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao registrar o rateio.");
      }

      const breakdown = result.amountsByProperty
        ? selectedProperties
            .map((property) => `${property.name}: ${formatCurrency(result.amountsByProperty?.[property.id] ?? 0)}`)
            .join(", ")
        : "";

      setMessage(
        `Rateio de ${categoryLabel(category)} registrado (${splitMode === "residents" ? "proporcional a moradores" : "igual entre imoveis"}). ` +
          (breakdown ? `${breakdown}. ` : "") +
          `${result.appliedCount ?? 0} cobranca(s) atualizada(s) na hora` +
          (result.pendingCount ? `, ${result.pendingCount} pendente(s) ate a cobranca ser gerada.` : "."),
      );
      setTotalAmount("");
      setDescription("");
      setSelectedPropertyIds([]);
      setInvoiceFile(null);
      await refreshRateios();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-4">
        <h2 className="font-semibold">Novo rateio</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
          Escolha a categoria da despesa, o valor total e os imoveis
          participantes. O valor e dividido entre eles (igualmente ou
          proporcional ao numero de moradores) e somado na cobranca do mes de
          cada um.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Categoria da despesa
            </span>
            <select
              className="input-field"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              {RATEIO_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Descricao (opcional)
            </span>
            <input
              className="input-field"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                category === "outro"
                  ? "Descreva o tipo de despesa"
                  : "Ex: conta de julho, hidrometro compartilhado"
              }
              value={description}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Modo de rateio
          </span>
          <div className="flex flex-wrap gap-2">
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                splitMode === "residents"
                  ? "border-[#2563EB] bg-[#DBEAFE] font-semibold text-[#1D4ED8] dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
              }`}
            >
              <input
                checked={splitMode === "residents"}
                className="mr-2"
                name="splitMode"
                onChange={() => setSplitMode("residents")}
                type="radio"
              />
              Proporcional ao numero de moradores (mais justo)
            </label>
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                splitMode === "equal"
                  ? "border-[#2563EB] bg-[#DBEAFE] font-semibold text-[#1D4ED8] dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
              }`}
            >
              <input
                checked={splitMode === "equal"}
                className="mr-2"
                name="splitMode"
                onChange={() => setSplitMode("equal")}
                type="radio"
              />
              Igual entre os imoveis
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Mes de referencia
            </span>
            <input
              className="input-field"
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
              Valor total (R$)
            </span>
            <input
              className="input-field"
              inputMode="decimal"
              onChange={(event) => setTotalAmount(event.target.value)}
              placeholder="0,00"
              value={totalAmount}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Imoveis a participar do rateio
          </span>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {initialProperties.map((property) => (
              <label
                className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                key={property.id}
              >
                <input
                  checked={selectedPropertyIds.includes(property.id)}
                  className="mt-1"
                  onChange={() => toggleProperty(property.id)}
                  type="checkbox"
                />
                <span>
                  <span className="block">{property.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {property.residentCount != null
                      ? `${property.residentCount} morador(es)${property.tenantName ? ` - ${property.tenantName}` : ""}`
                      : property.tenantName
                        ? `${property.tenantName} - moradores nao informados`
                        : "sem inquilino ativo"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {preview.length > 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Pre-visualizacao do rateio
            </p>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {preview.map(({ property, weight, amount }) => (
                <p key={property.id}>
                  {property.name}
                  {splitMode === "residents" ? ` (${weight} morador(es))` : ""}:{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatCurrency(amount)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Comprovante (opcional)
          </span>
          <label className="btn-secondary inline-flex cursor-pointer">
            {invoiceFile ? invoiceFile.name : "Anexar comprovante (JPG, PNG ou PDF)"}
            <input
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>

        {message ? (
          <p className="mt-3 text-sm text-neutral-700 dark:text-slate-300">{message}</p>
        ) : null}

        <button
          className="btn-primary mt-4"
          disabled={isSaving}
          onClick={submitRateio}
          type="button"
        >
          {isSaving ? "Registrando..." : "Registrar rateio"}
        </button>
      </section>

      <section className="surface-card p-4">
        <h2 className="mb-3 font-semibold">Rateios registrados</h2>
        {rateios.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum rateio registrado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {rateios.map((rateio) => (
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                key={rateio.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{rateio.reference}</h3>
                      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] dark:bg-blue-500/10 dark:text-blue-300">
                        {categoryLabel(rateio.category)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Total: {formatCurrency(rateio.totalAmount)} - dividido entre{" "}
                      {rateio.allocations.length} imovel(is)
                      {rateio.description ? ` - ${rateio.description}` : ""}
                    </p>
                  </div>
                  {rateio.invoiceFileName ? (
                    <a
                      className="text-xs font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
                      href={`/api/rateios/invoice?rateioId=${rateio.id}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver comprovante anexado
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {rateio.allocations.map((allocation) => (
                    <div
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#0F172A]"
                      key={allocation.id}
                    >
                      <p className="font-semibold">{allocation.propertyName}</p>
                      <p className="mt-1 text-neutral-600 dark:text-slate-400">
                        {formatCurrency(allocation.amount)} -{" "}
                        {allocation.applied ? "aplicado na cobranca" : "pendente (cobranca ainda nao gerada)"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
