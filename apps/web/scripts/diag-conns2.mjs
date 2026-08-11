import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const sql = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });

const OPENSIDE_ORG = '54607ce2-0322-4f99-92dd-dc2e01e3e9f7';
const HUH_ORG = 'e9ae1e3f-71f2-4fc4-8724-4a6c0a470433';

try {
  console.log('\n=== Connections by organization_id (autumn’s two orgs) ===');
  const conns = await sql`
    SELECT c.id, c.organization_id, o.name AS org_name, c.space_id,
           p.slug AS platform, c.status, c.scope, c.display_name,
           c.token_expires_at, c.invalidated_at, c.modified_at, c.created_at,
           (c.refresh_token_enc IS NOT NULL) AS has_refresh,
           c.created_by_user_id
    FROM baseout.connections c
    JOIN baseout.organizations o ON o.id = c.organization_id
    LEFT JOIN baseout.platforms p ON p.id = c.platform_id
    WHERE c.organization_id IN (${OPENSIDE_ORG}, ${HUH_ORG})
    ORDER BY c.modified_at DESC
  `;
  console.table(conns);

  console.log('\n=== Storage destinations for autumn’s two orgs (by space_id → org) ===');
  const sd = await sql`
    SELECT sd.id, sd.space_id, s.name AS space_name, o.name AS org_name,
           sd.type, sd.oauth_account_email,
           sd.oauth_expires_at, sd.last_validated_at, sd.connected_at,
           (sd.oauth_refresh_token_enc IS NOT NULL) AS has_refresh
    FROM baseout.storage_destinations sd
    LEFT JOIN baseout.spaces s ON s.id = sd.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    WHERE o.id IN (${OPENSIDE_ORG}, ${HUH_ORG})
    ORDER BY sd.connected_at DESC
  `;
  console.table(sd);

  console.log('\n=== Last 10 backup_runs across autumn’s spaces ===');
  const runs = await sql`
    SELECT br.id, br.space_id, s.name AS space_name, o.name AS org_name,
           br.status, br.started_at, br.completed_at, br.error_message
    FROM baseout.backup_runs br
    LEFT JOIN baseout.spaces s ON s.id = br.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    WHERE o.id IN (${OPENSIDE_ORG}, ${HUH_ORG})
    ORDER BY br.created_at DESC
    LIMIT 10
  `;
  console.table(runs);

  console.log('\n=== at_bases for autumn’s spaces ===');
  const bases = await sql`
    SELECT ab.id, ab.space_id, s.name AS space_name, o.name AS org_name,
           ab.at_base_id, ab.name, ab.created_at
    FROM baseout.at_bases ab
    LEFT JOIN baseout.spaces s ON s.id = ab.space_id
    LEFT JOIN baseout.organizations o ON o.id = s.organization_id
    WHERE o.id IN (${OPENSIDE_ORG}, ${HUH_ORG})
    ORDER BY ab.created_at DESC
  `;
  console.table(bases);
} finally {
  await sql.end({ timeout: 5 });
}
