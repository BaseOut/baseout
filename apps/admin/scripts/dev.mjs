import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Dev runner for apps/admin.
//
// Renders wrangler.jsonc from wrangler.jsonc.example (substituting DATABASE_URL
// from .env into the Hyperdrive localConnectionString), then runs `astro dev`.
// SSR runs in a workerd runner, so the master DB is reached via the Hyperdrive
// binding the way apps/web does — a direct postgres-js connection from workerd
// does not work. astro.config.mjs pins the host/port (baseout.local:4332) so
// the better-auth session cookie set by apps/web is shared.

const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATE = resolve(ROOT, 'wrangler.jsonc.example');
const OUT = resolve(ROOT, 'wrangler.jsonc');
const ASTRO = resolve(ROOT, 'node_modules/astro/bin/astro.mjs');

const dbUrl = process.env.DATABASE_URL;
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

const child = spawn('node', [ASTRO, 'dev'], { stdio: 'inherit', shell: false, cwd: ROOT });
child.on('exit', (code) => process.exit(code ?? 0));
