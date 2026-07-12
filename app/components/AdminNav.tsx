import Link from "next/link";
import type { MobileNavLink } from "./MobileSidebar";

/**
 * Shared admin navigation (desktop sidebar + mobile drawer), used by every
 * admin-only page (dashboard, cadastros, contratos, rateios, integracoes) so
 * the menu is reachable from anywhere, not just the dashboard. Mirrors the
 * original dashboard-only nav in app/page.tsx exactly (same labels/order),
 * which is left untouched since it already works.
 */
export type AdminNavKey = "dashboard" | "cadastros" | "contratos" | "rateios" | "integracoes";

type AdminNavItem = {
  key: AdminNavKey | "dashboard-section" | "portal";
  href: string;
  label: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/", key: "dashboard", label: "Dashboard" },
  { href: "/#cobrancas", key: "dashboard-section", label: "Cobrancas" },
  { href: "/#contratos", key: "dashboard-section", label: "Contratos" },
  { href: "/#inquilinos", key: "dashboard-section", label: "Inquilinos" },
  { href: "/cadastros", key: "cadastros", label: "Cadastros" },
  { href: "/contratos", key: "contratos", label: "Contratos e assinaturas" },
  { href: "/rateios", key: "rateios", label: "Rateios" },
  { href: "/integracoes", key: "integracoes", label: "Integracoes" },
  { href: "/inquilino", key: "portal", label: "Portal do inquilino" },
];

/** Same link list, shaped for the mobile drawer (app/components/MobileSidebar.tsx). */
export function getAdminNavLinks(active: AdminNavKey): MobileNavLink[] {
  return ADMIN_NAV_ITEMS.map((item) => ({
    active: item.key === active,
    href: item.href,
    label: item.label,
  }));
}

/** Desktop sidebar (hidden below `lg:`), reachable from every admin page. */
export function AdminSidebar({ active }: { active: AdminNavKey }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-[#0F172A] px-4 py-5 text-white dark:border-white/10 dark:bg-slate-950/40 dark:backdrop-blur-xl lg:block">
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
        {ADMIN_NAV_ITEMS.map((item) => (
          <AdminNavItem active={item.key === active} href={item.href} key={item.href} label={item.label} />
        ))}
      </nav>

      <div className="mt-6 rounded-lg border border-blue-400/30 bg-blue-500/10 p-4">
        <p className="text-sm font-semibold text-blue-100">WhatsApp</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          WAHA via Cron Trigger definido para a regua de cobranca.
        </p>
      </div>
    </aside>
  );
}

function AdminNavItem({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  const className = active
    ? "block rounded-md bg-[#2563EB] px-3 py-2 font-semibold text-white"
    : "block rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white";

  return (
    <Link className={className} href={href}>
      {label}
    </Link>
  );
}
