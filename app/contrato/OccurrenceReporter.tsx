"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { fileToBase64, isAcceptedImageType } from "../lib/client-files";

type OccurrenceStatus = "open" | "in_review" | "resolved";

type Occurrence = {
  id: string;
  contractId: string;
  description: string;
  status: OccurrenceStatus;
  createdAt: string;
  resolutionNote: string | null;
  photos: Array<{ id: string; fileName: string }>;
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

const MAX_PHOTOS = 8;

export function OccurrenceReporter({ contractId }: { contractId: string }) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/contracts/occurrences");
      const result = (await response.json()) as { occurrences?: Occurrence[]; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao carregar ocorrencias.");
      }
      setOccurrences((result.occurrences ?? []).filter((item) => item.contractId === contractId));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const accepted = files.filter(isAcceptedImageType);
    if (accepted.length < files.length) {
      setMessage("Algumas fotos foram ignoradas: envie apenas JPG ou PNG.");
    }
    setPendingFiles((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitOccurrence() {
    if (!description.trim()) {
      setMessage("Descreva o que aconteceu antes de enviar.");
      return;
    }

    setIsSending(true);
    setMessage(null);
    try {
      const photos = await Promise.all(
        pendingFiles.map(async (file) => ({
          contentType: file.type,
          fileBase64: await fileToBase64(file),
          fileName: file.name,
        })),
      );

      const response = await fetch("/api/contracts/occurrences", {
        body: JSON.stringify({ contractId, description, photos }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao registrar ocorrencia.");
      }

      setDescription("");
      setPendingFiles([]);
      setShowForm(false);
      setMessage("Ocorrencia registrada. O administrador foi notificado.");
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Divergencias e ocorrencias</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
            Em caso de desacordo com o estado do imovel ou ruptura contratual,
            registre aqui com fotos.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((prev) => !prev)} type="button">
          {showForm ? "Cancelar" : "Registrar ocorrencia"}
        </button>
      </div>

      {showForm ? (
        <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-[#F8FAFC] p-4 dark:border-white/10 dark:bg-white/5">
          <textarea
            className="input-field min-h-24"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descreva o que aconteceu (ex: infiltracao na sala, item danificado, desacordo sobre o estado do imovel...)"
            value={description}
          />

          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer">
              Tirar foto
              <input
                accept="image/jpeg,image/png"
                capture="environment"
                className="hidden"
                multiple
                onChange={handleFiles}
                type="file"
              />
            </label>
            <label className="btn-secondary cursor-pointer">
              Escolher da galeria
              <input
                accept="image/jpeg,image/png"
                className="hidden"
                multiple
                onChange={handleFiles}
                type="file"
              />
            </label>
          </div>

          {pendingFiles.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {pendingFiles.map((file, index) => (
                <div className="relative" key={`${file.name}-${index}`}>
                  <img
                    alt={file.name}
                    className="aspect-square w-full rounded-md border border-slate-200 object-cover dark:border-white/10"
                    src={URL.createObjectURL(file)}
                  />
                  <button
                    className="absolute right-1 top-1 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    onClick={() => removePendingFile(index)}
                    type="button"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button className="btn-primary" disabled={isSending} onClick={submitOccurrence} type="button">
            {isSending ? "Enviando..." : "Enviar ocorrencia"}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
        ) : occurrences.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma ocorrencia registrada para este contrato.
          </p>
        ) : (
          occurrences.map((occurrence) => (
            <div
              className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5"
              key={occurrence.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[occurrence.status]}`}
                >
                  {statusLabel[occurrence.status]}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(occurrence.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                {occurrence.description}
              </p>
              {occurrence.resolutionNote ? (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                  Resolucao: {occurrence.resolutionNote}
                </p>
              ) : null}
              {occurrence.photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {occurrence.photos.map((photo) => (
                    <img
                      alt={photo.fileName}
                      className="aspect-square w-full rounded-md border border-slate-200 object-cover dark:border-white/10"
                      key={photo.id}
                      src={`/api/contracts/occurrence-photos?photoId=${encodeURIComponent(photo.id)}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
