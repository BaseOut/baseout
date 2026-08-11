// Probe: decrypt the refresh_token_enc stored in the connection row that went
// 'invalid' today at 13:15:54 UTC, call Airtable's token endpoint with it,
// print the raw response. Consumes the refresh token (Airtable rotates them).
// The row is already 'invalid' in the DB, so reconnect-required either way.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const devVars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));

const ENCRYPTION_KEY = devVars.BASEOUT_ENCRYPTION_KEY;
const CLIENT_ID = devVars.AIRTABLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = devVars.AIRTABLE_OAUTH_CLIENT_SECRET;
const CONNECTION_ID = 'd0374502-acdf-45ad-86fb-2f8aa87345e0';

if (!ENCRYPTION_KEY) throw new Error('BASEOUT_ENCRYPTION_KEY missing');
if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('AIRTABLE_OAUTH_CLIENT_ID/SECRET missing');

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptToken(ciphertextB64, keyB64) {
  const raw = base64ToBytes(keyB64);
  const keyBuf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(keyBuf).set(raw);
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'AES-GCM' }, false, ['decrypt']);
  const blob = base64ToBytes(ciphertextB64);
  const iv = blob.slice(0, 12);
  const cipher = blob.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plainBuf);
}

const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });
try {
  const [row] = await sql`
    SELECT id, refresh_token_enc, token_expires_at, modified_at, invalidated_at, status
    FROM baseout.connections
    WHERE id = ${CONNECTION_ID}
  `;
  if (!row) throw new Error('connection row not found');
  console.log('Connection row:', {
    id: row.id, status: row.status,
    invalidated_at: row.invalidated_at,
    modified_at: row.modified_at,
    token_expires_at: row.token_expires_at,
    has_refresh_token: !!row.refresh_token_enc,
  });

  let refreshToken;
  try {
    refreshToken = await decryptToken(row.refresh_token_enc, ENCRYPTION_KEY);
    console.log(`\nDecrypted refresh token (length ${refreshToken.length}, prefix: ${refreshToken.slice(0, 12)}…)`);
  } catch (err) {
    console.error('\n❌ DECRYPT FAILED — encryption-key drift suspected:');
    console.error(err.message);
    console.error('\nThis would map to "decrypt_failed" in the cron, which sets status=invalid.');
    process.exit(1);
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const creds = `${CLIENT_ID}:${CLIENT_SECRET}`;
  const basicAuth = `Basic ${Buffer.from(creds).toString('base64')}`;

  console.log('\n→ POST https://airtable.com/oauth2/v1/token (grant_type=refresh_token)');
  const res = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuth,
    },
    body: body.toString(),
  });

  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = `<unparseable: ${text}>`; }

  console.log(`\n← HTTP ${res.status} ${res.statusText}`);
  console.log('  headers:', Object.fromEntries(res.headers.entries()));
  console.log('  body:', parsed);

  console.log('\n=== Diagnosis ===');
  if (res.status === 429 || res.status >= 500) {
    console.log(`→ Would map to: transient (http_${res.status}). Next tick retries.`);
  } else if (res.ok && parsed.access_token && parsed.refresh_token) {
    console.log('→ Would map to: SUCCESS. Refresh would persist new tokens.');
    console.log('  ⚠️  Airtable HAS rotated the refresh token. Old token in DB is now dead.');
  } else if (res.ok && parsed.access_token && !parsed.refresh_token) {
    console.log('→ Would map to: invalid (missing_refresh_token). Terminal.');
  } else {
    const code = parsed?.error ?? `http_${res.status}`;
    const isPendingReauth = ['invalid_grant', 'invalid_request_or_grant', 'unauthorized_client', 'access_denied'].includes(code);
    if (isPendingReauth) {
      console.log(`→ Would map to: pending_reauth (${code}). User reconnect required.`);
    } else {
      console.log(`→ Would map to: invalid (${code}${parsed?.error_description ? `: ${parsed.error_description}` : ''}). ❌ TERMINAL — this is the category-error.`);
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}
