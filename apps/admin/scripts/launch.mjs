import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Dev/build runner for apps/admin (generalizes the old dev.mjs, mirroring
// apps/web/scripts/launch.mjs).
//
// Renders wrangler.jsonc from wrangler.jsonc.example (substituting DATABASE_URL
// from .env into the Hyperdrive localConnectionString), then runs astro.
//
//   node scripts/launch.mjs dev     astro dev on baseout.local:4332
//   node scripts/launch.mjs build   astro build (adapter emits dist/server/wrangler.json)
//
// SSR runs in a workerd runner, so the master DB is reached via the Hyperdrive
// binding the way apps/web does — a direct postgres-js connection from workerd
// does not work. For `build`, DATABASE_URL may be absent (CI / deploy): the
// localConnectionString gets a placeholder, which is fine because deployed
// Workers connect via the Hyperdrive `id`, never localConnectionString.

const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATE = resolve(ROOT, 'wrangler.jsonc.example');
const OUT = resolve(ROOT, 'wrangler.jsonc');
const ASTRO = resolve(ROOT, 'node_modules/astro/bin/astro.mjs');

const command = process.argv[2] || 'dev';
const isDev = command === 'dev';

const DEV_DB_PLACEHOLDER = 'postgres://placeholder:placeholder@localhost:5432/placeholder';

const dbUrl = process.env.DATABASE_URL || (isDev ? null : DEV_DB_PLACEHOLDER);
if (!dbUrl) {
  console.error('\n  DATABASE_URL is not set. Run: cp .env.example .env');
  console.error('  then paste the DATABASE_URL from apps/web/.env into apps/admin/.env\n');
  process.exit(1);
}

if (!existsSync(TEMPLATE)) {
  console.error(`\n  Missing ${TEMPLATE}\n`);
  process.exit(1);
}

writeFileSync(OUT, readFileSync(TEMPLATE, 'utf8').replaceAll('{{DATABASE_URL}}', dbUrl));

const child = spawn('node', [ASTRO, command], { stdio: 'inherit', shell: false, cwd: ROOT });
child.on('exit', (code) => process.exit(code ?? 0));
