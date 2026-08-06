import { defineMiddleware, sequence } from "astro:middleware";
import { env } from "cloudflare:workers";
import { applyFrameAncestors, buildFrameAncestors } from "./lib/embed/frame-headers";
import { createDb } from "./db";
import { createAppAuth } from "./lib/auth";
import { getAccountContext } from "./lib/account";
import {
  extractSessionTokenCookie,
  SESSION_CACHE,
  SESSION_TTL_MS,
} from "./lib/session-cache";
import { rewriteLocalhostTrapUrl } from "./lib/oauth/canonical-dev-origin";
import { isLocalDevHost } from "./lib/oauth/local-dev-secure";
import { sanitizeReturnTo } from "./lib/airtable/return-to";
import { resolveLoginCallback } from "./lib/return-to";
import { handleAccountCreated } from "./lib/signup/account-created";
import { handleMagicLinkRequested, handleSessionCreated } from "./lib/auth-events";
import { handleTwoFactorEvent } from "./lib/two-factor/events";
import { handleSsoAccountLinked } from "./lib/airtable/sso-linked";

// /embed is public by design (shared-embed-protocol): an unauthenticated
// embed renders its own minimal sign-in prompt (sign-in happens top-level via
// the host, never inside the iframe) — a /login redirect inside the frame
// would strand the user.
// /2fa is public by design (web-auth-2fa): the challenge page renders while
// NO session exists — the sign-in hook revoked the fresh session and armed
// the two_factor challenge cookie; /api/auth/two-factor/verify-* mints the
// real session only after a valid code.
const PUBLIC_PATHS = new Set(['/login', '/register', '/embed', '/2fa']);

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  // Dev-only: Airtable OAuth impersonation stubs are hit by our own server-side
  // fetch() (from exchangeCodeForTokens + createAirtableClient) which carries
  // no session cookie. The individual stub handlers 404 unless the same env
  // var is set, so this is safe in prod even if the files accidentally ship.
  if (
    pathname.startsWith('/api/stub/') &&
    (env as unknown as { AIRTABLE_STUBS_ENABLED?: string })
      .AIRTABLE_STUBS_ENABLED === '1'
  ) {
    return true;
  }
  // Dev-only: Playwright tracer hits /api/internal/test/last-verification to
  // pull the most recent magic-link token without an inbox round-trip. The
  // endpoint enforces its own HMAC + email-pattern guards, so middleware just
  // steps aside. Gated on E2E_TEST_MODE === 'true', which is set ONLY in the
  // dev wrangler vars block — never in env.staging / env.production.
  if (
    pathname.startsWith('/api/internal/test/') &&
    (env as unknown as { E2E_TEST_MODE?: string }).E2E_TEST_MODE === 'true'
  ) {
    return true;
  }
  // OAuth provider callbacks complete the round-trip via an encrypted
  // handoff cookie (set by the matching /start route, which DOES require
  // a session). They must not require a fresh better-auth session at
  // callback time, because browsers may not send the SameSite=Lax session
  // cookie on the cross-site navigation back from the OAuth provider.
  // Identity is validated inside the callback handler by openHandoffPayload
  // — the handoff cookie is signed/encrypted with BASEOUT_ENCRYPTION_KEY
  // and the OAuth state param defends CSRF. Matches both
  // /api/connections/<provider>/callback (Airtable) and
  // /api/connections/storage/<provider>/callback (Drive/Box/Dropbox/OneDrive).
  // Pinned by src/middleware.test.ts — re-gating any of these reintroduces
  // the 2026-06-01 "Not authenticated" 401 loop that took 6 days to find.
  if (/^\/api\/connections\/[^/]+(?:\/[^/]+)?\/callback$/.test(pathname)) {
    return true;
  }
  return false;
}

// Where to send an unauthenticated page request. Carrying the original
// destination as ?returnTo= (validated again by /login before use) means a
// transient session-cookie loss — e.g. a browser withholding the
// SameSite=Lax cookie on the cross-site return from an OAuth provider, the
// 2026-07-02 Box incident — costs one login instead of stranding the user
// at the app root. Pinned by src/middleware.test.ts.
export function buildLoginRedirect(pathname: string, search: string): string {
  const target = sanitizeReturnTo(`${pathname}${search}`);
  if (!target || target === '/') return '/login';
  return `/login?returnTo=${encodeURIComponent(target)}`;
}

// Where a signed-in user landing on /login (or /register) with a ?returnTo=
// should be sent. Same resolution as login.astro's magic-link callbackURL:
// relative paths continue in-app; a baseout.local origin (dev) redirects
// directly; an allowlisted cross-origin target (the deployed admin console)
// goes via /api/admin/handoff — the session cookie can't follow to a
// workers.dev sibling, so redirecting there directly would just bounce the
// staffer straight back here in a loop. Pinned by src/middleware.test.ts.
export function resolveLoginBounceTarget(
  rawReturnTo: string | null,
  opts: { dev: boolean; adminAppUrl?: string },
): string {
  return (
    resolveLoginCallback(rawReturnTo, {
      dev: opts.dev,
      allowedOrigins: opts.adminAppUrl ? [opts.adminAppUrl] : undefined,
    }) ?? '/'
  );
}

