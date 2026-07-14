// Helpers compartilhados pelas rotas de API (app/api/**/route.ts). Antes
// cada rota carregava a propria copia destas funcoes; manter tudo aqui evita
// divergencia silenciosa entre elas.
import { UnauthorizedError } from "./session";

/** Mensagem de erro segura para devolver ao cliente em JSON. */
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

/** 401 para falhas de autenticacao/autorizacao, 400 para erros de validacao. */
export function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

/** String obrigatoria do payload; lanca erro de validacao quando ausente/vazia. */
export function requiredString(value: unknown, field: string) {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

/** String opcional do payload, normalizada com trim ("" quando ausente). */
export function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Escapa conteudo dinamico interpolado em HTML de e-mails/notificacoes. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
