#!/usr/bin/env node
/**
 * support-docs-register — the freshness gate for the support portal docs.
 *
 * Every docs page under apps/support/src/content/docs may declare a `sources:`
 * list in its frontmatter (see the schema comment in
 * apps/support/src/content.config.ts): repo-relative paths whose behavior the
 * page documents. This script compares git history on both sides:
 *
 *   stale     — a source has a commit NEWER than the page's last commit.
 *               The code moved after the prose did; the page needs a review
 *               (the /support-docs-update skill is the reviewer).
 *   missing   — a declared source path no longer exists in the tree. Either
 *               the code moved (re-point the frontmatter) or the feature is
 *               gone (rewrite the page). Always an error.
 *   unmapped  — the page declares no sources. Coverage debt, not an error:
 *               pages are seeded as they are touched.
 *
 * Modes:
 *   node scripts/support-docs-register.mjs           full register report
 *   node scripts/support-docs-register.mjs --check   exit 1 on stale/missing
 *   node scripts/support-docs-register.mjs --json    machine-readable output
 *
 * Derived live from git each run — nothing is committed, so there is no
 * second artifact to drift (contrast the fork's edge-register.mjs, which
 * commits its output and needs its own --check).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIR = 'apps/support/src/content/docs';

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** Last commit unix-ts touching a path, or null if never committed. */
function lastCommitTs(path) {
  const out = git('log', '-1', '--format=%ct', '--', path);
  return out ? Number(out) : null;
}

/** Newest commit under a path since a given ts — hash + subject, or null. */
function newestCommitSince(path, sinceTs) {
  const out = git(
    'log',
    '-1',
    '--format=%h %ct %s',
    `--since=${sinceTs + 1}`,
    '--',
    path,
  );
  if (!out) return null;
  const [hash, ct, ...subject] = out.split(' ');
  return { hash, ts: Number(ct), subject: subject.join(' ') };
}

/**
 * Minimal frontmatter `sources:` extraction. The frontmatter is YAML, but the
 * only shape this field takes is a plain block list of strings (enforced by
 * the zod schema at build time — z.array(z.string())), so a full YAML parser
 * is not needed and not worth a dependency in a repo script.
 */
function parseSources(fileText) {
  const m = fileText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return [];
  const lines = m[1].split(/\r?\n/);
  const sources = [];
  let inSources = false;
  for (const line of lines) {
    if (/^sources:\s*$/.test(line)) {
      inSources = true;
      continue;
    }
    if (inSources) {
      const item = line.match(/^\s+-\s+(.+?)\s*$/);
      if (item) sources.push(item[1].replace(/^['"]|['"]$/g, ''));
      else if (!/^\s/.test(line)) inSources = false;
    }
  }
  return sources;
}

const pageFiles = git('ls-files', '--', `${DOCS_DIR}/**`)
  .split('\n')
  .filter((f) => /\.(md|mdx|mdoc)$/.test(f));

const mapped = [];
const unmapped = [];
const stale = [];
const missing = [];

for (const page of pageFiles) {
  const sources = parseSources(readFileSync(join(ROOT, page), 'utf8'));
  if (!sources.length) {
    unmapped.push(page);
    continue;
  }
  const pageTs = lastCommitTs(page);
  const entry = { page, sources, staleAgainst: [] };
  for (const src of sources) {
    if (!existsSync(join(ROOT, src))) {
      missing.push({ page, source: src });
      continue;
    }
    const newer = pageTs !== null ? newestCommitSince(src, pageTs) : null;
    if (newer) entry.staleAgainst.push({ source: src, ...newer });
  }
  mapped.push(entry);
  if (entry.staleAgainst.length) stale.push(entry);
}

const json = process.argv.includes('--json');
const check = process.argv.includes('--check');

if (json) {
  console.log(JSON.stringify({ mapped, unmapped, stale, missing }, null, 2));
} else {
  console.log(`Docs register — ${pageFiles.length} pages, ${mapped.length} mapped, ${unmapped.length} unmapped\n`);
  if (missing.length) {
    console.log('MISSING SOURCES (fix the frontmatter or rewrite the page):');
    for (const m of missing) console.log(`  ${m.page}\n    ✗ ${m.source}`);
    console.log('');
  }
  if (stale.length) {
    console.log('STALE (code moved after the prose — run /support-docs-update):');
    for (const e of stale) {
      console.log(`  ${e.page}`);
      for (const s of e.staleAgainst) {
        console.log(`    ← ${s.source}`);
        console.log(`      ${s.hash} ${s.subject}`);
      }
    }
    console.log('');
  }
  if (!stale.length && !missing.length) {
    console.log('All mapped pages are fresh.');
  }
  if (unmapped.length && !check) {
    console.log(`\nUnmapped pages (coverage debt — seed \`sources:\` as they are touched):`);
    for (const p of unmapped) console.log(`  ${relative(DOCS_DIR, p)}`);
  }
}

if (check && (stale.length || missing.length)) process.exit(1);