function buildAuthEnv(): Parameters<typeof createAppAuth>[1] {
  return {
    secret: (env as unknown as { BETTER_AUTH_SECRET?: string })
      .BETTER_AUTH_SECRET,
    email: env.EMAIL,
    from: env.EMAIL_FROM,
    // Explicit magic-link base URL from wrangler `vars.PUBLIC_AUTH_BASE_URL`.
    // Required under `wrangler dev --remote` where the worker's Host header
    // isn't a loopback address. Absent under `astro dev`, where auth-factory
    // falls back to Host-header detection.
    baseUrl: (env as unknown as { PUBLIC_AUTH_BASE_URL?: string })
      .PUBLIC_AUTH_BASE_URL,
    // Vite bakes import.meta.env.DEV into the bundle at build time:
    // true under `npm run dev` (astro dev), false under `npm run wrangler`
    // (astro build + wrangler dev --remote) and in deployed workers.
    dev: import.meta.env.DEV,
  };
}

// Hyperdrive's `*.hyperdrive.local` connection string only resolves inside
// workerd's miniflare proxy. Under `astro dev` (pure Node), the hostname is
// unroutable → CONNECT_TIMEOUT. Bypass the binding in dev and connect to
// Postgres directly via DATABASE_URL from .env. Vite tree-shakes the dead
// branch out of the deployed bundle.
function resolveDbUrl(): string {
  if (import.meta.env.DEV) {
    const url = process.env.DATABASE_URL
    if (url) return url
  }
  return env.HYPERDRIVE.connectionString
}

