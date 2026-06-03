import { existsSync } from 'node:fs';
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

async function main() {
  await ensureHostsEntry();

  // Reuse launch.mjs for env gating, wrangler.jsonc render, setup wizard,
  // migration-drift check, and the astro build.
  await run('node', ['--env-file-if-exists=.env', 'scripts/launch.mjs', 'build', 'local']);

  const wranglerArgs = [
    'dev',
    '--remote',
    '--local-protocol',
    'https',
    '--port',
    '4331',
    '--var',
    'PUBLIC_AUTH_BASE_URL:https://baseout.local:4331',
  ];

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
