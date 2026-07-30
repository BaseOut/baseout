/**
 * All-methods 2FA challenge interception + auth-event observation
 * (web-auth-2fa tasks 2.1/2.2; design Decision 1).
 *
 * better-auth's `twoFactor` plugin only intercepts credential sign-ins
 * (/sign-in/email|username|phone-number) — magic-link verification and
 * generic-OAuth callbacks would slip past the challenge, leaving a bypass.
 * This companion plugin extends the EXACT same interception semantics to
 * those two paths: on a fresh sign-in by a 2FA-enabled user on an
 * untrusted device it revokes the just-created session, arms the plugin's
 * own `two_factor` challenge cookie (so the stock /two-factor/verify-totp
 * and /two-factor/verify-backup-code endpoints complete the flow), and
 * redirects to the /2fa challenge page. Trusted devices (the plugin's
 * `trust_device` cookie, 30-day default) skip and rotate exactly like the
 * stock hook.
 *
 * It also observes the twoFactor endpoints to emit audit/notification
 * events (enroll/disable/backup-code-consumption/failed challenges) —
 * better-auth has no databaseHooks for plugin models, so the response hook
 * is the observation point.
 *
 * Cookie names, verification-value shapes, and the trust-device HMAC are
 * pinned to better-auth 1.6.x's two-factor plugin internals
 * (dist/plugins/two-factor) — the signed values MUST interoperate because
 * the stock verify endpoints read what we write and vice versa.
 */

import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from 'better-auth/api'
import { deleteSessionCookie, expireCookie } from 'better-auth/cookies'
import { generateRandomString, symmetricDecrypt } from 'better-auth/crypto'
import type { BetterAuthPlugin } from 'better-auth'
import type { TwoFactorEvent } from './events'
import { verifyTotpCode } from './totp'

// Pinned to better-auth/dist/plugins/two-factor/constant.mjs.
const TWO_FACTOR_COOKIE_NAME = 'two_factor'
const TRUST_DEVICE_COOKIE_NAME = 'trust_device'

const DEFAULT_TRUST_DEVICE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days (design Q1)
const DEFAULT_TWO_FACTOR_COOKIE_MAX_AGE = 600 // 10 minutes (plugin default)

/** Sign-in completion paths the stock twoFactor hook does NOT cover. */
export const INTERCEPTED_SIGN_IN_PATHS: readonly string[] = [
  '/magic-link/verify',
  '/oauth2/callback/:providerId',
]

const OBSERVED_TWO_FACTOR_PATHS: readonly string[] = [
  '/two-factor/enable',
  '/two-factor/disable',
  '/two-factor/verify-totp',
  '/two-factor/verify-backup-code',
]

/**
 * HMAC-SHA256(secret, payload) → base64url (no padding). Byte-for-byte the
 * signature `createHMAC("SHA-256","base64urlnopad")` in @better-auth/utils
 * produces — the trust-device token must verify against tokens minted by
 * the stock verify endpoints.
 */
export async function signTrustDevicePayload(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  )
  let bin = ''
  for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Reduce a post-sign-in redirect target to a safe, same-app relative path.
 * `baseURL` is better-auth's resolved base (origin + /api/auth).
 */
