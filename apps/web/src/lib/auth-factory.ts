import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { renderMagicLinkEmail } from './email/templates/magic-link'
import { sendEmail, type SendEmailEnv } from './email/send'

type DrizzleDb = Parameters<typeof drizzleAdapter>[0]

export interface AuthFactoryEnv extends SendEmailEnv {
  secret: string | undefined
  // Explicit base URL for magic-link generation. When set (e.g. via
  // wrangler `vars.PUBLIC_AUTH_BASE_URL`), Better Auth uses it verbatim
  // and skips Host-header inference. Required under `wrangler dev --remote`,
  // where the edge worker's Host header isn't a loopback address.
  baseUrl?: string
  // Inherited from SendEmailEnv. True ONLY under `astro dev` (Vite-baked
  // `import.meta.env.DEV`). Gates sendEmail()'s console-log fallback — keep
  // it OFF for `wrangler dev --remote` so magic-link emails actually leave
  // via the EMAIL binding. Use `widenLocalDevOrigins` (below) to widen the
  // CSRF list for local dev without re-enabling the console-log path.
  dev: boolean
  // True under either local dev runtime (astro dev OR wrangler dev --remote).
  // Independently gates DEV_TRUSTED_ORIGINS so localhost / 127.0.0.1 /
  // baseout.local origins are accepted by the CSRF check in local dev,
  // without flipping the `dev` email-mode flag. Production keeps both off.
  widenLocalDevOrigins: boolean
}

// Hosts the per-request `baseURL` resolver accepts. Better Auth's
// `matchesHostPattern` does an exact case-insensitive match unless the
// pattern contains `*`, so the wildcard variants below cover any local
// dev port (`npm run dev` → 4331, `wrangler dev` → 8787, etc.) and both
// `localhost` and `127.0.0.1` Host headers without widening the
// production surface — non-loopback hosts still hit `fallback`.
const AUTH_BASE_URL = {
  allowedHosts: [
    'localhost',
    'localhost:*',
    '127.0.0.1',
    '127.0.0.1:*',
    'baseout.dev',
  ],
  fallback: 'https://baseout.dev',
}

// Origins accepted by Better Auth's CSRF gate. `allowedHosts` above
// governs Host-header → baseURL resolution; `trustedOrigins` governs the
// Origin/Referer check on POSTs. Better Auth's auto-derivation between
// the two is unreliable, so declare the CSRF list explicitly here. When
// adding a new deployed origin, update both.
const PROD_TRUSTED_ORIGINS = ['https://baseout.dev']
// Dev origins span http (port 4331 via plain `wrangler` script) and https
// (port 4331 via the default `dev` script with `--local-protocol https`).
// baseout.local:* is included because the dev script's --var pins
// PUBLIC_AUTH_BASE_URL to https://baseout.local:4331 (per oauth-setup.md §3.1
// and commit 67d6338) and we want the magic-link POST to be accepted whether
// the developer is browsing at localhost or baseout.local. None of these
// origins are routable in production — they only widen the CSRF gate when
// `env.dev` is true.
const DEV_TRUSTED_ORIGINS = [
  'http://localhost:*',
  'https://localhost:*',
  'http://127.0.0.1:*',
  'https://127.0.0.1:*',
  'https://baseout.local:*',
]

export function createAuth(db: DrizzleDb, env: AuthFactoryEnv) {
  return betterAuth({
    secret: env.secret,
    baseURL: env.baseUrl ?? AUTH_BASE_URL,
    trustedOrigins: env.widenLocalDevOrigins
      ? [...PROD_TRUSTED_ORIGINS, ...DEV_TRUSTED_ORIGINS]
      : PROD_TRUSTED_ORIGINS,
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
    }),
    user: {
      additionalFields: {
        termsAcceptedAt: {
          type: 'date',
          required: false,
          input: false,
        },
        firstName: {
          type: 'string',
          required: false,
          input: false,
        },
        lastName: {
          type: 'string',
          required: false,
          input: false,
        },
        jobTitle: {
          type: 'string',
          required: false,
          input: false,
        },
        marketingOptInAt: {
          type: 'date',
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const rendered = renderMagicLinkEmail({ email, url })
          await sendEmail({ to: email, ...rendered }, env)
        },
      }),
    ],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      database: {
        generateId: 'uuid',
      },
      // Drop Secure + `__Secure-` cookie prefix in local dev only.
      //
      // Why: wrangler dev's auto-generated TLS cert is for `localhost`, but
      // the dev script serves at `https://baseout.local:4331` (Airtable's
      // only registered redirect URI). Chromium-family browsers (Brave, etc.)
      // treat `localhost` as a Secure context even with a self-signed cert,
      // but any other hostname with a cert error is NOT — so cookies with
      // the Secure attribute set under `baseout.local` get dropped between
      // page loads. better-auth defaults `Secure: true` + `__Secure-` prefix
      // whenever baseURL starts with `https://`; this opt-out flips both off
      // when widenLocalDevOrigins is true. Production envs keep the default
      // (undefined → auto-derive from https baseURL → Secure cookies).
      useSecureCookies: env.widenLocalDevOrigins ? false : undefined,
    },
  })
}
