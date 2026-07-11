import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { signatureStatusLabel } from "../lib/rentals";
import { formatCurrency, formatDate } from "../lib/rentals";
import { listInspectionPhotos } from "../lib/inspections";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { SignedContractUpload } from "./SignedContractUpload";
import { OccurrenceReporter } from "./OccurrenceReporter";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  not_generated: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
  awaiting_signature: "bg-[#DBEAFE] text-[#1D4ED8] ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
};

export default async function ContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>;
}) {
  const user = await requireUser(["admin", "tenant"]);
  const { contractId } = await searchParams;

  const rentalData = await getRentalData();
  const contract = rentalData.contracts.find((item) => item.id === contractId);

  const backHref = user.role === "tenant" ? "/inquilino" : "/contratos";

  if (!contract || (user.role === "tenant" && contract.tenantId !== user.tenantId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-[#0F172A] dark:bg-transparent dark:text-slate-100">
        <div className="surface-card w-full max-w-md p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Contrato nao encontrado.
          </p>
          <Link className="btn-secondary mt-4 inline-flex" href={backHref}>
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const tenant = rentalData.tenants.find((item) => item.id === contract.tenantId);
  const property = rentalData.properties.find((item) => item.id === contract.propertyId);
  const receiver = rentalData.receivers.find((item) => item.id === contract.receiverId);
  const inspectionPhotos = await listInspectionPhotos(contract.id);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8 print:bg-white print:px-0 print:py-0 print:text-black">
      <div className="mx-auto max-w-4xl">
        <header className="surface-card mb-5 p-5 print:hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href={backHref}>
                Voltar
              </Link>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Contrato: {property?.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {tenant?.name} - {property?.address}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone[contract.signatureStatus]}`}
            >
              {signatureStatusLabel(contract.signatureStatus)}
            </span>
            {contract.generatedDocumentKey ? (
              <a
                className="btn-secondary"
                href={`/api/contracts/document?contractId=${encodeURIComponent(contract.id)}`}
                rel="noreferrer"
                target="_blank"
              >
                Baixar / abrir PDF
              </a>
            ) : null}
          </div>
          {contract.reviewNote ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              Observacao do administrador: {contract.reviewNote}
            </div>
          ) : null}
        </header>

        {contract.contractText ? (
          <section className="surface-card mb-5 p-6 print:border-none print:bg-white print:p-0 print:shadow-none">
            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 print:hidden">
              <Info label="Inquilino" value={tenant?.name ?? "-"} />
              <Info label="Recebedor" value={receiver?.name ?? "-"} />
              <Info label="Aluguel mensal" value={formatCurrency(contract.monthlyRent)} />
              <Info
                label="Periodo"
                value={`${formatDate(contract.startsAt)} ate ${formatDate(contract.endsAt)}`}
              />
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-[#0F172A] dark:text-slate-100 print:text-black">
              {contract.contractText}
            </pre>
          </section>
        ) : (
          <section className="surface-card p-6 text-sm text-slate-600 dark:text-slate-400 print:hidden">
            O administrador ainda nao gerou o texto deste contrato a partir de
            um modelo. Assim que gerado, ele aparecera aqui para download e
            assinatura.
          </section>
        )}

        {inspectionPhotos.length > 0 ? (
          <section className="surface-card mb-5 p-6 print:hidden">
            <h2 className="font-semibold">Fotos da vistoria</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Estado do imovel registrado antes da assinatura. Estas fotos
              tambem estao embutidas no PDF do contrato.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {inspectionPhotos.map((photo) => (
                <div key={photo.id}>
                  <img
                    alt={photo.caption ?? photo.room ?? "Foto da vistoria"}
                    className="aspect-square w-full rounded-md border border-slate-200 object-cover dark:border-white/10"
                    src={`/api/contracts/inspection-photos?photoId=${encodeURIComponent(photo.id)}`}
                  />
                  {photo.room || photo.caption ? (
                    <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">
                      {[photo.room, photo.caption].filter(Boolean).join(" - ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {user.role === "tenant" && contract.contractText ? (
          <div className="print:hidden">
            <SignedContractUpload
              contractId={contract.id}
              signatureStatus={contract.signatureStatus}
              signedFileName={contract.signedFileName}
            />
          </div>
        ) : null}

        {user.role === "tenant" ? (
          <div className="mt-5 print:hidden">
            <OccurrenceReporter contractId={contract.id} />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-neutral-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
