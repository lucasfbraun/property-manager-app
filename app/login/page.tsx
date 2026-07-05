"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0F172A]">Entrar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesse o painel de gestao de alugueis.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail</span>
            <input
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Senha</span>
            <input
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
