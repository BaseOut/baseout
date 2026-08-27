#!/usr/bin/env node
/**
 * support-snapshots — screenshot the LIVE public support portal.
 *
 * Phase 2 of the docs-automation program (plans/2026-08-26-support-docs-automation.md).
 * The portal is public (no auth, no secrets — Dan, 2026-08-26), so shots are
 * taken straight off the deployed site. Output goes to apps/support/snapshots/
 * (gitignored — regenerate on demand; docs embed curated copies through
 * components/markdoc/Screenshot.astro when a page wants one).
 *
 * Usage:
 *   node scripts/support-snapshots.mjs                 # manifest routes, both viewports
 *   node scripts/support-snapshots.mjs --base <url>    # e.g. a local astro preview
 *   node scripts/support-snapshots.mjs --route /contact/   # one route only
 *
 * Uses apps/web's @playwright/test install (chromium already provisioned for
 * the web E2E suite) — no new dependency.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const require = createRequire(join(ROOT, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = argOf('--base') ?? 'https://support.baseout.com';
const ONLY = argOf('--route');

// The demo set: one representative of each surface. Extend as docs need shots.
const ROUTES = [
  '/',
  '/start/getting-started/',
  '/platforms/airtable/what-we-back-up/',
  '/changelog/',
  '/contact/',
  '/requests/',
  '/roadmap/',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const OUT = join(ROOT, 'apps/support/snapshots');
mkdirSync(OUT, { recursive: true });

const slug = (route) => (route === '/' ? 'landing' : route.replace(/^\/|\/$/g, '').replace(/\//g, '--'));

const browser = await chromium.launch();
let shot = 0;
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    for (const route of ROUTES) {
      if (ONLY && route !== ONLY) continue;
      const url = new URL(route, BASE).href;
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!res || !res.ok()) {
        console.error(`SKIP ${url} — HTTP ${res ? res.status() : 'no response'}`);
        continue;
      }
      const file = join(OUT, `${slug(route)}.${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${file}`);
      shot++;
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`${shot} snapshot(s) → ${OUT}`);
if (shot === 0) process.exit(1);
