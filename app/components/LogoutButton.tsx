"use client";

import { useState } from "react";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full navigation, same reasoning as the login page: client-side
      // router transitions were not reliably leaving the current page in
      // this environment.
      window.location.assign("/login");
    }
  }

  return (
    <button
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
      disabled={isLoading}
      onClick={handleLogout}
      type="button"
    >
      {isLoading ? "Saindo..." : "Sair"}
    </button>
  );
}
