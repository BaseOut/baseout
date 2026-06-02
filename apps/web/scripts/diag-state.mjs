#!/usr/bin/env node
// Read-only DB diagnostic for autumn@openside.com — connections health,
// space setup state, user_preferences. Prints to stdout.

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
const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not found in apps/web/.env');

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

const EMAIL = 'autumn@openside.com';

try {
  console.log(`\n=== Users matching ${EMAIL} ===`);
  const users = await sql`
    SELECT id, email, name, created_at
    FROM baseout.users
    WHERE email = ${EMAIL}
  `;
  console.table(users);
  if (users.length === 0) {
    console.log('No matching user — bailing out.');
    process.exit(0);
  }
  const userIds = users.map((u) => u.id);

  console.log(`\n=== user_preferences ===`);
  const prefs = await sql`
    SELECT user_id, active_organization_id, active_space_id, created_at, modified_at
    FROM baseout.user_preferences
    WHERE user_id = ANY(${userIds})
  `;
  console.table(prefs);

  console.log(`\n=== Organization memberships ===`);
  const orgs = await sql`
    SELECT om.user_id, om.organization_id, om.role, om.is_default,
           o.name AS org_name, o.slug AS org_slug, o.created_at AS org_created
    FROM baseout.organization_members om
    JOIN baseout.organizations o ON o.id = om.organization_id
    WHERE om.user_id = ANY(${userIds})
    ORDER BY o.created_at ASC
  `;
  console.table(orgs);

  const orgIds = orgs.map((o) => o.organization_id);
  console.log(`\n=== Spaces in those orgs ===`);
  const spaces = await sql`
    SELECT id, organization_id, name, status, created_at, modified_at
    FROM baseout.spaces
    WHERE organization_id = ANY(${orgIds})
    ORDER BY created_at ASC
  `;
  console.table(spaces);

  const spaceIds = spaces.map((s) => s.id);
  console.log(`\n=== Connections in those spaces ===`);
  const conns = await sql`
    SELECT c.id, c.space_id, c.platform_id, p.slug AS platform,
           c.status, c.display_name,
           c.token_expires_at, c.invalidated_at, c.modified_at,
           (c.refresh_token_enc IS NOT NULL) AS has_refresh_token,
           c.created_at
    FROM baseout.connections c
    LEFT JOIN baseout.platforms p ON p.id = c.platform_id
    WHERE c.space_id = ANY(${spaceIds})
    ORDER BY c.modified_at DESC
  `;
  console.table(conns);

  console.log(`\n=== Recent connection status changes (last 24h, all orgs) ===`);
  const recent = await sql`
    SELECT id, space_id, status, modified_at, token_expires_at
    FROM baseout.connections
    WHERE modified_at > now() - interval '24 hours'
      AND space_id = ANY(${spaceIds})
    ORDER BY modified_at DESC
    LIMIT 50
  `;
  console.table(recent);
} finally {
  await sql.end({ timeout: 5 });
}
