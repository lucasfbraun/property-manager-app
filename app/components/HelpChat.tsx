"use client";

import { useRef, useState } from "react";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; related?: Array<{ id: string; title: string; answer: string }> };

const SUGGESTIONS = [
  "Como cadastrar um inquilino?",
  "Como conectar o Mercado Pago?",
  "Como fazer um rateio?",
];

/**
 * Admin-only help chat. Pure keyword search against a static FAQ
 * (app/lib/help-content.ts via /api/help/search) — no external AI, no
 * access to real app data. Never rendered on the tenant/receiver portals.
 */
export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Oi! Eu respondo duvidas sobre como usar o painel (cadastros, contratos, rateios, Mercado Pago...). Nao acesso dados de inquilinos, contratos ou pagamentos -- so o manual de ajuda.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ behavior: "smooth", top: listRef.current.scrollHeight });
    });
  }

  async function sendQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed || isSending) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsSending(true);
    scrollToBottom();

    try {
      const response = await fetch("/api/help/search", {
        body: JSON.stringify({ query: trimmed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        results?: Array<{ id: string; title: string; answer: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao buscar a resposta.");
      }

      const [top, ...rest] = result.results ?? [];
      if (!top) {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text:
              "Nao encontrei nada sobre isso no manual. Tente perguntar de outro jeito, por exemplo: " +
              SUGGESTIONS.map((item) => `"${item}"`).join(", ") +
              ".",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            related: rest,
            role: "bot",
            text: top.answer,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: error instanceof Error ? error.message : "Erro inesperado ao buscar a resposta.",
        },
      ]);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="flex h-[75vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0F172A]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-4 py-3 text-white dark:border-white/10">
            <div>
              <p className="text-sm font-semibold">Ajuda do painel</p>
              <p className="text-xs text-slate-300">Busca no manual, sem IA externa</p>
            </div>
            <button
              aria-label="Fechar ajuda"
              className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" ref={listRef}>
            {messages.map((message, index) => (
              <div
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                key={index}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-200"
                  }
                >
                  <p className="whitespace-pre-wrap leading-5">{message.text}</p>
                  {message.role === "bot" && message.related && message.related.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-white/10">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Tambem pode ajudar:
                      </p>
                      {message.related.map((item) => (
                        <button
                          className="block text-left text-xs font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
                          key={item.id}
                          onClick={() =>
                            setMessages((prev) => [...prev, { role: "bot", text: item.answer }])
                          }
                          type="button"
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {isSending ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Buscando...</p>
            ) : null}
          </div>

          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-200 px-3 py-2 dark:border-white/10">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  key={suggestion}
                  onClick={() => sendQuery(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="flex gap-2 border-t border-slate-200 p-3 dark:border-white/10"
            onSubmit={(event) => {
              event.preventDefault();
              void sendQuery(input);
            }}
          >
            <input
              className="input-field mt-0"
              disabled={isSending}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pergunte algo sobre o painel..."
              value={input}
            />
            <button className="btn-primary" disabled={isSending || !input.trim()} type="submit">
              Enviar
            </button>
          </form>
        </div>
      ) : (
        <button
          aria-label="Abrir ajuda"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-2xl font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
          onClick={() => setOpen(true)}
          type="button"
        >
          ?
        </button>
      )}
    </div>
  );
}
