"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        role?: "admin" | "tenant" | "receiver";
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel entrar.");
      }

      const destination =
        result.role === "tenant"
          ? "/inquilino"
          : result.role === "receiver"
            ? "/recebedor"
            : "/";

      // Use a full browser navigation instead of the client-side router.
      // The session cookie is set correctly by the server, but the soft
      // (client-side) navigation was not actually leaving /login in this
      // environment. A full reload always picks up the new session.
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] px-4 dark:bg-transparent">
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/4 translate-y-1/4 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="surface-card relative w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Gestao de Alugueis
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#0F172A] dark:text-slate-100">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Acesse o painel de gestao de alugueis.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              E-mail
            </span>
            <input
              autoComplete="username"
              className="input-field"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Senha
            </span>
            <input
              autoComplete="current-password"
              className="input-field"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <button className="btn-primary w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
