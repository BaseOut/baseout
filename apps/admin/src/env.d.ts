/// <reference types="astro/client" />

// Minimal typing for the workerd virtual module. apps/web gets the full Env
// from `wrangler types` (worker-configuration.d.ts); the admin slice only
// reads the Hyperdrive binding on the deployed path, so we declare just that.
declare module 'cloudflare:workers' {
  export const env: {
    HYPERDRIVE: { connectionString: string };
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
