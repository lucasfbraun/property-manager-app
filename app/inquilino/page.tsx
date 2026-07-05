import Link from "next/link";
import { formatCurrency, formatDate, getTenantPortalData } from "../lib/rentals";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";

export const dynamic = "force-dynamic";

const statusTone = {
  Aberta: "bg-[#DBEAFE] text-[#2563EB] ring-blue-200",
  Vencida: "bg-rose-50 text-rose-700 ring-rose-200",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function TenantPortal() {
  const user = await requireUser(["tenant"]);

  if (!user.tenantId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-[#0F172A]">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            Sua conta ainda nao esta vinculada a um cadastro de inquilino.
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
  const portal = getTenantPortalData(user.tenantId, rentalData);
  const currentContract = portal.contracts[0];
  const openCharges = portal.charges.filter((charge) => charge.status !== "Paga");

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link className="text-sm font-semibold text-[#2563EB]" href="/">
                Voltar ao painel
              </Link>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Portal do inquilino
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {portal.tenant.name} - {portal.tenant.email}
              </p>
            </div>
            <LogoutButton />
          </div>
          <div className="mt-4 w-fit rounded-md bg-[#DBEAFE] px-4 py-2">
            <p className="text-xs font-semibold uppercase text-[#2563EB]">
              Status cadastral
            </p>
            <p className="mt-1 font-semibold">{portal.tenant.status}</p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Cobrancas em aberto
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Consulte o valor atualizado antes de pagar.
                  </p>
                </div>
                <button className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700">
                  Solicitar 2a via
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {openCharges.length > 0 ? (
                  openCharges.map((charge) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
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
                        <p className="mt-1 text-sm text-neutral-600">
                          Vencimento em {formatDate(charge.dueDate)}
                        </p>
                        {charge.daysLate > 0 ? (
                          <p className="mt-2 text-sm text-rose-700">
                            {charge.daysLate} dias em atraso, com multa e juros
                            aplicados.
                          </p>
                        ) : null}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs font-semibold uppercase text-neutral-500">
                          Valor atualizado
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {formatCurrency(charge.totalDue)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <PaymentOption
                        label="Pix"
                        note="Gerar copia e cola"
                        state="Disponivel no MVP"
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
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Nenhuma cobranca em aberto encontrada para este inquilino.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Historico</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#DBEAFE] text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Competencia</th>
                      <th className="px-3 py-3">Vencimento</th>
                      <th className="px-3 py-3">Metodo</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {portal.charges.map((charge) => (
                      <tr key={charge.id}>
                        <td className="px-3 py-3 font-medium">
                          {charge.reference}
                        </td>
                        <td className="px-3 py-3 text-neutral-600">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="px-3 py-3 text-neutral-600">
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
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold">Contrato atual</h2>
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
              </section>
            ) : (
              <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                Nenhum contrato ativo encontrado para este inquilino.
              </section>
            )}

            {currentContract ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
    <button className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3 text-left hover:bg-[#DBEAFE]">
      <span className="font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-neutral-600">{note}</span>
      <span className="mt-3 block text-xs font-medium text-[#2563EB]">
        {state}
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
