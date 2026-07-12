/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runMonthlyChargeSweep } from "../app/lib/charge-scheduler";
import { runReminderSweep } from "../app/lib/reminders";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Minimal shape of Cloudflare's scheduled (Cron Trigger) controller. */
interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  /**
   * Daily Cron Trigger (see wrangler.jsonc `triggers.crons`): generates the
   * current billing cycle's charge for every active/expiring contract once
   * it's within the lead window before the due date, then sends any
   * WhatsApp reminders (antes do vencimento / no dia / atraso) that are due
   * for that cycle via WAHA.
   */
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runMonthlyChargeSweep()
        .then((result) => {
          console.log(`[cron] cobrancas geradas: ${result.created}, ja existentes: ${result.skipped}`);
        })
        .catch((error) => {
          console.error("[cron] falha ao gerar cobrancas mensais:", error);
        })
        .then(() => runReminderSweep())
        .then((result) => {
          console.log(
            `[cron] lembretes whatsapp: enviados ${result.sent}, ignorados ${result.skipped}, falhas ${result.failed}`,
          );
        })
        .catch((error) => {
          console.error("[cron] falha ao rodar sweep de lembretes whatsapp:", error);
        }),
    );
  },
};

export default worker;
