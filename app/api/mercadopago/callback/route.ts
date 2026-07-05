import {
  exchangeCodeForTokens,
  saveReceiverConnection,
  verifyConnectState,
} from "../../../lib/mercadopago";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

/**
 * Public OAuth callback (Mercado Pago redirects the receiver's browser here
 * after they approve the connection). Security comes from the signed
 * `state` param, not from a session cookie - the person completing this
 * step may not be logged into the admin panel at all.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    await ensureRentalDatabase();
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      throw new Error(`Mercado Pago retornou erro: ${errorParam}`);
    }
    if (!code || !state) {
      throw new Error("Parametros invalidos recebidos do Mercado Pago.");
    }

    const receiverId = await verifyConnectState(state);
    const token = await exchangeCodeForTokens(code, origin);
    await saveReceiverConnection(receiverId, token);

    return Response.redirect(`${origin}/cadastros?mpConnected=1`, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return Response.redirect(`${origin}/cadastros?mpError=${encodeURIComponent(message)}`, 302);
  }
}
