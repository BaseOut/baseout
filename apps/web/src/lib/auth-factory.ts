import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth, magicLink, twoFactor } from 'better-auth/plugins'
import {
  buildAirtableSsoProvider,
  isAirtableSsoConfigured,
} from './airtable/sso'
import { resolveAirtableUrls } from './airtable/config'
import { renderMagicLinkEmail } from './email/templates/magic-link'
import { sendEmail, type SendEmailEnv } from './email/send'
import { isLocalDevHost } from './oauth/local-dev-secure'
import * as schema from '../db/schema'
import { usersWithTwoFactor } from './two-factor/adapter-schema'
import { withTwoFactorSecretEncryption } from './two-factor/encryption'
import { twoFactorAllMethods } from './two-factor/all-methods'
import type { TwoFactorEvent } from './two-factor/events'
import {
  userCreateRuntimeEnvFields,
  type OrgRuntimeEnv,
} from './runtime-env'
import { withUserEnvScope } from './auth-env-scope'

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
  // Fork hook at the single post-verification account-creation point
  // (web-signup-domain-association task 2.1). Fired from
  // `databaseHooks.user.create.after`, which both signup paths (magic link,
  // Airtable SSO) cross. Best-effort — implementations must never throw
  // into the signup flow.
  onAccountCreated?: (user: { id: string; email: string }) => Promise<void>
  /** SOC 2 CC7.2: a login-link was requested (authentication attempt). */
  onMagicLinkRequested?: (input: { email: string }) => Promise<void>
  /** SOC 2 CC7.2: a session was created (successful sign-in, any method). */
  onSessionCreated?: (session: {
    userId: string
    ipAddress?: string | null
    userAgent?: string | null
  }) => Promise<void>
  // Master encryption key (BASEOUT_ENCRYPTION_KEY, base64 32 bytes) — the
  // at-rest layer for TOTP secrets/backup codes (web-auth-2fa; PRD §20.2).
  // When absent (fresh dev clone) the plugin-native encryption still applies.
  encryptionKey?: string
  // Audit + notification sink for 2FA events (web-auth-2fa task 2.1).
  // Implementations must never throw into the auth flow.
  onTwoFactorEvent?: (event: TwoFactorEvent) => Promise<void>
  // Airtable SSO login app (web-auth-airtable-sso). The provider registers
  // ONLY when both are present — the login OAuth app is a separate,
  // minimal-scope registration (NOT the Connect integration). Absent vars ⇒
  // "Continue with Airtable" stays hidden and behavior is unchanged.
  airtableLoginClientId?: string
  airtableLoginClientSecret?: string
  // AIRTABLE_STUBS_ENABLED === '1': register SSO against the local
  // /api/stub/airtable/* routes with placeholder creds so the login flow is
  // smokable before the real login app exists (mirrors the Connect stubs).
  airtableStubsEnabled?: boolean
  // Audit hook fired when better-auth links an OAuth identity (accounts row
  // creation) — SSO link/sign-up audit + at_user_id corroboration note.
  onSsoAccountLinked?: (account: {
    providerId: string
    accountId: string
    userId: string
  }) => Promise<void>
  /**
   * Worker env (shared-org-runtime-env, D3 second amendment): stamps
   * users.runtime_env at creation and scopes every email-addressed user
   * lookup at the adapter boundary — the same email is a separate user row
   * per env (unique(email, runtime_env)).
   */
  runtimeEnv?: OrgRuntimeEnv | null
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

// SameSite=None so the session flows inside embedded iframes on Chromium
// (shared-embed-protocol design Decision 9; Safari/Firefox block third-party
// cookies regardless — the /embed sign-in fallback covers them). None is only
// valid WITH Secure, so the local-dev plain-cookie mode stays at better-auth's
// Lax default — browsers silently drop None-without-Secure cookies. CSRF
// posture: better-auth's CSRF protection does not rely on SameSite, and every
// mutating route passes through it (web CLAUDE.md §2).
export function resolveCookieAttributes(
  baseUrl: string | undefined,
): { sameSite: 'none'; secure: true; partitioned: boolean } | undefined {
  if (resolveUseSecureCookies(baseUrl) === false) return undefined
  return { sameSite: 'none', secure: true, partitioned: false }
}

