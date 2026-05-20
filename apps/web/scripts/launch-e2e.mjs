// Renders apps/web/dist/server/wrangler.e2e.json from the astro adapter's
// dist/server/wrangler.json output with the BACKUP_ENGINE service binding
// flipped to local mode, then runs wrangler dev against the patched config.
//
// The default `dev` flow runs `wrangler dev --remote` and the service binding
// resolves to the deployed baseout-server-dev Worker. That's perfect for most
// local work, but it means Playwright specs touching engine routes need the
// deployed engine to carry the new code AND any feature flags (e.g.
// E2E_TEST_MODE). This launcher swaps the binding to `remote: false` + the
// engine's plain local name ("baseout-server" — what `pnpm --filter
// @baseout/server dev` registers) so specs can run against a local engine
// without deploying.
//
// Why patch dist/server/wrangler.json instead of wrangler.jsonc:
//   wrangler 4 uses a redirect file (.wrangler/deploy/config.json) written
//   by @astrojs/cloudflare to route `wrangler dev` to the adapter's resolved
//   output at dist/server/wrangler.json — which is where `main`, `assets`,
//   and the fully-resolved bindings live. Editing wrangler.jsonc alone has
//   no effect on a redirected dev run.
//
// Use:
//   Terminal 1: pnpm --filter @baseout/server dev
//     (apps/server/.dev.vars must include E2E_TEST_MODE=true; see its
//      .dev.vars.example for the documented entry)
//   Terminal 2: pnpm --filter @baseout/web dev:e2e-local
//   Terminal 3: pnpm --filter @baseout/web test:e2e:local

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const SRC_DIST_CONFIG = resolve(ROOT, 'dist/server/wrangler.json')
const OUT_DIST_CONFIG = resolve(ROOT, 'dist/server/wrangler.e2e.json')

if (!existsSync(SRC_DIST_CONFIG)) {
  process.stderr.write(
    `launch-e2e: ${SRC_DIST_CONFIG} not found.\n` +
      'launch-e2e: run "pnpm --filter @baseout/web build" first ' +
      '(the dev:e2e-local script does this automatically — if you got here, ' +
      'the prepended astro build step failed; rerun and check its output).\n',
  )
  process.exit(1)
}

const config = JSON.parse(readFileSync(SRC_DIST_CONFIG, 'utf8'))

const services = Array.isArray(config.services) ? config.services : []
const backupEngine = services.find((s) => s?.binding === 'BACKUP_ENGINE')
if (!backupEngine) {
  process.stderr.write(
    'launch-e2e: BACKUP_ENGINE service binding not found in ' +
      `${SRC_DIST_CONFIG}. Did wrangler.jsonc.example change?\n`,
  )
  process.exit(1)
}

backupEngine.remote = false
// Point at the plain `pnpm --filter @baseout/server dev` worker name. The
// engine's wrangler.jsonc.example uses top-level `name: baseout-server`
// (env.dev's `baseout-server-dev` is only used when deployed via
// `--env dev`).
backupEngine.service = 'baseout-server'

// Ensure top-level vars carries E2E_TEST_MODE — wrangler.jsonc.example
// already sets it, but a safety net.
config.vars = { ...(config.vars ?? {}), E2E_TEST_MODE: 'true' }

writeFileSync(OUT_DIST_CONFIG, JSON.stringify(config, null, 2))
process.stdout.write(
  `launch-e2e: wrote ${OUT_DIST_CONFIG} with local-mode BACKUP_ENGINE binding.\n` +
    'launch-e2e: ensure `pnpm --filter @baseout/server dev` is running in ' +
    'another terminal before the spec hits an engine route.\n',
)

const args = [
  'wrangler',
  'dev',
  '--config',
  OUT_DIST_CONFIG,
  '--local-protocol',
  'https',
  '--port',
  '4331',
  '--var',
  'PUBLIC_AUTH_BASE_URL:https://localhost:4331',
]
const child = spawn('npx', args, { stdio: 'inherit', cwd: ROOT })
child.on('exit', (code) => process.exit(code ?? 0))
