"use client";

import { useState, type ChangeEvent } from "react";
import type { SignatureStatus } from "../lib/rentals";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

export function SignedContractUpload({
  contractId,
  signatureStatus,
  signedFileName,
}: {
  contractId: string;
  signatureStatus: SignatureStatus;
  signedFileName: string | null;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("Envie um arquivo em PDF.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setMessage(
        `Arquivo muito grande (limite de ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)}MB).`,
      );
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const fileBase64 = await toBase64(file);
      const response = await fetch("/api/contracts/upload-signed", {
        body: JSON.stringify({ contractId, fileBase64, fileName: file.name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao enviar o contrato assinado.");
      }
      setMessage("Contrato assinado enviado. Aguarde a aprovacao do administrador.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsUploading(false);
    }
  }

  if (signatureStatus === "not_generated") {
    return null;
  }

  if (signatureStatus === "approved") {
    return (
      <section className="surface-card p-4">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Este contrato ja foi assinado e aprovado.
          {signedFileName ? ` Arquivo: ${signedFileName}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="surface-card p-4">
      <h2 className="font-semibold">Enviar contrato assinado</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Baixe o PDF acima, assine (manual ou digitalmente) e envie o arquivo
        assinado aqui para aprovacao do administrador.
      </p>

      {signatureStatus === "in_review" ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Um arquivo ja foi enviado e esta aguardando aprovacao.
          {signedFileName ? ` (${signedFileName})` : ""} Voce pode enviar um
          novo arquivo para substitui-lo, se necessario.
        </p>
      ) : null}

      {signatureStatus === "rejected" ? (
        <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
          O envio anterior foi rejeitado. Envie um novo arquivo assinado.
        </p>
      ) : null}

      <label className="btn-primary mt-4 inline-flex cursor-pointer">
        {isUploading ? "Enviando..." : "Escolher arquivo PDF"}
        <input
          accept="application/pdf"
          className="hidden"
          disabled={isUploading}
          onChange={handleFile}
          type="file"
        />
      </label>

      {message ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      ) : null}
    </section>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.slice(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
