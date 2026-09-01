import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { lookup } from 'node:dns/promises';

// Dev runner for apps/web.
//
// Canonical dev URL is https://baseout.local:4331 — the single origin that
// supports both magic-link login and Airtable OAuth Connect (Airtable's
// redirect URI is registered only for baseout.local, per
// shared/internal/oauth-setup.md §3). PUBLIC_AUTH_BASE_URL is pinned to it
// because the worker's Host header is unreliable under `wrangler dev
// --remote` (it reports the *.workers.dev edge host), so Better Auth cannot
// infer the browser origin per-request.
//
// wrangler's auto-generated self-signed cert only covers `localhost`, so
// `https://baseout.local:4331` shows a browser warning. If a locally-trusted
// cert exists (generate with `pnpm setup:certs`), pass it to wrangler so the
// canonical URL loads cleanly; otherwise fall back to the self-signed cert
// (login still works — the session cookie is non-Secure in local dev — but
// the browser shows a one-time warning).

const ROOT = resolve(import.meta.dirname, '..');
const CERT = resolve(ROOT, '.certs/baseout.local.pem');
const KEY = resolve(ROOT, '.certs/baseout.local-key.pem');
const PORT = 4331;
const APP_URL = `https://baseout.local:${PORT}`;

// Poll the local port until wrangler's dev proxy accepts connections.
// wrangler binds and prints `localhost`, but the app is configured for
// baseout.local (PUBLIC_AUTH_BASE_URL) and login only works there — so once
// the server is up we open baseout.local, not the localhost line wrangler
// prints. Set BASEOUT_DEV_NO_OPEN=1 to skip the auto-open.
function waitForPort(port, host = '127.0.0.1', timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolveReady, rejectReady) => {
    const tryOnce = () => {
      const socket = connect({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolveReady();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) rejectReady(new Error('timeout'));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

// Fail fast (before the astro build) if baseout.local isn't mapped to a
// loopback address. Everything keys off this hostname — without the
// /etc/hosts entry the browser can't reach the dev server and the auto-open
// below would dead-end. Resolution goes through the OS resolver, which
// honours /etc/hosts.
async function ensureHostsEntry() {
  let address;
  try {
    ({ address } = await lookup('baseout.local'));
  } catch {
    address = null;
  }
  const isLoopback = address === '127.0.0.1' || address === '::1';
  if (isLoopback) return;

  console.error('');
  console.error('  baseout.local does not resolve to a loopback address.');
  console.error(
    address
      ? `  It currently resolves to ${address} — expected 127.0.0.1.`
      : '  It is not in /etc/hosts.',
  );
  console.error('  https://baseout.local:4331 is the canonical dev URL — add the mapping:');
  console.error('');
  console.error('    pnpm --filter @baseout/web setup:hosts        # one-liner (uses sudo)');
  console.error("    # or manually:  echo '127.0.0.1 baseout.local' | sudo tee -a /etc/hosts");
  console.error('');
  process.exit(1);
}

function run(cmd, args) {
  return new Promise((resolveProc, rejectProc) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT });
    child.on('exit', (code) => (code === 0 ? resolveProc() : process.exit(code ?? 1)));
    child.on('error', rejectProc);
  });
}

/**
 * Copy dist/client → dist/client-stable and retarget dist/server/wrangler.json
 * assets.directory. Keeps wrangler --remote restarts from ENOENT when Astro
 * deletes dist/client mid-rebuild (common when a second `pnpm web dev` or an
 * editor save races the running preview).
 */
