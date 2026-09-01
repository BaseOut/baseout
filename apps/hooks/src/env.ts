// Worker bindings for apps/hooks (public Airtable webhook receiver).
// Secrets: DATABASE_URL (local dev), BASEOUT_ENCRYPTION_KEY (decrypts
// airtable_webhooks.mac_secret_base64_enc — MUST match the key the engine
// encrypts with). No service tokens: hooks talks to nothing but the master DB.

export interface Env {
  DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
  BASEOUT_ENCRYPTION_KEY?: string;
}
