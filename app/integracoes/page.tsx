import Link from "next/link";
import { whatsappAutomationConfig } from "../lib/integrations";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { HelpChat } from "../components/HelpChat";

export const dynamic = "force-dynamic";

const flowSteps = [
  "Cron Trigger da Cloudflare roda diariamente (mesmo mecanismo da cobranca mensal)",
  "Monolito identifica o evento de cobranca (antes/no/apos vencimento, pagamento confirmado)",
  "Monolito monta o texto da mensagem e o chatId",
  "Monolito chama o WAHA diretamente em POST /api/sendText",
  "WAHA envia a mensagem no WhatsApp",
  "Monolito registra sucesso ou falha do envio",
];

const reminderEvents = [
  ["before_due", "Lembrete antes do vencimento"],
  ["due_day", "Aviso no dia do vencimento"],
  ["after_due", "Aviso de atraso com juros e multa"],
  ["payment_confirmed", "Confirmacao de pagamento"],
  ["contract_expiring", "Contrato proximo do vencimento"],
];

export default async function IntegracoesPage() {
  await requireUser(["admin"]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="surface-card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
              Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Integracoes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              WhatsApp via WAHA (self-hosted na AWS): Cron Trigger da Cloudflare
              chama o WAHA diretamente, sem orquestrador no meio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              Envio real ativo (WAHA + Cron Trigger)
            </div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="surface-card p-4">
              <h2 className="font-semibold">WhatsApp: Cron Trigger + WAHA</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-400">
                A propria aplicacao decide quando enviar o lembrete, disparada
                por um Cron Trigger da Cloudflare (o mesmo mecanismo que ja
                gera a cobranca mensal), e chama o WAHA diretamente para
                entregar a mensagem no WhatsApp — sem orquestrador no meio.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoCard
                  label="Gatilho"
                  value="Cloudflare Cron Trigger"
                />
                <InfoCard
                  label="Gateway WhatsApp"
                  value={whatsappAutomationConfig.provider}
                />
                <InfoCard
                  label="Endpoint WAHA"
                  value={whatsappAutomationConfig.wahaSendTextEndpoint}
                />
                <InfoCard
                  label="Sessao padrao"
                  value={whatsappAutomationConfig.defaultSession}
                />
              </div>
            </section>

            <section className="surface-card p-4">
              <h2 className="mb-3 font-semibold">Fluxo de envio</h2>
              <ol className="grid gap-2">
                {flowSteps.map((step, index) => (
                  <li
                    className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5"
                    key={step}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="surface-card p-4">
              <h2 className="mb-3 font-semibold">Eventos da regua</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Evento</th>
                      <th className="px-3 py-3">Uso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                    {reminderEvents.map(([event, description]) => (
                      <tr key={event}>
                        <td className="px-3 py-3 font-mono text-xs font-semibold">
                          {event}
                        </td>
                        <td className="px-3 py-3 text-neutral-700 dark:text-slate-300">
                          {description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="surface-card p-4">
              <h2 className="font-semibold">Variaveis do monolito</h2>
              <EnvList
                items={[
                  whatsappAutomationConfig.wahaBaseUrlEnv,
                  whatsappAutomationConfig.wahaApiKeyEnv,
                  whatsappAutomationConfig.wahaSessionEnv,
                ]}
              />
            </section>

            <section className="surface-card p-4">
              <h2 className="font-semibold">Seguranca</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-slate-300">
                <li>Token do WAHA fica apenas no Worker, nunca exposto ao navegador.</li>
                <li>Envios devem ser idempotentes por cobranca e evento.</li>
                <li>Mensagens reais dependem de HTTPS em producao.</li>
                <li>Sem orquestrador externo: menos um ponto de falha e de segredo para gerenciar.</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
      <HelpChat />
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function EnvList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          className="rounded-md bg-[#0F172A] px-3 py-2 font-mono text-xs text-white dark:bg-black/40 dark:text-blue-200"
          key={item}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
