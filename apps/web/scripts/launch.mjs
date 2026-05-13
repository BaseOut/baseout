import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'app-config.json');
const ENV_PATH = resolve(ROOT, '.env');
const WRANGLER_PATH = resolve(ROOT, 'wrangler.jsonc');
const WRANGLER_TEMPLATE_PATH = resolve(ROOT, 'wrangler.jsonc.example');

// RUNTIME_ENV = env vars the Astro dev server needs to start locally.
// For `build` (CF Workers Builds, CI deploys) these are runtime-only
// secrets managed by wrangler, not build-time requirements.
const RUNTIME_ENV = ['BETTER_AUTH_SECRET'];
const command = process.argv[2] || 'dev';
const isDev = command === 'dev';

// Placeholder for `hyperdrive[0].localConnectionString` when DATABASE_URL
// isn't in the env. wrangler only uses localConnectionString for local dev;
// deployed Workers connect via the Hyperdrive `id`, so a placeholder here
// doesn't affect production.
const DEV_DB_PLACEHOLDER = 'postgres://placeholder:placeholder@localhost:5432/placeholder';

function checkRequiredEnv() {
  return RUNTIME_ENV.filter((k) => !process.env[k]);
}

function renderWranglerConfig() {
  if (command !== 'dev' && command !== 'build' && command !== 'render-config') return null;
  if (!existsSync(WRANGLER_TEMPLATE_PATH)) {
    return `Missing wrangler.jsonc.example at ${WRANGLER_TEMPLATE_PATH}.`;
  }
  const dbUrl = process.env.DATABASE_URL || (isDev ? null : DEV_DB_PLACEHOLDER);
  if (!dbUrl) {
    return 'DATABASE_URL is not set. Copy .env.example to .env and fill in a real Postgres URL.';
  }
  const template = readFileSync(WRANGLER_TEMPLATE_PATH, 'utf8');
  const rendered = template.replaceAll('{{DATABASE_URL}}', dbUrl);
  writeFileSync(WRANGLER_PATH, rendered);
  return null;
}

async function main() {
  // Only gate on env vars for `dev`. `build` in CI gets secrets at runtime
  // via wrangler, not at build time.
  if (isDev) {
    const missingEnv = checkRequiredEnv();
    if (missingEnv.length > 0) {
      console.error('');
      console.error('  Missing required environment variables for dev:');
      missingEnv.forEach((k) => console.error(`    - ${k}`));
      if (!existsSync(ENV_PATH)) {
        console.error('');
        console.error('  No .env file found. Run: cp .env.example .env');
      }
      console.error('');
      process.exit(1);
    }
  }

  const wranglerError = renderWranglerConfig();
  if (wranglerError) {
    console.error('');
    console.error(`  ${wranglerError}`);
    console.error('');
    process.exit(1);
  }

  // CI uses render-config to produce wrangler.jsonc for `wrangler types`
  // without spawning astro. The renderer above is the only step needed.
  if (command === 'render-config') return;

  // Setup wizard is interactive and only useful on first local run.
  // In CI, app-config.json must already be committed.
  if (!existsSync(CONFIG_PATH)) {
    if (!isDev) {
      console.error('\n  app-config.json is missing. It must be committed for non-dev builds.\n');
      process.exit(1);
    }
    console.log('\n  No app-config.json found. Running setup wizard...\n');
    await import('./setup.mjs');
  }

  if (!existsSync(CONFIG_PATH)) {
    console.error('\n  Setup was not completed. Exiting.\n');
    process.exit(1);
  }

  // Bail early on migration drift — every other major change has broken the
  // dev loop by shipping schema-aware code without applying the matching
  // migration. The check is silent when in sync and prints the exact fix
  // command otherwise. Dev-only — `build` runs in CI without a master DB.
  if (isDev) {
    const driftCheck = spawn(
      'node',
      ['--env-file-if-exists=.env', 'scripts/check-migrations.mjs'],
      { stdio: 'inherit', shell: true, cwd: ROOT },
    );
    await new Promise((resolveProc, rejectProc) => {
      driftCheck.on('exit', (code) => {
        if (code === 0) resolveProc();
        else process.exit(code ?? 1);
      });
      driftCheck.on('error', rejectProc);
    });
  }

  const child = spawn('npx', ['astro', command], {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
