// Secret bindings live in `.dev.vars` (never `wrangler.jsonc`), so `wrangler types`
// cannot emit them onto the generated `Cloudflare.Env`. Code that reads them via
// `import { env } from "cloudflare:workers"` (typed `Cloudflare.Env`) — e.g. the
// engine service binding and the AI BYOK credential path — would therefore fail
// `astro check` in a fresh clone / CI even though they resolve fine at runtime.
//
// Declaring the secret keys here (as `string`) via declaration-merging keeps
// `astro check` honest without requiring real secret values. Keys mirror
// `.dev.vars.example`; keep the two in sync when a secret is added or removed.
declare namespace Cloudflare {
  interface Env {
    SERVER_INTERNAL_TOKEN: string;
    BETTER_AUTH_SECRET: string;
    BASEOUT_ENCRYPTION_KEY: string;
    AIRTABLE_OAUTH_CLIENT_ID: string;
    AIRTABLE_OAUTH_CLIENT_SECRET: string;
    AIRTABLE_LOGIN_OAUTH_CLIENT_ID: string;
    AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET: string;
    GOOGLE_DRIVE_OAUTH_CLIENT_ID: string;
    GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: string;
    BOX_OAUTH_CLIENT_ID: string;
    BOX_OAUTH_CLIENT_SECRET: string;
    DROPBOX_OAUTH_CLIENT_ID: string;
    DROPBOX_OAUTH_CLIENT_SECRET: string;
    MICROSOFT_OAUTH_CLIENT_ID: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_TRIAL_PRICE_ID: string;
    ADMIN_HANDOFF_SECRET: string;
  }
}
