import { env } from "cloudflare:workers";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends a transactional e-mail via the Resend API (plain fetch, no SDK, so
 * it works natively in the Cloudflare Workers runtime).
 *
 * Requires two Cloudflare secrets/vars to actually send anything:
 * - RESEND_API_KEY: API key from https://resend.com
 * - RESEND_FROM_EMAIL (optional): e.g. "Gestao de Alugueis <contratos@seudominio.com.br>".
 *   Falls back to Resend's shared test sender if not set (only deliverable
 *   to the Resend account owner's own e-mail until a domain is verified).
 *
 * When RESEND_API_KEY is not configured yet, this silently logs and returns
 * instead of throwing, so the rest of the flow (upload/approval) still
 * works while e-mail delivery is pending setup.
 */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = (env as Record<string, unknown>).RESEND_API_KEY as
    | string
    | undefined;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY nao configurada; e-mail nao enviado (assunto: "${input.subject}").`,
    );
    return;
  }

  const from =
    ((env as Record<string, unknown>).RESEND_FROM_EMAIL as string | undefined) ??
    "Gestao de Alugueis <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `[email] Falha ao enviar via Resend (${response.status}): ${text}`,
      );
    }
  } catch (error) {
    console.error("[email] Erro inesperado ao enviar e-mail:", error);
  }
}
