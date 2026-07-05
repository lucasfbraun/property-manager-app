import Link from "next/link";
import { formatCurrency, formatDate, getDashboardData } from "./lib/rentals";
import { getRentalData } from "./lib/rental-repository";

const statusTone = {
  Aberta: "bg-[#DBEAFE] text-[#1D4ED8] ring-blue-200",
  Vencida: "bg-rose-50 text-rose-700 ring-rose-200",
  Paga: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default async function Home() {
  const rentalData = await getRentalData();
  const dashboard = getDashboardData(rentalData);
  const overdueCount = dashboard.projections.filter(
    (charge) => charge.status === "Vencida",
  ).length;
  const openCount = dashboard.projections.filter(
    (charge) => charge.status !== "Paga",
  ).length;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-200 bg-[#0F172A] px-4 py-5 text-white lg:block">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase text-blue-200">
              Controle patrimonial
            </p>
            <h1 className="mt-2 text-xl font-semibold">Gestao de Alugueis</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Recebimentos, contratos e lembretes em um monolito operacional.
            </p>
          </div>

          <nav className="mt-6 space-y-1 text-sm">
            <NavItem active href="#dashboard" label="Dashboard" />
            <NavItem href="#cobrancas" label="Cobrancas" />
            <NavItem href="#contratos" label="Contratos" />
            <NavItem href="#inquilinos" label="Inquilinos" />
            <NavItem href="/cadastros" label="Cadastros" />
            <NavItem href="/integracoes" label="Integracoes" />
            <NavItem href="/inquilino" label="Portal do inquilino" />
          </nav>

          <div className="mt-6 rounded-lg border border-blue-400/30 bg-blue-500/10 p-4">
            <p className="text-sm font-semibold text-blue-100">WhatsApp</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              WAHA + n8n definidos para a regua de cobranca.
            </p>
          </div>
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#2563EB]">
                    Junho de 2026
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                    MVP em desenvolvimento
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                  Controle de recebimentos
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Acompanhe cobrancas, repasses por recebedor e contratos ativos
                  com os dados persistidos no D1 local.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  className="rounded-md bg-[#2563EB] px-4 py-2.5 font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                  href="/cadastros"
                >
                  Novo cadastro
                </Link>
                <Link
                  className="rounded-md border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-[#DBEAFE]"
                  href="/inquilino"
                >
                  Ver portal
                </Link>
              </div>
            </div>
          </header>

          <section
            className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
            id="dashboard"
          >
            <Metric
              label="Previsto"
              value={formatCurrency(dashboard.totals.expected)}
            />
            <Metric
              label="Recebido"
              tone="green"
              value={formatCurrency(dashboard.totals.received)}
            />
            <Metric
              label="Em aberto"
              meta={`${openCount} cobranca(s)`}
              tone="amber"
              value={formatCurrency(dashboard.totals.open)}
            />
            <Metric
              label="Em atraso"
              meta={`${overdueCount} vencida(s)`}
              tone="red"
              value={formatCurrency(dashboard.totals.overdue)}
            />
            <Metric label="Contratos" value={String(dashboard.totals.contracts)} />
            <Metric
              label="Inadimplentes"
              tone="red"
              value={String(dashboard.totals.tenantsWithDelay)}
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
            <div
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              id="cobrancas"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold">Cobrancas do periodo</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Valores atualizados com juros quando houver atraso.
                  </p>
                </div>
                <span className="w-fit rounded-md bg-[#DBEAFE] px-3 py-2 text-sm font-semibold text-[#2563EB]">
                  {overdueCount} em atraso
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Inquilino</th>
                      <th className="px-4 py-3">Imovel</th>
                      <th className="px-4 py-3">Recebedor</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-right">Atualizado</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.projections.map((charge) => (
                      <tr className="hover:bg-slate-50" key={charge.id}>
                        <td className="px-4 py-3 font-semibold">
                          {charge.tenant.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {charge.property.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {charge.receiver.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(
                            charge.status === "Paga"
                              ? charge.amount
                              : charge.totalDue,
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
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              <Panel title="Recebimentos por recebedor">
                <div className="space-y-3">
                  {dashboard.byReceiver.map((item) => (
                    <div
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      key={item.receiver.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.receiver.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.receiver.mpAccount}
                          </p>
                        </div>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#2563EB]">
                          ativo
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <SmallStat
                          label="Previsto"
                          value={formatCurrency(item.expected)}
                        />
                        <SmallStat
                          label="Recebido"
                          value={formatCurrency(item.received)}
                        />
                        <SmallStat
                          label="Aberto"
                          value={formatCurrency(item.open)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Proximas decisoes">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>Definir modelo Mercado Pago por recebedor.</li>
                  <li>Configurar credenciais WAHA e n8n.</li>
                  <li>Validar regra padrao de multa e juros.</li>
                </ul>
              </Panel>

              <Panel title="WhatsApp">
                <p className="text-sm leading-6 text-slate-700">
                  Decisao registrada: usar n8n como orquestrador e WAHA como
                  gateway de envio das mensagens.
                </p>
                <Link
                  className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-[#DBEAFE]"
                  href="/integracoes"
                >
                  Ver integracao
                </Link>
              </Panel>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <Panel id="contratos" title="Contratos ativos">
              <div className="divide-y divide-slate-100">
                {rentalData.contracts.map((contract) => {
                  const tenant = rentalData.tenants.find(
                    (item) => item.id === contract.tenantId,
                  );
                  const property = rentalData.properties.find(
                    (item) => item.id === contract.propertyId,
                  );
                  return (
                    <div className="py-3 first:pt-0 last:pb-0" key={contract.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{property?.name}</p>
                          <p className="text-sm text-slate-500">
                            {tenant?.name} - vencimento dia {contract.dueDay}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatCurrency(contract.monthlyRent)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel id="inquilinos" title="Inquilinos">
              <div className="grid gap-3 sm:grid-cols-3">
                {rentalData.tenants.map((tenant) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    key={tenant.id}
                  >
                    <p className="font-semibold">{tenant.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tenant.whatsapp}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-700">
                      {tenant.status}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function NavItem({
  active = false,
  href,
  label,
}: {
  active?: boolean;
  href: string;
  label: string;
}) {
  const className = active
    ? "block rounded-md bg-[#2563EB] px-3 py-2 font-semibold text-white"
    : "block rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white";

  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href}>
        {label}
      </Link>
    );
  }

  return (
    <a className={className} href={href}>
      {label}
    </a>
  );
}

function Metric({
  label,
  meta,
  value,
  tone = "neutral",
}: {
  label: string;
  meta?: string;
  value: string;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-rose-200 bg-rose-50",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}

function Panel({
  children,
  id,
  title,
}: {
  children: React.ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      id={id}
    >
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
