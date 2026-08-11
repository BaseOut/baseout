#!/usr/bin/env node
// Wider connection-state probe — look across ALL orgs in the dev DB to see
// where backups have been running. Read-only.

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

try {
  console.log('\n=== All connections grouped by status (whole dev DB) ===');
  const groups = await sql`
    SELECT status, count(*) FROM baseout.connections GROUP BY status ORDER BY 2 DESC
  `;
  console.table(groups);

  console.log('\n=== Last 20 connection rows modified (whole dev DB) ===');
  const recent = await sql`
    SELECT c.id, c.space_id, p.slug AS platform, c.status, c.display_name,
           c.token_expires_at, c.invalidated_at, c.modified_at,
           (c.refresh_token_enc IS NOT NULL) AS has_refresh,
           s.name AS space_name, o.name AS org_name
    FROM baseout.connections c
    LEFT JOIN baseout.platforms p ON p.id = c.platform_id
    LEFT JOIN baseout.spaces s ON s.id = c.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    ORDER BY c.modified_at DESC
    LIMIT 20
  `;
  console.table(recent);

  console.log('\n=== Connections grouped by (org_name, platform, status) ===');
  const byOrg = await sql`
    SELECT o.name AS org_name, p.slug AS platform, c.status, count(*)
    FROM baseout.connections c
    LEFT JOIN baseout.platforms p ON p.id = c.platform_id
    LEFT JOIN baseout.spaces s ON s.id = c.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    GROUP BY 1,2,3
    ORDER BY 1,2,3
  `;
  console.table(byOrg);

  console.log('\n=== Storage destinations (BYOS) for autumn’s orgs ===');
  const storage = await sql`
    SELECT sd.id, sd.space_id, sd.provider, sd.display_name,
           sd.token_expires_at, sd.invalidated_at, sd.modified_at,
           (sd.refresh_token_enc IS NOT NULL) AS has_refresh,
           s.name AS space_name, o.name AS org_name
    FROM baseout.storage_destinations sd
    LEFT JOIN baseout.spaces s ON s.id = sd.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    WHERE o.id IN (
      '54607ce2-0322-4f99-92dd-dc2e01e3e9f7',
      'e9ae1e3f-71f2-4fc4-8724-4a6c0a470433'
    )
    ORDER BY sd.modified_at DESC
  `;
  console.table(storage);

  console.log('\n=== Recent backup_runs across autumn’s spaces ===');
  const runs = await sql`
    SELECT br.id, br.space_id, br.status, br.started_at, br.completed_at, br.error_message,
           s.name AS space_name, o.name AS org_name
    FROM baseout.backup_runs br
    LEFT JOIN baseout.spaces s ON s.id = br.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    WHERE o.id IN (
      '54607ce2-0322-4f99-92dd-dc2e01e3e9f7',
      'e9ae1e3f-71f2-4fc4-8724-4a6c0a470433'
    )
    ORDER BY br.created_at DESC
    LIMIT 10
  `;
  console.table(runs);
} finally {
  await sql.end({ timeout: 5 });
}