export function sanitizeContinueTarget(
  location: string | null | undefined,
  baseURL: string,
): string | null {
  if (!location) return null
  if (location.startsWith('//')) return null
  if (location.startsWith('/')) return location
  try {
    const url = new URL(location)
    const origin = new URL(baseURL).origin
    if (url.origin !== origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

/** The /2fa challenge URL, carrying the sanitized continue target. */
export function buildChallengeRedirect(continueTarget: string | null): string {
  return continueTarget
    ? `/2fa?redirect=${encodeURIComponent(continueTarget)}`
    : '/2fa'
}

export interface TwoFactorAllMethodsOptions {
  trustDeviceMaxAge?: number
  twoFactorCookieMaxAge?: number
  /** Audit/notification sink — must never throw into the auth flow. */
  onEvent?: (event: TwoFactorEvent) => Promise<void> | void
}

// createAuthMiddleware's ctx is intentionally loosely typed here: the hook
// touches internal-adapter surfaces the public types don't fully expose.
/* eslint-disable @typescript-eslint/no-explicit-any */

async function emit(
  options: TwoFactorAllMethodsOptions,
  event: TwoFactorEvent,
): Promise<void> {
  try {
    await options.onEvent?.(event)
  } catch {
    // Observation must never fail the auth action.
  }
}

/** Resolve the challenge-in-progress user via the two_factor cookie. */
async function resolveChallengeUserId(ctx: any): Promise<string | null> {
  try {
    const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME)
    const signed = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
    if (!signed) return null
    const verification =
      await ctx.context.internalAdapter.findVerificationValue(signed)
    return verification?.value ?? null
  } catch {
    return null
  }
}

export function twoFactorAllMethods(
  options: TwoFactorAllMethodsOptions = {},
): BetterAuthPlugin {
  const trustDeviceMaxAge =
    options.trustDeviceMaxAge ?? DEFAULT_TRUST_DEVICE_MAX_AGE
  const twoFactorCookieMaxAge =
    options.twoFactorCookieMaxAge ?? DEFAULT_TWO_FACTOR_COOKIE_MAX_AGE

  return {
    id: 'two-factor-all-methods',
    hooks: {
      before: [
        {
          // Disable-requires-factor (spec: "disable without a valid code or
          // backup code → rejected"). better-auth's allowPasswordless mode
          // waives ALL proof for credential-less users on /two-factor/disable
          // — a session thief could silently strip the second factor. This
          // pre-hook demands a current TOTP code or an unspent backup code,
          // verified against the plugin's own stored material
          // (symmetricDecrypt with the auth secret; TOTP parity in totp.ts).
          matcher: (context) => context.path === '/two-factor/disable',
          handler: createAuthMiddleware(async (ctx) => {
            const context = ctx.context as any
            const session = await getSessionFromCtx(ctx as never)
            const user = session?.user as
              | { id: string; twoFactorEnabled?: boolean | null }
              | undefined
            if (!user?.twoFactorEnabled) return // plugin handles not-enrolled

            const body = (ctx.body ?? {}) as { code?: unknown }
            const code =
              typeof body.code === 'string' ? body.code.trim() : ''
            const reject = async () => {
              await emit(options, {
                kind: 'challenge_failed',
                userId: user.id,
                email:
                  (session?.user as { email?: string } | undefined)?.email ??
                  null,
                metadata: { method: 'disable' },
              })
              throw new APIError('UNAUTHORIZED', {
                message: 'A valid two-factor code is required to disable 2FA.',
                code: 'INVALID_CODE',
              })
            }
            if (!code) await reject()

            const row = (await context.adapter.findOne({
              model: 'twoFactor',
              where: [{ field: 'userId', value: user.id }],
            })) as { secret: string; backupCodes: string } | null
            if (!row) return // nothing to protect

            try {
              const secret = await symmetricDecrypt({
                key: context.secretConfig,
                data: row.secret,
              })
              if (await verifyTotpCode(secret, code)) return
            } catch {
              // fall through to backup-code check
            }
            try {
              const decoded = await symmetricDecrypt({
                key: context.secretConfig,
                data: row.backupCodes,
              })
              const codes = JSON.parse(decoded) as unknown
              if (Array.isArray(codes) && codes.includes(code)) return
            } catch {
              // invalid material — reject below
            }
            await reject()
          }),
        },
      ],
      after: [
        {
          matcher: (context) =>
            INTERCEPTED_SIGN_IN_PATHS.includes(context.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const context = ctx.context as any
            const data = context.newSession
            if (!data?.user || !data.session) return
            const user = data.user as {
              id: string
              email: string
              twoFactorEnabled?: boolean | null
            }
            if (!user.twoFactorEnabled) return

            // Trusted device: verify + rotate exactly like the stock hook.
            const trustCookieAttrs = context.createAuthCookie(
              TRUST_DEVICE_COOKIE_NAME,
              { maxAge: trustDeviceMaxAge },
            )
            const trustCookie = await ctx.getSignedCookie(
              trustCookieAttrs.name,
              context.secret,
            )
            if (trustCookie) {
              const [token, trustIdentifier] = trustCookie.split('!')
              if (token && trustIdentifier) {
                const expected = await signTrustDevicePayload(
                  context.secret,
                  `${user.id}!${trustIdentifier}`,
                )
                if (token === expected) {
                  const record =
                    await context.internalAdapter.findVerificationValue(
                      trustIdentifier,
                    )
                  if (
                    record &&
                    record.value === user.id &&
                    record.expiresAt > new Date()
                  ) {
                    await context.internalAdapter.deleteVerificationByIdentifier(
                      trustIdentifier,
                    )
                    const newTrustIdentifier = `trust-device-${generateRandomString(32)}`
                    const newToken = await signTrustDevicePayload(
                      context.secret,
                      `${user.id}!${newTrustIdentifier}`,
                    )
                    await context.internalAdapter.createVerificationValue({
                      value: user.id,
                      identifier: newTrustIdentifier,
                      expiresAt: new Date(Date.now() + trustDeviceMaxAge * 1000),
                    })
                    await ctx.setSignedCookie(
                      trustCookieAttrs.name,
                      `${newToken}!${newTrustIdentifier}`,
                      context.secret,
                      trustCookieAttrs.attributes,
                    )
                    return // trusted — the fresh session stands
                  }
                }
              }
              expireCookie(ctx, trustCookieAttrs)
            }

            // Untrusted device: revoke the just-created session and arm the
            // stock plugin's challenge cookie, then land on /2fa.
            deleteSessionCookie(ctx, true)
            await context.internalAdapter.deleteSession(data.session.token)
            const twoFactorCookie = context.createAuthCookie(
              TWO_FACTOR_COOKIE_NAME,
              { maxAge: twoFactorCookieMaxAge },
            )
            const identifier = `2fa-${generateRandomString(20)}`
            await context.internalAdapter.createVerificationValue({
              value: user.id,
              identifier,
              expiresAt: new Date(Date.now() + twoFactorCookieMaxAge * 1000),
            })
            await ctx.setSignedCookie(
              twoFactorCookie.name,
              identifier,
              context.secret,
              twoFactorCookie.attributes,
            )

            const returned = context.returned as unknown
            const location =
              isAPIError(returned) && returned.headers
                ? new Headers(returned.headers).get('location')
                : null
            const target = sanitizeContinueTarget(location, context.baseURL)
            throw ctx.redirect(buildChallengeRedirect(target))
          }),
        },
        {
          matcher: (context) =>
            OBSERVED_TWO_FACTOR_PATHS.includes(context.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const context = ctx.context as any
            const returned = context.returned as unknown
            const failed = isAPIError(returned)
            const sessionUser = (context.session?.user ??
              context.newSession?.user ??
              null) as { id: string; email: string } | null

            switch (ctx.path) {
              case '/two-factor/enable': {
                if (!failed && sessionUser) {
                  await emit(options, {
                    kind: 'enroll_started',
                    userId: sessionUser.id,
                    email: sessionUser.email,
                  })
                }
                return
              }
              case '/two-factor/disable': {
                if (!failed && sessionUser) {
                  await emit(options, {
                    kind: 'disabled',
                    userId: sessionUser.id,
                    email: sessionUser.email,
                  })
                }
                return
              }
              case '/two-factor/verify-totp':
              case '/two-factor/verify-backup-code': {
                const method =
                  ctx.path === '/two-factor/verify-totp' ? 'totp' : 'backup_code'
                if (failed && (returned as APIError).statusCode === 401) {
                  const userId =
                    sessionUser?.id ?? (await resolveChallengeUserId(ctx))
                  await emit(options, {
                    kind: 'challenge_failed',
                    userId,
                    email: sessionUser?.email ?? null,
                    metadata: { method },
                  })
                  return
                }
                if (!failed && method === 'backup_code') {
                  const user = (context.newSession?.user ??
                    sessionUser) as { id: string; email: string } | null
                  if (user) {
                    await emit(options, {
                      kind: 'backup_code_consumed',
                      userId: user.id,
                      email: user.email,
                    })
                  }
                }
                return
              }
            }
          }),
        },
      ],
    },
  }
}
