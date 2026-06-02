// Diagnostic: dump autumn's recent verification + sessions rows. If she has
// been logging in repeatedly, we should see many verifications consumed and
// many sessions inserted. The session row's expiresAt tells us whether the
// session is being created with a sensible TTL.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

const EMAIL = 'autumn@openside.com';
try {
  const [user] = await sql`SELECT id FROM baseout.users WHERE email = ${EMAIL}`;
  if (!user) throw new Error('user not found');
  console.log('user id:', user.id);

  console.log('\n=== verifications in the last 24h (autumn) ===');
  const verifs = await sql`
    SELECT identifier, value, expires_at, created_at, updated_at
    FROM baseout.verifications
    WHERE created_at > now() - interval '24 hours'
      AND value LIKE ${'%' + EMAIL + '%'}
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.table(verifs.map(v => ({
    identifier_prefix: String(v.identifier).slice(0, 16) + '…',
    expires_at: v.expires_at,
    created_at: v.created_at,
    consumed: v.updated_at && v.updated_at.getTime() !== v.created_at.getTime(),
  })));

  console.log('\n=== sessions in the last 24h (autumn) ===');
  const sessions = await sql`
    SELECT id, token, expires_at, created_at, updated_at, ip_address, user_agent
    FROM baseout.sessions
    WHERE user_id = ${user.id}
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.table(sessions.map(s => ({
    id_prefix: s.id.slice(0, 8) + '…',
    token_prefix: String(s.token).slice(0, 12) + '…',
    expires_at: s.expires_at,
    created_at: s.created_at,
    updated_at: s.updated_at,
    ip: s.ip_address,
    ua: String(s.user_agent || '').slice(0, 120),
  })));

  console.log('\n=== sessions count by user (last 24h, top 5) ===');
  const counts = await sql`
    SELECT user_id, count(*) FROM baseout.sessions
    WHERE created_at > now() - interval '24 hours'
    GROUP BY user_id ORDER BY 2 DESC LIMIT 5
  `;
  console.table(counts);
} finally {
  await sql.end({ timeout: 5 });
}