function stabilizeClientAssets() {
  const client = resolve(ROOT, 'dist/client');
  const stable = resolve(ROOT, 'dist/client-stable');
  const wranglerConfig = resolve(ROOT, 'dist/server/wrangler.json');

  if (!existsSync(client)) {
    console.error('');
    console.error('  dist/client missing after build — cannot start wrangler.');
    console.error('');
    process.exit(1);
  }

  rmSync(stable, { recursive: true, force: true });
  mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
  cpSync(client, stable, { recursive: true });

  if (!existsSync(wranglerConfig)) {
    console.error('');
    console.error('  dist/server/wrangler.json missing after build.');
    console.error('');
    process.exit(1);
  }

  const cfg = JSON.parse(readFileSync(wranglerConfig, 'utf8'));
  if (!cfg.assets) cfg.assets = {};
  cfg.assets.directory = '../client-stable';

  // LOCAL mode (the default): drop `remote: true` from BACKUP_ENGINE so
  // apps/web talks to a LOCAL `wrangler dev` engine over the dev registry instead
  // of the deployed sibling. This used to be a regex on the RENDERED wrangler.jsonc;
  // that file is now committed and authoritative, so the tweak belongs here — on
  // the adapter's throwaway dist output, alongside the assets retarget. CI and the
  // `wrangler` npm scripts never reach this path, so `remote: true` is preserved
  // for them and can never leak into a deploy.
  if (process.env.BACKUP_LOCAL_ENGINE === '1') {
    for (const svc of cfg.services ?? []) delete svc.remote;
    console.log('  ✓ BACKUP_ENGINE bound to the LOCAL engine (remote flag dropped).');
  }

  writeFileSync(wranglerConfig, JSON.stringify(cfg));
  console.log('  ✓ Assets snapshotted to dist/client-stable (wrangler ENOENT guard).');
}

