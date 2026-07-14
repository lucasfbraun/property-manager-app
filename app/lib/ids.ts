/**
 * Gera IDs de registro no formato `<prefixo>-<uuid>` usando
 * crypto.randomUUID() (livre de colisao, disponivel nativamente no runtime
 * dos Workers). Substitui o padrao antigo `Date.now() + Math.random()`,
 * que tinha risco (baixo, mas real) de colisao sob concorrencia.
 */
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
