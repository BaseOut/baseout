// One-off backfill: promote autumn's Staging space (in "Huh?" org) from
// 'setup_incomplete' to 'active'. The space has: 6 at_bases rows, 1
// google_drive storage_destination, 9 successful backup_runs — there's no
// reasonable interpretation under which it's still "setup incomplete".
//
// Companion to the structural fix in apps/web/src/lib/spaces.ts
// (maybePromoteSpaceToActive) which prevents new spaces from getting
// stuck in the same state. Idempotent — guarded on current status.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));

const STAGING_SPACE_ID = 'c8384241-779d-4500-b4d1-ac6fd47aaf2e';
const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

try {
  const result = await sql`
    UPDATE baseout.spaces
    SET status = 'active', modified_at = now()
    WHERE id = ${STAGING_SPACE_ID}
      AND status = 'setup_incomplete'
    RETURNING id, name, status, modified_at
  `;
  if (result.length === 0) {
    console.log('No-op: row was not setup_incomplete (already active, or wrong id).');
    const [now] = await sql`SELECT id, name, status FROM baseout.spaces WHERE id = ${STAGING_SPACE_ID}`;
    console.log('Current state:', now);
  } else {
    console.log('Promoted:', result[0]);
  }
} finally {
  await sql.end({ timeout: 5 });
}
