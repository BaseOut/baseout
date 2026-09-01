import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Dev/build runner for apps/admin (generalizes the old dev.mjs, mirroring
// apps/web/scripts/launch.mjs).
//
// Renders wrangler.jsonc from wrangler.jsonc.example (substituting DATABASE_URL
// from .env into the Hyperdrive localConnectionString), then runs astro.
//
//   node scripts/launch.mjs dev     astro dev on baseout.local:4333
//   node scripts/launch.mjs build   astro build (adapter emits dist/server/wrangler.json)
//
// SSR runs in a workerd runner, so the master DB is reached via the Hyperdrive
// binding the way apps/web does — a direct postgres-js connection from workerd
// does not work. For `build`, DATABASE_URL may be absent (CI / deploy): the
// localConnectionString gets a placeholder, which is fine because deployed
// Workers connect via the Hyperdrive `id`, never localConnectionString.

const ROOT = resolve(import.meta.dirname, '..');
const ASTRO = resolve(ROOT, 'node_modules/astro/bin/astro.mjs');

const command = process.argv[2] || 'dev';
const isDev = command === 'dev';

// wrangler.jsonc is COMMITTED and authoritative — nothing renders it. The local
// Postgres string for Hyperdrive emulation arrives as
// CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE from .dev.vars (this
// script is launched with `node --env-file-if-exists=.dev.vars`, so Node puts it
// in process.env and the spawned astro/wrangler inherits it).
if (isDev && !process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
  console.warn(
    '\n  ! CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE is not set.' +
      '\n    Add it to apps/admin/.dev.vars or every DB query will fail.\n',
  );
}

// The Astro Cloudflare adapter flattens exactly ONE named env into
// dist/server/wrangler.json, chosen by CLOUDFLARE_ENV. wrangler.jsonc's top level
// carries no bindings (non-inheritable), so an unset CLOUDFLARE_ENV silently
// produces a Worker with no Hyperdrive, no KV and no service binding.
const VALID_ENVS = ['dev', 'staging', 'production'];
if (command === 'build') {
  const env = process.env.CLOUDFLARE_ENV;
  if (!env || !VALID_ENVS.includes(env)) {
    console.error(
      `\n  CLOUDFLARE_ENV must be one of: ${VALID_ENVS.join(', ')} (got ${env ?? 'unset'}).` +
        '\n  e.g. CLOUDFLARE_ENV=dev pnpm run build\n',
    );
    process.exit(1);
  }
}

// render-config no longer renders anything; kept as a no-op so any caller
// (typegen, CI) keeps working.
if (command === 'render-config') process.exit(0);


// The adapter emits dist/server/wrangler.json but DROPS `secrets`, and every
// deploy resolves through it via the .wrangler/deploy/config.json redirect — so
// the deploy-time "required secret missing" gate would be silently inert.
// Copy-if-absent only: the adapter TRANSFORMS main/assets paths (relative to
// dist/server/), so overwriting them would break the deploy.
const BUILD_OWNED_KEYS = ['main', 'assets', 'rules', 'no_bundle', 'name'];

function stripJsonc(src) {
  let out = '', inStr = false, esc = false, i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function propagateSourceEnvKeys() {
  const generated = resolve(ROOT, 'dist/server/wrangler.json');
  const source = resolve(ROOT, 'wrangler.jsonc');
  if (!existsSync(generated) || !existsSync(source)) return;
  const env = process.env.CLOUDFLARE_ENV;
  const src = JSON.parse(stripJsonc(readFileSync(source, 'utf8')));
  const sourceEnv = src.env?.[env];
  if (!sourceEnv) return;
  const gen = JSON.parse(readFileSync(generated, 'utf8'));
  const copied = [];
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (BUILD_OWNED_KEYS.includes(key) || key in gen) continue;
    gen[key] = value;
    copied.push(key);
  }
  if (!copied.length) return;
  writeFileSync(generated, JSON.stringify(gen));
  console.log(`  \u2713 carried env.${env} keys into dist/server/wrangler.json: ${copied.join(', ')}`);
}

const child = spawn('node', [ASTRO, command], { stdio: 'inherit', shell: false, cwd: ROOT });
child.on('exit', (code) => {
  if (code === 0 && command === 'build') propagateSourceEnvKeys();
  process.exit(code ?? 0);
});
