import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createDb } from "./db";
import { createAppAuth } from "./lib/auth";
import { getAccountContext } from "./lib/account";
import {
  extractSessionTokenCookie,
  SESSION_CACHE,
  SESSION_TTL_MS,
} from "./lib/session-cache";

const PUBLIC_PATHS = new Set(['/login', '/register']);

function isPublicRoute(pathname: string): boolean {
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
  return false;
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

export const onRequest = defineMiddleware(async (context, next) => {
  const { db, sql } = createDb(resolveDbUrl());
  const auth = createAppAuth(db, buildAuthEnv());
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
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });

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
      return context.redirect('/login');
    }

    const gate = applyOnboardingGate(context);
    if (gate) return gate;

    if (session && (context.url.pathname === '/login' || context.url.pathname === '/register')) {
      return context.redirect('/');
    }

    return await next();
  } finally {
    context.locals.cfContext.waitUntil(sql.end({ timeout: 5 }));
  }
});

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