export function createAuth(db: DrizzleDb, env: AuthFactoryEnv) {
  const plugins: BetterAuthPlugin[] = []
  // "Continue with Airtable" (web-auth-airtable-sso): conditional — real
  // login-app credentials enable it against Airtable; stub mode enables it
  // against the local /api/stub/airtable/* routes with placeholder creds
  // (the stub token endpoint never validates them). Neither ⇒ SSO absent,
  // zero behavior change.
  const ssoStubbed = env.airtableStubsEnabled === true && !!env.baseUrl
  if ((env.airtableLoginClientId && env.airtableLoginClientSecret) || ssoStubbed) {
    plugins.push(
      genericOAuth({
        config: [
          buildAirtableSsoProvider(
            {
              clientId: env.airtableLoginClientId ?? 'stub-login-app',
              clientSecret: env.airtableLoginClientSecret ?? 'stub-login-secret',
            },
            fetch,
            ssoStubbed
              ? resolveAirtableUrls({ AIRTABLE_STUBS_ENABLED: '1' }, env.baseUrl!)
              : undefined,
          ),
        ],
      }),
    )
  }

  return betterAuth({
    secret: env.secret,
    baseURL: env.baseUrl ?? AUTH_BASE_URL,
    trustedOrigins: env.dev
      ? [...PROD_TRUSTED_ORIGINS, ...DEV_TRUSTED_ORIGINS]
      : PROD_TRUSTED_ORIGINS,
    // Adapter: explicit schema so model 'user' maps the extended users table
    // (adds twoFactorEnabled without touching @baseout/db-schema — see
    // two-factor/adapter-schema.ts), wrapped with the master-key storage
    // hook for TOTP secret/backup-code columns (web-auth-2fa; PRD §20.2).
    // Composition order: env scope OUTERMOST so every email-addressed user
    // query — including the two-factor wrapper's own — is env-scoped.
    database: withUserEnvScope(
      withTwoFactorSecretEncryption(
      drizzleAdapter(db, {
        provider: 'pg',
        usePlural: true,
        schema: { ...schema, users: usersWithTwoFactor },
      }),
      env.encryptionKey,
      {
        // The verified:true flip is enrollment ACTIVATION — the audit +
        // notification moment for "2FA enabled".
        onActivated: async (userId) => {
          await env.onTwoFactorEvent?.({ kind: 'enabled', userId })
        },
      },
      ),
      env.runtimeEnv ?? null,
    ),
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
        runtimeEnv: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: 'staging',
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              ...userCreateRuntimeEnvFields(env.runtimeEnv ?? null),
            },
          }),
          // The single account-creation point (post-verification) for every
          // signup method — the signup-domain-association fork hook.
          after: async (user) => {
            await env.onAccountCreated?.({ id: user.id, email: user.email })
          },
        },
      },
      account: {
        create: {
          // SSO identity link/sign-up audit (web-auth-airtable-sso):
          // fires for the accounts row better-auth writes on OAuth link.
          after: async (account) => {
            await env.onSsoAccountLinked?.({
              providerId: account.providerId,
              accountId: account.accountId,
              userId: account.userId,
            })
          },
        },
      },
      session: {
        create: {
          // CC7.2: a session row = a successful sign-in (every method lands
          // here). Records who authenticated + non-secret request context.
          after: async (session) => {
            await env.onSessionCreated?.({
              userId: session.userId,
              ipAddress: session.ipAddress ?? null,
              userAgent: session.userAgent ?? null,
            })
          },
        },
      },
    },
    account: {
      // Login-token at-rest posture (PRD §20.2 spirit): the SSO access/
      // refresh tokens on the accounts row are symmetric-encrypted with the
      // auth secret. The login token is whoami-only — never a Connection.
      encryptOAuthTokens: true,
    },
    // OAuth/GET auth failures (denied consent, missing email, whoami error)
    // land on the login page with an error param — no partial state, no
    // bare better-auth /error page (web-auth-airtable-sso task 2.3).
    onAPIError: {
      errorURL: '/login',
    },
    plugins: [
      ...plugins,
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // CC7.2: record the authentication attempt — never the url/token.
          await env.onMagicLinkRequested?.({ email })
          // No env gate here (D3 second amendment): the adapter's env scope
          // means an other-env user simply doesn't resolve — this flow either
          // finds THIS env's user or creates one.
          const rendered = renderMagicLinkEmail({ email, url })
          await sendEmail({ to: email, ...rendered }, env)
        },
      }),
      // Optional TOTP 2FA (web-auth-2fa). Passwordless-compatible:
      // allowPasswordless lets users without a credential account enroll —
      // NO password surface is introduced (CLAUDE.md §3.3 stands).
      // Verify-to-activate + 10 single-use backup codes + 30-day trusted
      // device are plugin-native (design Decision 2).
      twoFactor({
        issuer: 'Baseout',
        allowPasswordless: true,
        trustDeviceMaxAge: 30 * 24 * 60 * 60,
        backupCodeOptions: { amount: 10 },
      }),
      // Extends the 2FA challenge to magic link + Airtable SSO (the stock
      // hook only covers credential sign-ins) and observes 2FA endpoints
      // for audit rows + notification emails.
      twoFactorAllMethods({
        trustDeviceMaxAge: 30 * 24 * 60 * 60,
        onEvent: env.onTwoFactorEvent,
      }),
    ],
    // better-auth built-in rate limiting; explicit tighter windows on the
    // 2FA challenge/manage endpoints (web-auth-2fa task 1.1). Storage is
    // per-isolate memory — acceptable brute-force damping in workerd.
    rateLimit: {
      enabled: true,
      customRules: {
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
        '/two-factor/enable': { window: 60, max: 10 },
        '/two-factor/disable': { window: 60, max: 10 },
      },
    },
    session: {
      // 30-day sliding window (product decision 2026-07-09; default was 7d/1d).
      // updateAge=1d slides expiry forward on the first request each day, so
      // monthly-active users never re-login while an abandoned cookie still
      // dies within 30 days of its last use.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      // Without this, Better Auth cannot resolve a client IP and collapses rate
      // limiting to ONE shared bucket for every caller — a real weakness on
      // /api/auth/sign-in/magic-link in deployed envs, not just a local warning.
      // cf-connecting-ip is the trustworthy header on Workers (set by the edge);
      // x-forwarded-for is the fallback. Miniflare sets neither, so the warning
      // persists in local dev — harmless there.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
      useSecureCookies: resolveUseSecureCookies(env.baseUrl),
      defaultCookieAttributes: resolveCookieAttributes(env.baseUrl),
      database: {
        generateId: 'uuid',
      },
    },
  })
}
