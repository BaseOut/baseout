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
  // True under astro dev / wrangler dev (Vite-baked from
  // `import.meta.env.DEV` in middleware). Gates localhost CSRF origins so
  // they never ship to the deployed worker.
  dev: boolean
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
const DEV_TRUSTED_ORIGINS = ['http://localhost:*', 'http://127.0.0.1:*']

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
      database: {
        generateId: 'uuid',
      },
    },
  })
}
