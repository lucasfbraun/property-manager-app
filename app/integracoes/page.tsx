import Link from "next/link";
import { whatsappAutomationConfig } from "../lib/integrations";

const flowSteps = [
  "Monolito identifica evento de cobranca",
  "Monolito envia payload para Webhook n8n",
  "n8n valida segredo do evento",
  "n8n monta texto e chatId",
  "n8n chama WAHA /api/sendText",
  "WAHA envia mensagem no WhatsApp",
  "n8n registra sucesso ou falha",
];

const reminderEvents = [
  ["before_due", "Lembrete antes do vencimento"],
  ["due_day", "Aviso no dia do vencimento"],
  ["after_due", "Aviso de atraso com juros e multa"],
  ["payment_confirmed", "Confirmacao de pagamento"],
  ["contract_expiring", "Contrato proximo do vencimento"],
];

export default function IntegracoesPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <Link className="text-sm font-semibold text-[#2563EB]" href="/">
              Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Integracoes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Configuracao planejada para WhatsApp usando n8n e WAHA.
            </p>
          </div>
          <div className="mt-4 w-fit rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            Implementacao real pendente de credenciais
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">WhatsApp: n8n + WAHA</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                A aplicacao monolitica decide quando enviar o lembrete. O n8n
                orquestra a automacao e chama o WAHA para entregar a mensagem no
                WhatsApp.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoCard
                  label="Orquestrador"
                  value={whatsappAutomationConfig.orchestrator}
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

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Fluxo de envio</h2>
              <ol className="grid gap-2">
                {flowSteps.map((step, index) => (
                  <li
                    className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
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

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Eventos da regua</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Evento</th>
                      <th className="px-3 py-3">Uso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {reminderEvents.map(([event, description]) => (
                      <tr key={event}>
                        <td className="px-3 py-3 font-mono text-xs font-semibold">
                          {event}
                        </td>
                        <td className="px-3 py-3 text-neutral-700">
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
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Variaveis do monolito</h2>
              <EnvList
                items={[
                  whatsappAutomationConfig.n8nWebhookEnv,
                  whatsappAutomationConfig.n8nWebhookSecretEnv,
                ]}
              />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Variaveis no n8n</h2>
              <EnvList
                items={[
                  whatsappAutomationConfig.wahaBaseUrlEnv,
                  whatsappAutomationConfig.wahaApiKeyEnv,
                  whatsappAutomationConfig.wahaSessionEnv,
                ]}
              />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Seguranca</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>Webhook do n8n deve validar segredo.</li>
                <li>Token do WAHA fica apenas no n8n.</li>
                <li>Envios devem ser idempotentes por cobranca e evento.</li>
                <li>Mensagens reais dependem de HTTPS em producao.</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function EnvList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          className="rounded-md bg-[#0F172A] px-3 py-2 font-mono text-xs text-white"
          key={item}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
