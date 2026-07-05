import Link from "next/link";
import { formatCurrency, formatDate, getReceiverPortalData } from "../lib/rentals";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";

export const dynamic = "force-dynamic";

const statusTone = {
  Aberta: "bg-[#DBEAFE] text-[#2563EB] ring-blue-200",
  Vencida: "bg-rose-50 text-rose-700 ring-rose-200",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function ReceiverPortal() {
  const user = await requireUser(["receiver"]);

  if (!user.receiverId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-[#0F172A]">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            Sua conta ainda nao esta vinculada a um cadastro de recebedor.
            Fale com o administrador.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </main>
    );
  }

  const rentalData = await getRentalData();
  const portal = getReceiverPortalData(user.receiverId, rentalData);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link className="text-sm font-semibold text-[#2563EB]" href="/">
                Voltar
              </Link>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Portal do recebedor
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {portal.receiver.name} - {portal.receiver.mpAccount}
              </p>
            </div>
            <LogoutButton />
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
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4">
              <h2 className="font-semibold">Cobrancas dos seus imoveis</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cobrancas geradas para os contratos vinculados a voce.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Inquilino</th>
                    <th className="px-4 py-3">Imovel</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {portal.charges.map((charge) => (
                    <tr className="hover:bg-slate-50" key={charge.id}>
                      <td className="px-4 py-3 font-medium">{charge.tenant.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {charge.property.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
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
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                        Nenhuma cobranca encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Contratos vinculados</h2>
              <div className="mt-3 space-y-3">
                {portal.contracts.map((contract) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    key={contract.id}
                  >
                    <p className="font-semibold">{contract.property.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {contract.tenant.name} - vencimento dia {contract.dueDay}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {formatCurrency(contract.monthlyRent)}
                    </p>
                  </div>
                ))}
                {portal.contracts.length === 0 ? (
                  <p className="text-sm text-slate-500">
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
    amber: "border-amber-200 bg-amber-50",
    green: "border-emerald-200 bg-emerald-50",
    neutral: "border-slate-200 bg-white",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
