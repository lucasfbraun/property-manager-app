"use client";

import { useEffect, useState } from "react";

type OccurrenceStatus = "open" | "in_review" | "resolved";

type OccurrencePhoto = {
  id: string;
  fileName: string;
};

type Occurrence = {
  id: string;
  tenantName: string;
  propertyName: string;
  description: string;
  status: OccurrenceStatus;
  createdAt: string;
  resolutionNote: string | null;
  photos: OccurrencePhoto[];
};

const statusLabel: Record<OccurrenceStatus, string> = {
  in_review: "Em analise",
  open: "Aberta",
  resolved: "Resolvida",
};

const statusTone: Record<OccurrenceStatus, string> = {
  in_review: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  open: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
};

export function OccurrencesPanel() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/contracts/occurrences");
      const result = (await response.json()) as { occurrences?: Occurrence[]; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao carregar ocorrencias.");
      }
      setOccurrences(result.occurrences ?? []);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function updateStatus(id: string, status: OccurrenceStatus) {
    let resolutionNote: string | undefined;
    if (status === "resolved") {
      resolutionNote = window.prompt("Observacao sobre a resolucao (opcional):") ?? undefined;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/occurrences", {
        body: JSON.stringify({ id, resolutionNote, status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao atualizar ocorrencia.");
      }
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="surface-card p-4">
      <h2 className="mb-3 font-semibold">Ocorrencias reportadas pelos inquilinos</h2>
      {message ? <p className="mb-3 text-sm text-rose-700 dark:text-rose-300">{message}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : occurrences.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma ocorrencia reportada ate o momento.
        </p>
      ) : (
        <div className="space-y-3">
          {occurrences.map((occurrence) => (
            <div
              className="rounded-md border border-slate-200 bg-[#F8FAFC] p-4 dark:border-white/10 dark:bg-white/5"
              key={occurrence.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{occurrence.tenantName}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[occurrence.status]}`}
                    >
                      {statusLabel[occurrence.status]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {occurrence.propertyName}
                  </p>
                  <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                    {occurrence.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Enviado em {new Date(occurrence.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {occurrence.resolutionNote ? (
                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                      Resolucao: {occurrence.resolutionNote}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {occurrence.status !== "in_review" ? (
                    <button
                      className="btn-secondary"
                      disabled={isSaving}
                      onClick={() => updateStatus(occurrence.id, "in_review")}
                      type="button"
                    >
                      Marcar em analise
                    </button>
                  ) : null}
                  {occurrence.status !== "resolved" ? (
                    <button
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() => updateStatus(occurrence.id, "resolved")}
                      type="button"
                    >
                      Marcar resolvida
                    </button>
                  ) : null}
                </div>
              </div>

              {occurrence.photos.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {occurrence.photos.map((photo) => (
                    <a
                      href={`/api/contracts/occurrence-photos?photoId=${encodeURIComponent(photo.id)}`}
                      key={photo.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <img
                        alt={photo.fileName}
                        className="aspect-square w-full rounded-md border border-slate-200 object-cover dark:border-white/10"
                        src={`/api/contracts/occurrence-photos?photoId=${encodeURIComponent(photo.id)}`}
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
