import Link from "next/link";
import { getRentalData } from "../lib/rental-repository";
import {
  CONTRACT_TEMPLATE_VARIABLES,
  listContractTemplates,
} from "../lib/contract-documents";
import { requireUser } from "../lib/session";
import { LogoutButton } from "../components/LogoutButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { ContractsWorkspace } from "./ContractsWorkspace";
import { HelpChat } from "../components/HelpChat";
import { AdminSidebar, getAdminNavLinks } from "../components/AdminNav";
import { MobileSidebar } from "../components/MobileSidebar";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const user = await requireUser(["admin"]);
  const rentalData = await getRentalData();
  const templates = await listContractTemplates();

  const contractRows = rentalData.contracts.map((contract) => {
    const tenant = rentalData.tenants.find((item) => item.id === contract.tenantId);
    const property = rentalData.properties.find((item) => item.id === contract.propertyId);
    return {
      id: contract.id,
      propertyName: property?.name ?? "-",
      reviewNote: contract.reviewNote,
      signatureStatus: contract.signatureStatus,
      signedFileName: contract.signedFileName,
      signedUploadedAt: contract.signedUploadedAt,
      templateId: contract.templateId,
      tenantName: tenant?.name ?? "-",
    };
  });

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-transparent dark:text-slate-100">
      <div className="flex min-h-screen">
        <AdminSidebar active="contratos" />

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Gestao de Alugueis
            </span>
            <MobileSidebar links={getAdminNavLinks("contratos")} />
          </div>

          <div className="mx-auto max-w-6xl">
            <header className="surface-card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link className="text-sm font-semibold text-[#2563EB] dark:text-blue-400" href="/">
                  Voltar ao painel
                </Link>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                  Contratos e assinaturas
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Cadastre modelos de contrato, gere o documento de cada contrato e
                  aprove os arquivos assinados enviados pelos inquilinos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-400">
                  {user.name}
                </span>
                <ThemeToggle />
                <LogoutButton />
              </div>
            </header>

            <ContractsWorkspace
              initialContracts={contractRows}
              initialTemplates={templates}
              variables={CONTRACT_TEMPLATE_VARIABLES}
            />
          </div>
        </section>
      </div>
      <HelpChat />
    </main>
  );
}
