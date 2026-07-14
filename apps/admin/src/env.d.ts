/// <reference types="astro/client" />

// Minimal typing for the workerd virtual module. apps/web gets the full Env
// from `wrangler types` (worker-configuration.d.ts); admin declares only what
// it reads: the Hyperdrive binding, the WEB_APP_URL var, and the handoff
// secret (deployed path only — see src/pages/auth/handoff.ts).
declare module 'cloudflare:workers' {
  export const env: {
    HYPERDRIVE: { connectionString: string };
    WEB_APP_URL?: string;
    ADMIN_HANDOFF_SECRET?: string;
  };
}

declare namespace App {
  interface Locals {
    db: import('./db').AppDb;
    // The gated staff user (role === 'super'). Null only on the 403 path,
    // which short-circuits before any page renders.
    user: {
      id: string;
      email: string;
      role: string;
    } | null;
  }
}
