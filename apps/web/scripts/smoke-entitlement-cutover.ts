// Task 2.3 cutover smoke (shared-entitlements): for every org with an
// active/trialing subscription, resolve capabilities BOTH ways — legacy tier
// table vs preferEntitlements — and diff the resulting TierCapabilitySet.
// Read-only; prints a per-org verdict. Run:
//   node --env-file=.env --import tsx/esm scripts/smoke-entitlement-cutover.ts
import { db, sql } from '../src/db/node'
import { organizations } from '../src/db/schema'
import { resolveCapabilities } from '../src/lib/capabilities/resolve'
import { resolveEntitlements } from '../src/lib/entitlements/resolve'

const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations)

let diffs = 0
for (const org of orgs) {
  const legacy = await resolveCapabilities(db, org.id, 'airtable')
  const ent = await resolveCapabilities(db, org.id, 'airtable', { preferEntitlements: true })
  const resolution = await resolveEntitlements(db, org.id)
  const same = JSON.stringify(legacy.capabilities) === JSON.stringify(ent.capabilities)
  console.log(`org "${org.name}" (${org.id.slice(0, 8)}) tier=${legacy.tier ?? '-'} plan=${resolution?.planSlug ?? 'NULL (falls back)'} → ${same ? 'IDENTICAL' : 'DIFFERS'}`)
  if (!same) {
    diffs++
    console.log(`  legacy: ${JSON.stringify(legacy.capabilities)}`)
    console.log(`  entitl: ${JSON.stringify(ent.capabilities)}`)
  }
}
console.log(`\n${orgs.length} org(s) checked, ${diffs} differing`)
await sql.end()
