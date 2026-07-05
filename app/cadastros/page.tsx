import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { CadastroWorkspace } from "./CadastroWorkspace";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  await requireUser(["admin"]);
  const data = await getRentalData();

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="surface-card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
              Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Cadastros operacionais
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Primeira versao para registrar imoveis, inquilinos, recebedores e
              contratos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="badge-soft">D1 local ativo</div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <CadastroWorkspace
          initialContracts={data.contracts}
          initialProperties={data.properties}
          initialReceivers={data.receivers}
          initialTenants={data.tenants}
        />
      </div>
    </main>
  );
}
