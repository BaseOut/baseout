import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { renderMagicLinkEmail } from './email/templates/magic-link'
import { sendEmail, type SendEmailEnv } from './email/send'
import { isLocalDevHost } from './oauth/local-dev-secure'

type DrizzleDb = Parameters<typeof drizzleAdapter>[0]

export interface AuthFactoryEnv extends SendEmailEnv {
  secret: string | undefined
  // Explicit base URL for magic-link generation. When set (e.g. via
  // wrangler `vars.PUBLIC_AUTH_BASE_URL`), Better Auth uses it verbatim
  // and skips Host-header inference. Required under `wrangler dev --remote`,
  // where the edge worker's Host header isn't a loopback address.
  baseUrl?: string
  // True under astro dev / wrangler dev (Vite-baked from
  // `import.meta.env.DEV` in middleware). Gates localhost CSRF origins so
  // they never ship to the deployed worker.
  dev: boolean
}

// Hosts the per-request `baseURL` resolver accepts. Better Auth's
// `matchesHostPattern` does an exact case-insensitive match unless the
// pattern contains `*`, so the wildcard variants below cover any local
// dev port. `localhost` / `127.0.0.1` are intentionally unlisted — the
// canonical local URL is `https://baseout.local:4331` (see
// shared/internal/oauth-setup.md §5.5); requests arriving with a
// loopback Host header fall through to `fallback` and fail loudly.
const AUTH_BASE_URL = {
  allowedHosts: [
    'baseout.local',
    'baseout.local:*',
    'baseout.dev',
  ],
  fallback: 'https://baseout.dev',
}

// Origins accepted by Better Auth's CSRF gate. `allowedHosts` above
// governs Host-header → baseURL resolution; `trustedOrigins` governs the
// Origin/Referer check on POSTs. Better Auth's auto-derivation between
// the two is unreliable, so declare the CSRF list explicitly here. When
// adding a new deployed origin, update both. `localhost` is intentionally
// absent — see the comment on `allowedHosts` above.
const PROD_TRUSTED_ORIGINS = ['https://baseout.dev']
// `http://baseout.local:*` covers the admin console (apps/admin) which runs
// over http in local dev (its session cookie is non-Secure locally). Trusting
// it lets a magic-link callbackURL round-trip staff back to the admin origin
// after sign-in. Dev-only; the prod admin origin (admin.baseout.com) joins
// PROD_TRUSTED_ORIGINS when that app is first deployed.
const DEV_TRUSTED_ORIGINS = ['https://baseout.local:*', 'http://baseout.local:*']

// Drop the `Secure` attribute + `__Secure-` cookie prefix in local dev only.
//
// better-auth defaults `Secure: true` + `__Secure-` whenever baseURL is
// https://. The dev script serves at https://baseout.local:4331 with
// wrangler's localhost-only self-signed cert; Chromium-family browsers treat
// `localhost` as a secure context even with a bad cert but NOT other
// hostnames, so Secure cookies set under `baseout.local` get dropped between
// page loads and login silently fails on refresh. Deriving the decision from
// the resolved baseURL hostname (the single runtime source, independent of
// the Vite-baked `import.meta.env.DEV` flag) keeps this in lockstep with the
// handoff-cookie helper in oauth/local-dev-secure.ts. Returns undefined for
// deployed/prod hosts so better-auth keeps its Secure default there.
// Exported for /api/internal/test/auth-config, which reports the resolved
// cookie mode so session-cookie drift is probeable without a browser.
export function resolveUseSecureCookies(baseUrl: string | undefined): false | undefined {
  if (!baseUrl) return undefined
  try {
    return isLocalDevHost(new URL(baseUrl).hostname) ? false : undefined
  } catch {
    return undefined
  }
}

export function createAuth(db: DrizzleDb, env: AuthFactoryEnv) {
  return betterAuth({
    secret: env.secret,
    baseURL: env.baseUrl ?? AUTH_BASE_URL,
    trustedOrigins: env.dev
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
      useSecureCookies: resolveUseSecureCookies(env.baseUrl),
      database: {
        generateId: 'uuid',
      },
    },
  })
}
