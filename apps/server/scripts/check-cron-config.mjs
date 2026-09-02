// Config-lint: the cron strings declared in wrangler.jsonc env.{dev,staging,
// production} MUST be byte-identical to the keys the scheduled() dispatcher
// knows about (lib/cron/dispatch.ts). A trigger with no matching dispatch
// entry fires and no-ops; a dispatch entry with no trigger never runs — both
// are silent config drift. This guards the "keep these byte-identical" note
// in the wrangler file, for EVERY deployable env (the pre-refactor version
// read the deleted wrangler.jsonc.example and only checked env.dev).
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
const wranglerSrc = readFileSync(join(serverRoot, 'wrangler.jsonc'), 'utf8')

// Cron string constants exported by the dispatcher (e.g. OAUTH_REFRESH_CRON).
const dispatchCrons = new Set(
  [...dispatchSrc.matchAll(/export const \w*CRON\w* = "([^"]+)"/g)].map(
    (m) => m[1],
  ),
)

// Strip // and /* */ comments (string-aware) so the JSONC parses as JSON.
function stripJsonc(src) {
  let out = ''
  let inStr = false
  let esc = false
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      i++
      continue
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

const config = JSON.parse(stripJsonc(wranglerSrc))
const envs = Object.keys(config.env ?? {})
if (envs.length === 0) {
  console.error('✘ no env blocks found in apps/server/wrangler.jsonc')
  process.exit(1)
}

let failed = false
for (const envName of envs) {
  const crons = new Set(config.env[envName]?.triggers?.crons ?? [])
  const missingTrigger = [...dispatchCrons].filter((c) => !crons.has(c))
  const orphanTrigger = [...crons].filter((c) => !dispatchCrons.has(c))
  if (missingTrigger.length || orphanTrigger.length) {
    failed = true
    console.error(`✘ cron drift between dispatch.ts and wrangler env.${envName}:`)
    if (missingTrigger.length)
      console.error(
        `  dispatch knows but no wrangler trigger: ${missingTrigger.join(', ')}`,
      )
    if (orphanTrigger.length)
      console.error(
        `  wrangler triggers but dispatch ignores: ${orphanTrigger.join(', ')}`,
      )
  }
}

if (failed) process.exit(1)

console.log(
  `✓ cron config in sync across env.{${envs.join(',')}} (${[...dispatchCrons]
    .sort()
    .join(', ')})`,
)
