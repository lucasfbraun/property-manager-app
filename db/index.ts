import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type D1Binding = NonNullable<typeof env.DB>;

export function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Declare it under `d1_databases` in wrangler.jsonc (binding \"DB\") with a real database_id before using the database."
    );
  }

  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export type R2Binding = NonNullable<typeof env.SIGNED_CONTRACTS>;

export function getR2() {
  if (!env.SIGNED_CONTRACTS) {
    throw new Error(
      "Cloudflare R2 binding `SIGNED_CONTRACTS` is unavailable. Declare it under `r2_buckets` in wrangler.jsonc (binding \"SIGNED_CONTRACTS\") with a real bucket_name, and create the bucket in the Cloudflare dashboard before uploading signed contracts."
    );
  }

  return env.SIGNED_CONTRACTS;
}
