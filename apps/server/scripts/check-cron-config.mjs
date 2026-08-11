// Config-lint: the cron strings declared in wrangler.jsonc(.example) env.dev
// MUST be byte-identical to the keys the scheduled() dispatcher knows about
// (lib/cron/dispatch.ts). A trigger with no matching dispatch entry fires and
// no-ops; a dispatch entry with no trigger never runs — both are silent config
// drift. This guards the "keep these byte-identical" note in the wrangler file.
//
// Run: node apps/server/scripts/check-cron-config.mjs  (exit 1 on drift).
// Intended for CI / pre-deploy; the workers test pool has no fs so this can't
// be a vitest.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const serverRoot = join(here, '..')

const dispatchSrc = readFileSync(
  join(serverRoot, 'src/lib/cron/dispatch.ts'),
  'utf8',
)
const wranglerSrc = readFileSync(
  join(serverRoot, 'wrangler.jsonc.example'),
  'utf8',
)

// Cron string constants exported by the dispatcher (e.g. OAUTH_REFRESH_CRON).
const dispatchCrons = new Set(
  [...dispatchSrc.matchAll(/export const \w*CRON\w* = "([^"]+)"/g)].map(
    (m) => m[1],
  ),
)

// env.dev.triggers.crons — the block after the baseout-server-dev name. Each
// entry is a quoted cron string; trailing // comments are not quoted so they
// don't match.
const devBlock = wranglerSrc.slice(wranglerSrc.indexOf('baseout-server-dev'))
const cronsStart = devBlock.indexOf('"crons"')
const cronsArr = devBlock.slice(cronsStart, devBlock.indexOf(']', cronsStart))
const wranglerCrons = new Set(
  [...cronsArr.matchAll(/"([\d*/,\- ]+ [\d*/,\- ]+ [\d*/,\- ]+ [\d*/,\- ]+ [\d*/,\- ]+)"/g)].map(
    (m) => m[1],
  ),
)

const missingTrigger = [...dispatchCrons].filter((c) => !wranglerCrons.has(c))
const orphanTrigger = [...wranglerCrons].filter((c) => !dispatchCrons.has(c))

if (missingTrigger.length || orphanTrigger.length) {
  console.error('✘ cron config drift between dispatch.ts and wrangler env.dev:')
  if (missingTrigger.length)
    console.error(`  dispatch knows but no wrangler trigger: ${missingTrigger.join(', ')}`)
  if (orphanTrigger.length)
    console.error(`  wrangler triggers but dispatch ignores: ${orphanTrigger.join(', ')}`)
  process.exit(1)
}

console.log(
  `✓ cron config in sync (${[...dispatchCrons].sort().join(', ')})`,
)
