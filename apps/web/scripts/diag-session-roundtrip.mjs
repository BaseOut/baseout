// Probe Bug 2: log in via magic-link end-to-end against the running local
// wrangler dev at https://baseout.local:4331, capture the Set-Cookie issued
// by the verify endpoint, then make TWO subsequent GETs with that cookie to
// see whether the server validates it consistently. If the first GET 200s
// and the second 302s-to-/login → the server is invalidating the cookie
// between requests (server-side bug). If both 200 → the cookie is fine
// server-side and the symptom is browser-side (Brave dropping it).
//
// Uses an e2e-prefixed email so we don't spam autumn's inbox. E2E_TEST_MODE
// is enabled in apps/web/wrangler.jsonc (line 63) and the internal
// last-verification endpoint hands back the unconsumed token without a
// round-trip through email.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

// Accept the self-signed cert wrangler dev serves at baseout.local:4331.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const devVars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));

const TOKEN = devVars.E2E_TEST_TOKEN;
if (!TOKEN) throw new Error('E2E_TEST_TOKEN missing from apps/web/.dev.vars');

const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

const EMAIL = `e2e-bug2-${Date.now()}@bug.local`;
const BASE = 'https://baseout.local:4331';

function fmtCookies(headers) {
  // node fetch puts multiple Set-Cookie into a single comma-joined string.
  // Use getSetCookie() if available.
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const v = headers.get('set-cookie');
  return v ? [v] : [];
}

function makeAuthHeader(email) {
  const hmac = createHmac('sha256', TOKEN).update(email).digest('base64');
  return hmac;
}

try {
  console.log(`Testing session round-trip for ${EMAIL} against ${BASE}\n`);

  // 1. Trigger sign-in (creates a verification row).
  console.log('→ POST /api/auth/sign-in/magic-link');
  const signIn = await fetch(`${BASE}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: EMAIL, callbackURL: '/' }),
  });
  console.log(`  ← ${signIn.status} ${signIn.statusText}`);
  if (signIn.status !== 200) {
    console.log('  body:', await signIn.text());
    process.exit(1);
  }

  // 2. Pull the magic-link token via the internal e2e helper.
  console.log('\n→ GET /api/internal/test/last-verification');
  const lookup = await fetch(
    `${BASE}/api/internal/test/last-verification?email=${encodeURIComponent(EMAIL)}`,
    { headers: { 'X-E2E-Test-Auth': makeAuthHeader(EMAIL) } },
  );
  console.log(`  ← ${lookup.status} ${lookup.statusText}`);
  if (lookup.status !== 200) {
    console.log('  body:', await lookup.text());
    process.exit(1);
  }
  const { token, callbackURL } = await lookup.json();
  if (!token) throw new Error('no token returned');
  console.log(`  token: ${String(token).slice(0, 12)}…  callbackURL: ${callbackURL}`);

  // 3. Hit the magic-link verify URL — this is what the browser would do
  //    after the user clicks the link in their email.
  console.log('\n→ GET /api/auth/magic-link/verify?token=…');
  const verifyUrl = `${BASE}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  const verify = await fetch(verifyUrl, { method: 'GET', redirect: 'manual' });
  console.log(`  ← ${verify.status} ${verify.statusText}`);
  console.log(`  Location: ${verify.headers.get('location')}`);
  const setCookies = fmtCookies(verify.headers);
  console.log(`  Set-Cookie x${setCookies.length}:`);
  for (const c of setCookies) console.log(`    • ${c}`);
  const sessionCookieMatch = setCookies
    .map(c => c.match(/^((?:__Secure-)?better-auth\.session_token)=([^;]+)/))
    .find(Boolean);
  if (!sessionCookieMatch) {
    console.error('\n❌ verify did NOT set a session_token cookie. Server bug.');
    process.exit(1);
  }
  const [, sessionCookieName, sessionCookieValue] = sessionCookieMatch;
  console.log(`\n  session cookie name: ${sessionCookieName}`);
  const cookieHeader = `${sessionCookieName}=${sessionCookieValue}`;

  // 4. Hit /api/me with that cookie. Should succeed.
  console.log('\n→ GET /api/me with the cookie');
  const me1 = await fetch(`${BASE}/api/me`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  });
  console.log(`  ← ${me1.status} ${me1.statusText}`);
  if (me1.status === 200) {
    console.log(`  body: ${(await me1.text()).slice(0, 200)}`);
  } else if (me1.status >= 300 && me1.status < 400) {
    console.log(`  Location: ${me1.headers.get('location')}`);
  } else {
    console.log(`  body: ${(await me1.text()).slice(0, 200)}`);
  }

  // 5. Refresh-simulation: hit /api/me AGAIN with the SAME cookie.
  console.log('\n→ GET /api/me again (refresh simulation) with the SAME cookie');
  const me2 = await fetch(`${BASE}/api/me`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  });
  console.log(`  ← ${me2.status} ${me2.statusText}`);
  if (me2.status === 200) {
    console.log(`  body: ${(await me2.text()).slice(0, 200)}`);
  } else if (me2.status >= 300 && me2.status < 400) {
    console.log(`  Location: ${me2.headers.get('location')}`);
  } else {
    console.log(`  body: ${(await me2.text()).slice(0, 200)}`);
  }

  // 6. Same again, also hit /.
  console.log('\n→ GET / with the cookie (dashboard render)');
  const root = await fetch(`${BASE}/`, {
    headers: { cookie: cookieHeader, accept: 'text/html' },
    redirect: 'manual',
  });
  console.log(`  ← ${root.status} ${root.statusText}`);
  if (root.status >= 300 && root.status < 400) {
    console.log(`  Location: ${root.headers.get('location')}`);
    console.log('  ❌ Redirected to /login WITH the session cookie present — server-side session validation rejecting it.');
  } else {
    console.log('  ✓ Server accepted the cookie. Symptom must be browser-side.');
  }
} finally {
  await sql.end({ timeout: 5 });
}
