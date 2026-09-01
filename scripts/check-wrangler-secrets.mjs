#!/usr/bin/env node
// Asserts that every app's `secrets.required` list is byte-identical across all
// DEPLOYED envs (staging + production), and that env.dev declares none.
//
// Why this exists: wrangler classifies `secrets` as a NOT-INHERITED field
// (see notInheritable() in wrangler-dist/cli.js — it sits beside `vars`), so a
// single top-level block validates nothing on a `--env` deploy and only emits
// a warning. The list therefore has to be restated per env, which reintroduces
// drift risk: a secret added to staging but forgotten in production would let
// production deploy without it. This check is the replacement for inheritance.
//
// Usage: node scripts/check-wrangler-secrets.mjs [--file wrangler.jsonc]
// Exits non-zero on drift. Wire into CI next to `lat check` / typecheck.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DEPLOYED = ['staging', 'production'];
// Migration-aware. An app still being drafted has BOTH files: new.wrangler.jsonc
// (the intended 3-env state) and wrangler.jsonc (the legacy pre-migration one).
// A promoted app has only wrangler.jsonc. So new.* WINS when present — otherwise
// this checks the very config the migration is replacing.
const fileArg = process.argv.indexOf('--file');
const FORCED = fileArg > -1 ? process.argv[fileArg + 1] : null;
const CANDIDATES = FORCED ? [FORCED] : ['new.wrangler.jsonc', 'wrangler.jsonc'];
function configFor(app) {
  for (const name of CANDIDATES) {
    const p = join(REPO, 'apps', app, name);
    if (existsSync(p)) return { name, path: p };
  }
  return null;
}

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

let failures = 0;
const apps = readdirSync(join(REPO, 'apps')).filter(a => configFor(a));

for (const app of apps) {
  const cfg = JSON.parse(stripJsonc(readFileSync(configFor(app).path, 'utf8')));
  const envs = cfg.env ?? {};
  const lists = {};
  for (const e of DEPLOYED) {
    if (!envs[e]) { console.error(`✗ ${app}: env.${e} is missing`); failures++; continue; }
    lists[e] = envs[e].secrets?.required ?? null;
  }

  // dev must not declare a list — dev secrets come from .dev.vars, ungated.
  if (envs.dev?.secrets) {
    console.error(`✗ ${app}: env.dev declares secrets.required — dev secrets belong in .dev.vars only`);
    failures++;
  }
  // `name` must live ONLY at the top level so script names are DERIVED as
  // <name>-<env>. An explicit env-level name overrides the derivation and
  // decouples the script from the service bindings that reference it.
  for (const e of ['dev', 'staging', 'production']) {
    if (envs[e]?.name) {
      console.error(`✗ ${app}: env.${e} declares "name": "${envs[e].name}" — remove it; the script name is derived as ${cfg.name}-${e}`);
      failures++;
    }
  }
  if (!cfg.name) { console.error(`✗ ${app}: no top-level "name" — nothing to derive env script names from`); failures++; }

  // a top-level block would warn on every --env deploy and gate nothing.
  if (cfg.secrets) {
    console.error(`✗ ${app}: top-level "secrets" is not inherited by envs — move it into each deployed env`);
    failures++;
  }

  const present = DEPLOYED.filter(e => Array.isArray(lists[e]));
  if (!present.length) { console.log(`· ${app}: no secrets.required in any deployed env (ok if the Worker needs none)`); continue; }
  if (present.length !== DEPLOYED.length) {
    console.error(`✗ ${app}: secrets.required declared in ${present.join(',')} but not ${DEPLOYED.filter(e => !present.includes(e)).join(',')}`);
    failures++;
    continue;
  }

  const [a, b] = DEPLOYED;
  const setA = new Set(lists[a]), setB = new Set(lists[b]);
  const onlyA = lists[a].filter(k => !setB.has(k));
  const onlyB = lists[b].filter(k => !setA.has(k));
  if (onlyA.length || onlyB.length) {
    console.error(`✗ ${app}: secrets.required drift`);
    if (onlyA.length) console.error(`    only in ${a}: ${onlyA.join(', ')}`);
    if (onlyB.length) console.error(`    only in ${b}: ${onlyB.join(', ')}   ← would deploy without these`);
    failures++;
    continue;
  }
  const dupes = lists[a].filter((k, i) => lists[a].indexOf(k) !== i);
  if (dupes.length) { console.error(`✗ ${app}: duplicate entries: ${dupes.join(', ')}`); failures++; continue; }
  const sorted = [...lists[a]].sort();
  const sortWarn = lists[a].join() !== sorted.join() ? '  (not alphabetised)' : '';
  console.log(`✓ ${app}: ${lists[a].length} secrets, identical in ${DEPLOYED.join(' + ')}${sortWarn}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-app service-binding resolution.
//
// `services` is non-inheritable, so every env names its own target — which means
// a producer's `service` string and the target's `env.<x>.name` are maintained by
// hand and can drift. A wrong name does NOT fail the deploy: the binding is
// simply unbound and .fetch() returns 403 at runtime.
//
// Note on naming: when an env block omits `name`, wrangler derives the script
// name as `<top-level name>-<env name>` (see appendEnvName in wrangler's source,
// and the "<worker-name>-<environment-name>" note in the services schema). An
// explicit `name` in the env block wins. This resolver models both.
// ─────────────────────────────────────────────────────────────────────────────

const ENVS = ['dev', 'staging', 'production'];
const scriptNames = {};   // env -> Map<scriptName, app>
for (const e of ENVS) scriptNames[e] = new Map();

const configs = {};
for (const app of apps) {
  const cfg = JSON.parse(stripJsonc(readFileSync(configFor(app).path, 'utf8')));
  configs[app] = cfg;
  for (const e of ENVS) {
    const envBlock = cfg.env?.[e];
    if (!envBlock) continue;
    const name = envBlock.name ?? (cfg.name ? `${cfg.name}-${e}` : null);
    if (name) scriptNames[e].set(name, `${app}${envBlock.name ? '' : ' (derived)'}`);
  }
}

let refFailures = 0;
for (const app of apps) {
  for (const e of ENVS) {
    for (const svc of configs[app].env?.[e]?.services ?? []) {
      const target = scriptNames[e].get(svc.service);
      if (target) {
        console.log(`✓ ${app}.${e}: ${svc.binding} -> ${svc.service} (apps/${target.split(' ')[0]}.${e})`);
      } else {
        // is it a name that belongs to a DIFFERENT env? that is the classic slip
        const wrongEnv = ENVS.filter(o => o !== e && scriptNames[o].has(svc.service));
        console.error(`✗ ${app}.${e}: ${svc.binding} -> "${svc.service}" matches no env.${e} script name`);
        if (wrongEnv.length) console.error(`    that name is env.${wrongEnv.join('/')} — cross-env binding, and accounts differ`);
        else console.error(`    known env.${e} scripts: ${[...scriptNames[e].keys()].join(', ')}`);
        refFailures++;
      }
    }
  }
}
if (refFailures) failures += refFailures;

if (failures) { console.error(`\n${failures} problem(s)`); process.exit(1); }
console.log('\nsecrets.required is consistent across deployed envs');
