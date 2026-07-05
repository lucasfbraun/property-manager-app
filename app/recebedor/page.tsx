import Link from "next/link";
import { formatCurrency, formatDate, getReceiverPortalData } from "../lib/rentals";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";

export const dynamic = "force-dynamic";

const statusTone = {
  Aberta: "bg-[#DBEAFE] text-[#2563EB] ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  Vencida: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
};

export default async function ReceiverPortal() {
  const user = await requireUser(["receiver"]);

  if (!user.receiverId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-[#0F172A] dark:bg-transparent dark:text-slate-100">
        <div className="surface-card w-full max-w-md p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sua conta ainda nao esta vinculada a um cadastro de recebedor.
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
  const portal = getReceiverPortalData(user.receiverId, rentalData);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="surface-card mb-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
                Voltar
              </Link>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Portal do recebedor
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {portal.receiver.name} - {portal.receiver.mpAccount}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Previsto" value={formatCurrency(portal.totals.expected)} />
          <Metric
            label="Recebido"
            tone="green"
            value={formatCurrency(portal.totals.received)}
          />
          <Metric label="Em aberto" tone="amber" value={formatCurrency(portal.totals.open)} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="surface-card">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10">
              <h2 className="font-semibold">Cobrancas dos seus imoveis</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Cobrancas geradas para os contratos vinculados a voce.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Inquilino</th>
                    <th className="px-4 py-3">Imovel</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {portal.charges.map((charge) => (
                    <tr
                      className="hover:bg-slate-50 dark:hover:bg-white/5"
                      key={charge.id}
                    >
                      <td className="px-4 py-3 font-medium">{charge.tenant.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {charge.property.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(charge.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(
                          charge.status === "Paga" ? charge.amount : charge.totalDue,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[charge.status]}`}
                        >
                          {charge.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {portal.charges.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                        colSpan={5}
                      >
                        Nenhuma cobranca encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="surface-card p-4">
              <h2 className="font-semibold">Contratos vinculados</h2>
              <div className="mt-3 space-y-3">
                {portal.contracts.map((contract) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                    key={contract.id}
                  >
                    <p className="font-semibold">{contract.property.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {contract.tenant.name} - vencimento dia {contract.dueDay}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {formatCurrency(contract.monthlyRent)}
                    </p>
                  </div>
                ))}
                {portal.contracts.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Nenhum contrato vinculado ainda.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "amber";
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10",
    green: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    neutral: "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/60",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm transition-colors dark:shadow-none ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
