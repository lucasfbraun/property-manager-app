"use client";

import { useState } from "react";

export function PixButton({
  chargeId,
  initialExpiresAt,
  initialQrCode,
  initialQrCodeBase64,
}: {
  chargeId: string;
  initialExpiresAt: string | null;
  initialQrCode: string | null;
  initialQrCodeBase64: string | null;
}) {
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [qrCodeBase64, setQrCodeBase64] = useState(initialQrCodeBase64);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : true;
  const hasValidPix = Boolean(qrCode && qrCodeBase64 && !isExpired);

  async function generatePix() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/charges/create-pix", {
        body: JSON.stringify({ chargeId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        qrCode?: string;
        qrCodeBase64?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao gerar o Pix.");
      }
      setQrCode(result.qrCode ?? null);
      setQrCodeBase64(result.qrCodeBase64 ?? null);
      setExpiresAt(result.expiresAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyCode() {
    if (!qrCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Nao foi possivel copiar automaticamente. Copie o codigo manualmente.");
    }
  }

  if (hasValidPix) {
    return (
      <div className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-white/5">
        <span className="font-semibold">Pix</span>
        {qrCodeBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="QR Code Pix"
            className="mx-auto mt-2 h-32 w-32"
            src={`data:image/png;base64,${qrCodeBase64}`}
          />
        ) : null}
        <button
          className="btn-secondary mt-2 w-full text-xs"
          onClick={copyCode}
          type="button"
        >
          {copied ? "Codigo copiado!" : "Copiar codigo Pix"}
        </button>
        {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 text-left hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      disabled={isLoading}
      onClick={generatePix}
      type="button"
    >
      <span className="font-semibold">Pix</span>
      <span className="mt-1 block text-sm text-neutral-600 dark:text-slate-400">
        Gerar copia e cola
      </span>
      <span className="mt-3 block text-xs font-medium text-[#2563EB] dark:text-blue-300">
        {isLoading ? "Gerando..." : "Clique para gerar"}
      </span>
      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </button>
  );
}
