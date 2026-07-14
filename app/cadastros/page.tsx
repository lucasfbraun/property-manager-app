import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import { listAdminUsers } from "../lib/auth-repository";
import { requireUser } from "../lib/session";
import { AdminsSection } from "./AdminsSection";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { CadastroWorkspace } from "./CadastroWorkspace";
import { HelpChat } from "../components/HelpChat";
import { AdminSidebar, getAdminNavLinks } from "../components/AdminNav";
import { MobileSidebar } from "../components/MobileSidebar";

export const dynamic = "force-dynamic";

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ mpConnected?: string; mpError?: string }>;
}) {
  const user = await requireUser(["admin"]);
  const data = await getRentalData();
  const admins = await listAdminUsers();
  const { mpConnected, mpError } = await searchParams;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-transparent dark:text-slate-100">
      <div className="flex min-h-screen">
        <AdminSidebar active="cadastros" />

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-slate-200 bg-[#F8FAFC] px-4 py-3 dark:border-white/10 dark:bg-[#0b1220] sm:-mx-6 sm:px-6 lg:hidden">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Gestao de Alugueis
            </span>
            <MobileSidebar links={getAdminNavLinks("cadastros")} />
          </div>

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

            {mpConnected ? (
              <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                Conta do Mercado Pago conectada com sucesso.
              </div>
            ) : null}
            {mpError ? (
              <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                Falha ao conectar o Mercado Pago: {mpError}
              </div>
            ) : null}

            <CadastroWorkspace
              initialCharges={data.charges}
              initialContracts={data.contracts}
              initialContractWitnesses={data.contractWitnesses}
              initialOwners={data.owners}
              initialProperties={data.properties}
              initialReceivers={data.receivers}
              initialTenants={data.tenants}
            />

            <div className="mt-8">
              <AdminsSection currentUserId={user.id} initialAdmins={admins} />
            </div>
          </div>
        </section>
      </div>
      <HelpChat />
    </main>
  );
}
