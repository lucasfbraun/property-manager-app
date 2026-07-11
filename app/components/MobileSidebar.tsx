"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type MobileNavLink = {
  href: string;
  label: string;
  active?: boolean;
};

export function MobileSidebar({ links }: { links: MobileNavLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        aria-label="Abrir menu"
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true">☰</span>
        Menu
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            type="button"
          />
          <nav className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-[#0F172A] px-4 py-5 text-sm text-white shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-blue-200">
                Gestao de Alugueis
              </p>
              <button
                aria-label="Fechar menu"
                className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            {links.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  className={
                    link.active
                      ? "block rounded-md bg-[#2563EB] px-3 py-2 font-semibold text-white"
                      : "block rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
                  }
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  className={
                    link.active
                      ? "block rounded-md bg-[#2563EB] px-3 py-2 font-semibold text-white"
                      : "block rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
                  }
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
