// Ambient Cloudflare Workers runtime types for the whole project.
//
// `@cloudflare/workers-types` ships global types (Fetcher, D1Database,
// R2Bucket, etc.) but its `cloudflare:workers` module (used via
// `import { env } from "cloudflare:workers"` in app/lib/*.ts and db/index.ts)
// exposes `env` typed as the empty `Cloudflare.Env` interface until a project
// augments it with its actual bindings. This mirrors what `wrangler types`
// would normally generate from wrangler.jsonc, so it doesn't need to be
// regenerated unless bindings change there.
/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    SIGNED_CONTRACTS: R2Bucket;
    property_manager_signed_contracts: R2Bucket;
    APP_BASE_URL: string;
    WAHA_BASE_URL: string;
    WAHA_SESSION: string;
  }
}
