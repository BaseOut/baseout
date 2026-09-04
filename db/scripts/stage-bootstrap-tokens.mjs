// Operator tool: mint fresh staging internal tokens and stage them in
// baseout._deploy_bootstrap for the next pipeline deploy to install (see
// deploy-bootstrap.mjs). Run by a human, locally:
//
//   node --env-file=apps/web/.dev.vars db/scripts/stage-bootstrap-tokens.mjs
//
// Writes the minted values to ~/Desktop/staging-tokens.txt (mode 600) so the
// operator can paste them where needed (trigger.dev env vars, local smokes).
// Values never print to stdout. Idempotent: re-running re-mints.

import { randomBytes } from 'node:crypto'
import { writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL missing — run with --env-file=apps/web/.dev.vars')
  process.exit(1)
}

const internalToken = randomBytes(32).toString('hex')
const e2eToken = randomBytes(32).toString('hex')

const { default: postgres } = await import('postgres')
const sql = postgres(url, { prepare: false, connection: { search_path: 'baseout,public' } })

await sql`create table if not exists baseout._deploy_bootstrap(
  worker text not null, name text not null, value text not null,
  created_at timestamptz default now(), primary key(worker,name))`

const rows = [
  ['baseout-server', 'INTERNAL_TOKEN', internalToken],
  ['baseout-web', 'BACKUP_ENGINE_INTERNAL_TOKEN', internalToken],
  ['baseout-web', 'E2E_TEST_TOKEN', e2eToken],
  ['baseout-api', 'INTERNAL_TOKEN', internalToken],
  ['baseout-admin', 'BACKUP_ENGINE_INTERNAL_TOKEN', internalToken],
]
for (const [worker, name, value] of rows) {
  await sql`insert into baseout._deploy_bootstrap(worker,name,value) values(${worker},${name},${value})
    on conflict (worker,name) do update set value=excluded.value, created_at=now()`
}
const staged = await sql`select worker, name from baseout._deploy_bootstrap order by worker, name`
console.log('staged:', staged.map((r) => `${r.worker}/${r.name}`).join(', '))
await sql.end()

const out = join(homedir(), 'Desktop', 'staging-tokens.txt')
writeFileSync(out, `STAGING_INTERNAL_TOKEN=${internalToken}\nSTAGING_E2E_TEST_TOKEN=${e2eToken}\n`)
chmodSync(out, 0o600)
console.log(`values saved to ${out} — next staging deploy installs them.`)