async function main() {
  await ensureHostsEntry();

  // `pnpm dev` is LOCAL by default: Miniflare simulates KV, Hyperdrive and the
  // rest, so no Cloudflare auth is needed and nothing touches real resources.
  //
  // `pnpm dev:remote` (DEV_REMOTE=1) runs `wrangler dev --remote` instead: the
  // worker executes on Cloudflare's edge against REAL bindings. The reason to
  // want that is the `send_email` binding — Miniflare cannot send at all, so
  // magic-link LOGIN EMAILS are only delivered in remote mode. It requires a
  // valid `wrangler login` / CLOUDFLARE_API_TOKEN for the account owning the
  // dev KV + Hyperdrive ids in wrangler.jsonc.
  //
  // The `--var` below pins PUBLIC_AUTH_BASE_URL to https://baseout.local:4331
  // in both modes, so any emitted link targets your local dev server.
  const useRemoteEngine = process.env.DEV_REMOTE === '1';

  // Signal stabilizeClientAssets() to strip `"remote": true` from the ADAPTER'S
  // dist/server/wrangler.json so it matches our --remote choice. ONLY dev.mjs sets
  // this, so the `wrangler` npm scripts and CI/deploy builds never strip
  // (deploy-safe). The committed wrangler.jsonc is never touched.
  process.env.BACKUP_LOCAL_ENGINE = useRemoteEngine ? '0' : '1';

  // Reuse launch.mjs for env gating, setup wizard, migration-drift check, and
  // the astro build. (It no longer renders wrangler.jsonc — that file is
  // committed and authoritative.)
  // CLOUDFLARE_ENV picks WHICH named env the Astro adapter flattens into
  // dist/server/wrangler.json. wrangler.jsonc's top level holds no bindings by
  // design (they are non-inheritable and live in env.dev/staging/production), so
  // without this the dev worker would start with no DB, no KV and no engine.
  process.env.CLOUDFLARE_ENV ??= 'dev';
  await run('node', ['--env-file-if-exists=.dev.vars', 'scripts/launch.mjs', 'build', 'local']);

  // wrangler `dev --remote` restarts on file changes and scandirs the assets
  // directory. Astro's rebuild briefly deletes `dist/client` mid-restart →
  // ENOENT crash. Snapshot client assets to a stable dir and point the
  // generated wrangler config at it so a concurrent wipe of `dist/client`
  // cannot take the preview down.
  stabilizeClientAssets();

  const wranglerArgs = [
    'dev',
    ...(useRemoteEngine ? ['--remote'] : []),
    '--config',
    'dist/server/wrangler.json',
    '--local-protocol',
    'https',
    '--port',
    '4331',
    '--var',
    'PUBLIC_AUTH_BASE_URL:https://baseout.local:4331',
  ];

  if (useRemoteEngine) {
    console.log('');
    console.log('  \u2691 --remote (DEV_REMOTE=1): worker runs on Cloudflare\'s edge against REAL');
    console.log('    bindings — real KV, real Hyperdrive, real send_email. Requires Cloudflare');
    console.log('    auth for the account owning the ids in wrangler.jsonc (try `cfuse <acct>`).');
    console.log('    This is the only mode that delivers magic-link LOGIN EMAILS.');
  } else {
    console.log('');
    console.log('  \u2691 LOCAL mode (default) — Miniflare simulates KV/Hyperdrive; no Cloudflare auth.');
    console.log('    web binds to a LOCAL engine over the dev registry (remote flag stripped).');
    console.log('    \u26a0 magic-link LOGIN EMAIL is NOT delivered here — Miniflare cannot send.');
    console.log('    For login email, use: pnpm --filter @baseout/web run dev:remote');
    console.log('    `pnpm dev` (repo root) also starts the engine + trigger.dev runner.');
    console.log('    Runner env must point BACKUP_ENGINE_URL at http://localhost:8787 with a');
    console.log('    matching INTERNAL_TOKEN (apps/workflows/.env). See ops-setup.md §7.4.');
  }

  const hasTrustedCert = existsSync(CERT) && existsSync(KEY);
  if (hasTrustedCert) {
    wranglerArgs.push('--https-cert-path', '.certs/baseout.local.pem');
    wranglerArgs.push('--https-key-path', '.certs/baseout.local-key.pem');
  } else {
    console.log('');
    console.log('  No trusted cert at .certs/ — using wrangler self-signed (browser will warn).');
    console.log('  Run `pnpm setup:certs` once for a clean https://baseout.local:4331.');
    console.log('');
  }

  console.log('');
  console.log('  ────────────────────────────────────────────────────────────');
  console.log(`  ▶  Open ${APP_URL}`);
  console.log('     NOT localhost — login only works on baseout.local.');
  console.log('     Same server, resolved via /etc/hosts; wrangler still');
  console.log('     prints its localhost bind address below.');
  console.log('  ────────────────────────────────────────────────────────────');
  console.log('');

  // Local Hyperdrive emulation needs a real Postgres connection string. It comes
  // from CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE in .dev.vars —
  // this script is launched with `node --env-file-if-exists=.dev.vars`, so Node
  // puts it in process.env and the spawned wrangler inherits it. No mapping code:
  // the variable is simply named what wrangler looks for.
  //
  // NOTE: apps/web itself never needs DATABASE_URL. The Worker reaches Postgres
  // only through the HYPERDRIVE binding; DATABASE_URL belongs to the migration
  // runner (@baseout/db) and the diag scripts.
  if (!process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
    console.warn('');
    console.warn('  ! CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE is not set.');
    console.warn('    Hyperdrive will fall back to the placeholder in wrangler.jsonc and');
    console.warn('    every DB query will fail. Add it to apps/web/.dev.vars.');
    console.warn('');
  }

  const child = spawn('npx', ['wrangler', ...wranglerArgs], {
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
  });
  child.on('exit', (code) => process.exit(code ?? 0));

  // Auto-open baseout.local once the dev proxy is accepting connections, so
  // `pnpm run dev` lands on the canonical URL rather than the localhost trap.
  if (process.platform === 'darwin' && process.env.BASEOUT_DEV_NO_OPEN !== '1') {
    waitForPort(PORT)
      .then(() => spawn('open', [APP_URL], { stdio: 'ignore', detached: true }))
      .catch(() => {
        /* server never came up in time — the banner above still points the way */
      });
  }
}

main();
