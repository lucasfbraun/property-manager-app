import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import { listRateios, getResidentInfoForProperties } from "../lib/rateios";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { RateioWorkspace } from "./RateioWorkspace";
import { HelpChat } from "../components/HelpChat";

export const dynamic = "force-dynamic";

export default async function RateiosPage() {
  await requireUser(["admin"]);
  const [rentalData, rateios] = await Promise.all([getRentalData(), listRateios()]);
  const residentInfo = await getResidentInfoForProperties(
    rentalData.properties.map((property) => property.id),
  );
  const propertiesWithResidents = rentalData.properties.map((property) => ({
    ...property,
    residentCount: residentInfo.get(property.id)?.residentCount ?? null,
    tenantName: residentInfo.get(property.id)?.tenantName ?? null,
  }));

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="surface-card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
              Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Rateios
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Divida qualquer despesa compartilhada entre imoveis (agua,
              condominio, gas, internet, ou qualquer outra) — escolha a
              categoria, informe o valor do mes, quais imoveis participam e o
              valor e somado automaticamente na cobranca do inquilino de cada
              imovel selecionado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <RateioWorkspace
          initialProperties={propertiesWithResidents}
          initialRateios={rateios}
        />
      </div>
      <HelpChat />
    </main>
  );
}