// frame-ancestors on EVERY HTML response, not just /embed — once framed,
// every in-iframe navigation response needs it or the browser blanks the
// frame mid-session; and with no header at all (the pre-embed state) any
// site could frame any Baseout page. shared-embed-protocol design Decision 7.
// Exported for unit testing (middleware.test.ts) — mirrors the file's other
// test-only exports (appendSetCookies, isPublicRoute).
export const embedFrameHeaders = defineMiddleware(async (context, next) => {
  const res = await next();
  const raw = (env as unknown as { PUBLIC_EMBED_ALLOWED_ANCESTORS?: string })
    .PUBLIC_EMBED_ALLOWED_ANCESTORS;
  const framed = applyFrameAncestors(res, buildFrameAncestors(raw));
  // HSTS on every deployed response (SOC 2 CC6.1/CC6.7 TLS evidence). Skipped
  // on the local dev host (baseout.local) whose mkcert TLS is not a public
  // context — see shared/internal/oauth-setup.md §5.5.
  if (!isLocalDevHost(context.url.hostname) && !framed.headers.has('Strict-Transport-Security')) {
    framed.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  return framed;
});

const handleRequest = defineMiddleware(async (context, next) => {
  const trapRewrite = rewriteLocalhostTrapUrl(new URL(context.url));
  if (trapRewrite) {
    return context.redirect(trapRewrite.href);
  }

  const { db, sql } = createDb(resolveDbUrl());
  const authEnv = buildAuthEnv();
  const auth = createAppAuth(db, {
    ...authEnv,
    // signup-domain-association fork hook — records known-domain matches at
    // account creation so /welcome can offer join-or-create (never blocks).
    onAccountCreated: (user) => handleAccountCreated(db, user),
    // web-auth CC7.2: authentication-event trail (login-link + sign-in).
    onMagicLinkRequested: (input) => handleMagicLinkRequested(db, input),
    onSessionCreated: (session) => handleSessionCreated(db, session),
    // web-auth-2fa: master-key layer for TOTP secrets + the audit/email sink.
    encryptionKey: (env as unknown as { BASEOUT_ENCRYPTION_KEY?: string })
      .BASEOUT_ENCRYPTION_KEY,
    onTwoFactorEvent: (event) =>
      handleTwoFactorEvent(
        db,
        { email: authEnv.email, from: authEnv.from, dev: authEnv.dev },
        event,
      ),
    // web-auth-airtable-sso: the dedicated LOGIN app's credentials (not the
    // Connect integration). Absent until the app is registered — SSO stays
    // off with zero behavior change.
    airtableLoginClientId: (env as unknown as {
      AIRTABLE_LOGIN_OAUTH_CLIENT_ID?: string;
    }).AIRTABLE_LOGIN_OAUTH_CLIENT_ID,
    airtableLoginClientSecret: (env as unknown as {
      AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET?: string;
    }).AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET,
    airtableStubsEnabled: (env as unknown as {
      AIRTABLE_STUBS_ENABLED?: string;
    }).AIRTABLE_STUBS_ENABLED === '1',
    onSsoAccountLinked: (account) => handleSsoAccountLinked(db, account),
  });
  context.locals.db = db;
  context.locals.auth = auth;

  const cookieHeader = context.request.headers.get('cookie') ?? '';
  const sessionToken = extractSessionTokenCookie(cookieHeader);
  const isAuthApi = context.url.pathname.startsWith('/api/auth/');
  const cacheable = !!sessionToken && !isAuthApi;
  if (cacheable) {
    const hit = SESSION_CACHE.get(sessionToken);
    if (hit && hit.expiresAt > Date.now()) {
      context.locals.user = hit.user;
      context.locals.session = hit.session;
      context.locals.account = hit.account;
      const gate = applyOnboardingGate(context);
      if (gate) {
        context.locals.cfContext.waitUntil(sql.end({ timeout: 5 }));
        return gate;
      }
      try {
        return await next();
      } finally {
        context.locals.cfContext.waitUntil(sql.end({ timeout: 5 }));
      }
    }
  }

  try {
    // returnHeaders: better-auth's daily updateAge slide re-issues the
    // session cookie with a fresh Max-Age on THIS internal call — for page
    // loads, the only place that ever happens. Discarding these headers (the
    // pre-2026-07-14 behavior) meant the browser cookie kept its login-time
    // Max-Age and hard-died `expiresIn` after login even for daily-active
    // users — the recurring forced re-login of Jun–Jul 2026 (the 21ce401
    // 30-day window only stretched the death clock). Every response returned
    // below must pass through withAuthCookies. oauth-setup.md §8 has the
    // failure-mode entry.
    const sessionResult = await auth.api.getSession({
      headers: context.request.headers,
      returnHeaders: true,
    });
    const session = sessionResult.response;
    const withAuthCookies = (res: Response): Response =>
      appendSetCookies(res, sessionResult.headers.getSetCookie?.() ?? []);

    if (session) {
      const sessionUser = session.user as typeof session.user & {
        termsAcceptedAt?: Date | string | null;
      };
      const termsAcceptedAt = sessionUser.termsAcceptedAt
        ? sessionUser.termsAcceptedAt instanceof Date
          ? sessionUser.termsAcceptedAt
          : new Date(sessionUser.termsAcceptedAt)
        : null;

      context.locals.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        termsAcceptedAt,
      };
      context.locals.session = session.session;
      context.locals.account = await getAccountContext(db, session.user.id);

      if (cacheable) {
        SESSION_CACHE.set(sessionToken, {
          user: context.locals.user,
          session: context.locals.session,
          account: context.locals.account,
          expiresAt: Date.now() + SESSION_TTL_MS,
        });
      }
    } else {
      context.locals.user = null;
      context.locals.session = null;
      context.locals.account = null;
    }

    if (!session && !isPublicRoute(context.url.pathname)) {
      if (context.url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect(
        buildLoginRedirect(context.url.pathname, context.url.search),
      );
    }

    const gate = applyOnboardingGate(context);
    if (gate) return withAuthCookies(gate);

    if (session && (context.url.pathname === '/login' || context.url.pathname === '/register')) {
      // Honor a validated returnTo so a user whose session cookie reappears by
      // the time they land on /login (transient withholding) — or a signed-in
      // staffer bounced here from the admin console — continues to their
      // destination instead of stranding at the root.
      return withAuthCookies(context.redirect(
        resolveLoginBounceTarget(context.url.searchParams.get('returnTo'), {
          dev: import.meta.env.DEV,
          adminAppUrl: (env as unknown as { ADMIN_APP_URL?: string }).ADMIN_APP_URL,
        }),
      ));
    }

    return withAuthCookies(await next());
  } finally {
    context.locals.cfContext.waitUntil(sql.end({ timeout: 5 }));
  }
});

export const onRequest = sequence(embedFrameHeaders, handleRequest);

/**
 * Append better-auth Set-Cookie headers onto an outgoing response — the
 * transport for the sliding-session cookie refresh (see the getSession call
 * in onRequest). Falls back to cloning when the response's headers are
 * immutable (workerd marks some responses immutable; Astro's next() response
 * is normally mutable).
 */
export function appendSetCookies(res: Response, cookies: string[]): Response {
  if (!cookies.length) return res;
  try {
    for (const cookie of cookies) res.headers.append('set-cookie', cookie);
    return res;
  } catch {
    const out = new Response(res.body, res);
    for (const cookie of cookies) out.headers.append('set-cookie', cookie);
    return out;
  }
}

// If the user is authed but has never accepted terms, force them to /welcome.
// Once accepted, block access to /welcome. Auth API routes are always exempt.
function applyOnboardingGate(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]): Response | null {
  const user = context.locals.user;
  if (!user) return null;

  const pathname = context.url.pathname;
  if (pathname.startsWith('/api/auth/')) return null;

  if (!user.termsAcceptedAt) {
    if (pathname === '/welcome') return null;
    if (pathname === '/api/onboarding/complete') return null;
    // signup-domain-association fork endpoints — consumed by /welcome BEFORE
    // terms are accepted (join-or-create offer + join-request creation).
    if (pathname === '/api/onboarding/domain-association') return null;
    if (pathname === '/api/onboarding/join-request') return null;
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Onboarding incomplete' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/welcome');
  }

  if (pathname === '/welcome') {
    return context.redirect('/');
  }
  return null;
}
