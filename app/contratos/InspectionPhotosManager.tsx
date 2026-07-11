"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { fileToBase64, isAcceptedImageType } from "../lib/client-files";

type InspectionPhoto = {
  id: string;
  fileName: string;
  contentType: string;
  caption: string | null;
  room: string | null;
  createdAt: string;
};

export function InspectionPhotosManager({ contractId }: { contractId: string }) {
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [caption, setCaption] = useState("");

  async function refresh() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/contracts/inspection-photos?contractId=${encodeURIComponent(contractId)}`,
      );
      const result = (await response.json()) as { photos?: InspectionPhoto[]; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao carregar fotos.");
      }
      setPhotos(result.photos ?? []);
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

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      for (const file of files) {
        if (!isAcceptedImageType(file)) {
          setMessage("Envie fotos em JPG ou PNG (HEIC nao e suportado ainda).");
          continue;
        }

        const fileBase64 = await fileToBase64(file);
        const response = await fetch("/api/contracts/inspection-photos", {
          body: JSON.stringify({
            caption: caption || undefined,
            contentType: file.type,
            contractId,
            fileBase64,
            fileName: file.name,
            room: room || undefined,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "Falha ao enviar foto.");
        }
      }
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (!window.confirm("Remover esta foto da vistoria?")) {
      return;
    }
    setIsUploading(true);
    try {
      const response = await fetch("/api/contracts/inspection-photos", {
        body: JSON.stringify({ contractId, id: photoId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao remover foto.");
      }
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-[#F8FAFC] p-4 dark:border-white/10 dark:bg-white/5">
      <h3 className="text-sm font-semibold">Vistoria do imovel (fotos)</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Fotos tiradas antes de gerar o contrato ficam embutidas no PDF que o
        inquilino assina — funcionam como registro do estado do imovel.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className="input-field"
          onChange={(event) => setRoom(event.target.value)}
          placeholder="Comodo (ex: Sala, Cozinha)"
          value={room}
        />
        <input
          className="input-field"
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Observacao (opcional)"
          value={caption}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="btn-primary cursor-pointer">
          {isUploading ? "Enviando..." : "Tirar foto"}
          <input
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            disabled={isUploading}
            multiple
            onChange={handleFiles}
            type="file"
          />
        </label>
        <label className="btn-secondary cursor-pointer">
          {isUploading ? "Enviando..." : "Escolher da galeria"}
          <input
            accept="image/jpeg,image/png"
            className="hidden"
            disabled={isUploading}
            multiple
            onChange={handleFiles}
            type="file"
          />
        </label>
      </div>

      {message ? (
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{message}</p>
      ) : null}

      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Carregando fotos...</p>
      ) : photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div className="group relative" key={photo.id}>
              <img
                alt={photo.caption ?? photo.room ?? "Foto da vistoria"}
                className="aspect-square w-full rounded-md border border-slate-200 object-cover dark:border-white/10"
                src={`/api/contracts/inspection-photos?photoId=${encodeURIComponent(photo.id)}`}
              />
              <button
                className="absolute right-1 top-1 rounded-md bg-rose-600/90 px-2 py-1 text-[10px] font-semibold text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                disabled={isUploading}
                onClick={() => handleDelete(photo.id)}
                type="button"
              >
                Remover
              </button>
              {photo.room || photo.caption ? (
                <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-400">
                  {[photo.room, photo.caption].filter(Boolean).join(" - ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Nenhuma foto de vistoria anexada ainda.
        </p>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
