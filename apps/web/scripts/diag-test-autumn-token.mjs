// Probe Bug 2 final: grab autumn's most recent session token from the DB,
// sign the cookie value with better-auth's default secret (BETTER_AUTH_SECRET
// is NOT set in apps/web/.dev.vars so better-auth falls back to the literal
// "better-auth-secret-12345678901234567890" — see node_modules/.pnpm/
// better-auth@*/dist/context/create-context.mjs:80), then hit the running
// dev server's / and /api/me. If 200 → server-side is fine and bug is purely
// browser-side. If 401/302 → there's some server-side issue our happy-path
// probe didn't catch.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const devVars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));

const BETTER_AUTH_DEFAULT_SECRET = 'better-auth-secret-12345678901234567890';
const SECRET = devVars.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET || BETTER_AUTH_DEFAULT_SECRET;
const BASE = 'https://baseout.local:4331';

const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

try {
  const [user] = await sql`SELECT id FROM baseout.users WHERE email = 'autumn@openside.com'`;
  if (!user) throw new Error('user not found');

  const [session] = await sql`
    SELECT id, token, expires_at, created_at
    FROM baseout.sessions
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!session) throw new Error('no recent session');
  console.log(`Latest session for autumn: ${session.id} created ${session.created_at.toISOString()}, expires ${session.expires_at.toISOString()}`);
  console.log(`Token prefix: ${String(session.token).slice(0, 12)}…  len ${session.token.length}\n`);

  // Better-auth's signCookieValue: value + '.' + base64urlnopad(HMAC-SHA256(value, secret))
  const sig = createHmac('sha256', SECRET)
    .update(session.token)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const cookieValue = `${session.token}.${sig}`;
  const cookieHeader = `better-auth.session_token=${cookieValue}`;

  console.log('Probing with autumn’s real session token (signed via default secret).');

  console.log('\n→ GET /api/me');
  const me = await fetch(`${BASE}/api/me`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  });
  console.log(`  ← ${me.status} ${me.statusText}`);
  if (me.headers.get('location')) console.log(`  Location: ${me.headers.get('location')}`);
  const body = await me.text();
  console.log(`  body: ${body.slice(0, 400)}`);

  console.log('\n→ GET / (dashboard)');
  const root = await fetch(`${BASE}/`, {
    headers: { cookie: cookieHeader, accept: 'text/html' },
    redirect: 'manual',
  });
  console.log(`  ← ${root.status} ${root.statusText}`);
  if (root.headers.get('location')) console.log(`  Location: ${root.headers.get('location')}`);
} finally {
  await sql.end({ timeout: 5 });
}
