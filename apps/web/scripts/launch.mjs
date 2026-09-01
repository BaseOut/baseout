import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'app-config.json');
const ENV_PATH = resolve(ROOT, '.env');

// RUNTIME_ENV = env vars the Astro dev server needs to start locally.
// For `build` (CF Workers Builds, CI deploys) these are runtime-only
// secrets managed by wrangler, not build-time requirements.
const RUNTIME_ENV = ['BETTER_AUTH_SECRET'];
const command = process.argv[2] || 'dev';
const isDev = command === 'dev';


function checkRequiredEnv() {
  return RUNTIME_ENV.filter((k) => !process.env[k]);
}

// The Astro Cloudflare adapter flattens exactly ONE named env into
// dist/server/wrangler.json, chosen by CLOUDFLARE_ENV. wrangler.jsonc's top
// level carries no bindings (they are non-inheritable — see root CLAUDE.md and
// the config header), so an unset CLOUDFLARE_ENV silently produces a Worker
// with no Hyperdrive, no KV, no service binding and no vars. That is a
// deploy-shaped disaster, not a dev annoyance, so fail loudly instead.
const VALID_ENVS = ['dev', 'staging', 'production'];
function checkCloudflareEnv() {
  if (command !== 'build') return null;
  const env = process.env.CLOUDFLARE_ENV;
  if (!env) {
    return (
      'CLOUDFLARE_ENV is not set. It selects which env block the adapter bakes\n' +
      `  into dist/server/wrangler.json. Use one of: ${VALID_ENVS.join(', ')}.\n` +
      '  e.g. CLOUDFLARE_ENV=dev pnpm run build'
    );
  }
  if (!VALID_ENVS.includes(env)) {
    return `CLOUDFLARE_ENV="${env}" is not one of: ${VALID_ENVS.join(', ')}.`;
  }
  return null;
}


// ── Carry source env.<CLOUDFLARE_ENV> keys into the generated config ────────
// @cloudflare/vite-plugin emits dist/server/wrangler.json by flattening
// wrangler.jsonc's selected env. That flattening is faithful for bindings and
// vars (verified key-by-key), but it DROPS `secrets` — it parses the field (it
// uses config.secrets.required to filter local dev vars) and simply never
// serializes it. Every deploy resolves through the generated file via the
// .wrangler/deploy/config.json redirect, so the deploy-time gate ("fail if a
// required secret isn't set on the Worker") would be silently inert.
//
// This copies any key present in source env.<env> but MISSING from the
// generated config. COPY-IF-ABSENT, never overwrite: the adapter TRANSFORMS
// some values — `main` becomes "entry.mjs" and `assets.directory` becomes
// "../client", both relative to dist/server/ — so clobbering them with
// source-relative paths would produce a broken deploy. Today this copies
// `secrets` and nothing else; the general form means a future plugin omission
// is carried automatically instead of going unnoticed.
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

// Keys the BUILD owns. Never copy these from source even if absent, because
// their generated values are relative to dist/server/ rather than the app root.
const BUILD_OWNED_KEYS = ['main', 'assets', 'rules', 'no_bundle', 'name'];

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
    if (BUILD_OWNED_KEYS.includes(key)) continue;
    if (key in gen) continue; // adapter already flattened it — leave it alone
    gen[key] = value;
    copied.push(key);
  }
  if (!copied.length) return;

  writeFileSync(generated, JSON.stringify(gen));
  console.log(
    `  \u2713 carried env.${env} keys into dist/server/wrangler.json: ${copied.join(', ')}`,
  );
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

  const envError = checkCloudflareEnv();
  if (envError) {
    console.error('');
    console.error(`  ${envError}`);
    console.error('');
    process.exit(1);
  }

  // `render-config` used to generate wrangler.jsonc from a .example template.
  // wrangler.jsonc is now committed and authoritative, so there is nothing to
  // render — the command is kept as a no-op so existing scripts and CI steps
  // (notably `pretypecheck`, which runs it before `wrangler types`) keep working.
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
      ['--env-file-if-exists=.dev.vars', '../../db/scripts/check-migrations.mjs'],
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

  child.on('exit', (code) => {
    if (code === 0 && command === 'build') propagateSourceEnvKeys();
    process.exit(code ?? 0);
  });
}

main();
