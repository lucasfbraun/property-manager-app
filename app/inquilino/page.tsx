import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  getTenantPortalData,
  signatureStatusLabel,
} from "../lib/rentals";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { PixButton } from "./PixButton";

export const dynamic = "force-dynamic";

const statusTone = {
  Aberta: "bg-[#DBEAFE] text-[#2563EB] ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  Vencida: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
};

const signatureTone: Record<string, string> = {
  not_generated: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
  awaiting_signature: "bg-[#DBEAFE] text-[#1D4ED8] ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
};

export default async function TenantPortal() {
  const user = await requireUser(["tenant"]);

  if (!user.tenantId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-[#0F172A] dark:bg-transparent dark:text-slate-100">
        <div className="surface-card w-full max-w-md p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sua conta ainda nao esta vinculada a um cadastro de inquilino.
            Fale com o administrador.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </main>
    );
  }

  const rentalData = await getRentalData();
  const portal = getTenantPortalData(user.tenantId, rentalData);
  const currentContract = portal.contracts[0];
  const openCharges = portal.charges.filter((charge) => charge.status !== "Paga");

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="surface-card mb-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
                Voltar ao painel
              </Link>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Portal do inquilino
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {portal.tenant.name} - {portal.tenant.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <div className="mt-4 w-fit rounded-md bg-[#DBEAFE] px-4 py-2 dark:bg-blue-500/10">
            <p className="text-xs font-semibold uppercase text-[#2563EB] dark:text-blue-300">
              Status cadastral
            </p>
            <p className="mt-1 font-semibold">{portal.tenant.status}</p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="surface-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Cobrancas em aberto
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                    Consulte o valor atualizado antes de pagar.
                  </p>
                </div>
                <button className="btn-primary">Solicitar 2a via</button>
              </div>

              <div className="mt-4 space-y-3">
                {openCharges.length > 0 ? (
                  openCharges.map((charge) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                    key={charge.id}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{charge.reference}</h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[charge.status]}`}
                          >
                            {charge.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                          Vencimento em {formatDate(charge.dueDate)}
                        </p>
                        {charge.daysLate > 0 ? (
                          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">
                            {charge.daysLate} dias em atraso, com multa e juros
                            aplicados.
                          </p>
                        ) : null}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-slate-400">
                          Valor atualizado
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {formatCurrency(charge.totalDue)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <PixButton
                        chargeId={charge.id}
                        initialExpiresAt={charge.pixExpiresAt}
                        initialQrCode={charge.pixQrCode}
                        initialQrCodeBase64={charge.pixQrCodeBase64}
                      />
                      <PaymentOption
                        label="Cartao"
                        note="Credito a vista"
                        state="Fase posterior"
                      />
                      <PaymentOption
                        label="WhatsApp"
                        note="Receber link"
                        state="Lembrete automatico"
                      />
                    </div>
                  </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    Nenhuma cobranca em aberto encontrada para este inquilino.
                  </div>
                )}
              </div>
            </section>

            <section className="surface-card p-4">
              <h2 className="mb-3 text-lg font-semibold">Historico</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#DBEAFE] text-xs uppercase text-slate-600 dark:bg-white/5 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Competencia</th>
                      <th className="px-3 py-3">Vencimento</th>
                      <th className="px-3 py-3">Metodo</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {portal.charges.map((charge) => (
                      <tr key={charge.id}>
                        <td className="px-3 py-3 font-medium">
                          {charge.reference}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="px-3 py-3 text-neutral-600 dark:text-slate-400">
                          {charge.paymentMethod ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatCurrency(charge.amount)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[charge.status]}`}
                          >
                            {charge.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            {currentContract ? (
              <section className="surface-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Contrato atual</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${signatureTone[currentContract.signatureStatus]}`}
                  >
                    {signatureStatusLabel(currentContract.signatureStatus)}
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <Info label="Imovel" value={currentContract.property.name} />
                  <Info
                    label="Endereco"
                    value={currentContract.property.address}
                  />
                  <Info
                    label="Recebedor"
                    value={`${currentContract.receiver.name} (${currentContract.receiver.mpAccount})`}
                  />
                  <Info
                    label="Aluguel mensal"
                    value={formatCurrency(currentContract.monthlyRent)}
                  />
                  <Info
                    label="Periodo"
                    value={`${formatDate(currentContract.startsAt)} ate ${formatDate(currentContract.endsAt)}`}
                  />
                  <Info label="Vencimento" value={`Dia ${currentContract.dueDay}`} />
                </dl>
                {currentContract.signatureStatus !== "not_generated" ? (
                  <Link
                    className="btn-primary mt-4 inline-flex"
                    href={`/contrato?contractId=${currentContract.id}`}
                  >
                    Ver contrato e assinatura
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    O administrador ainda nao gerou o documento deste contrato.
                  </p>
                )}
              </section>
            ) : (
              <section className="surface-card p-4 text-sm text-slate-600 dark:text-slate-400">
                Nenhum contrato ativo encontrado para este inquilino.
              </section>
            )}

            {currentContract ? (
              <section className="surface-card p-4">
                <h2 className="text-lg font-semibold">Regras de atraso</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <Info
                    label="Multa"
                    value={`${(currentContract.fineRate * 100).toFixed(0)}%`}
                  />
                  <Info
                    label="Juros"
                    value={`${(currentContract.monthlyInterestRate * 100).toFixed(0)}% ao mes`}
                  />
                  <Info
                    label="Carencia"
                    value={`${currentContract.graceDays} dia(s)`}
                  />
                </dl>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function PaymentOption({
  label,
  note,
  state,
}: {
  label: string;
  note: string;
  state: string;
}) {
  return (
    <button className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 text-left hover:bg-[#DBEAFE] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
      <span className="font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-neutral-600 dark:text-slate-400">
        {note}
      </span>
      <span className="mt-3 block text-xs font-medium text-[#2563EB] dark:text-blue-300">
        {state}
      </span>
    </button>
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
