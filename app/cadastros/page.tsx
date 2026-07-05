import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { CadastroWorkspace } from "./CadastroWorkspace";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  await requireUser(["admin"]);
  const data = await getRentalData();

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-[#2563EB]" href="/">
              Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Cadastros operacionais
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Primeira versao para registrar imoveis, inquilinos, recebedores e
              contratos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-fit rounded-md bg-[#DBEAFE] px-3 py-2 text-sm font-semibold text-[#2563EB]">
              D1 local ativo
            </div>
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
