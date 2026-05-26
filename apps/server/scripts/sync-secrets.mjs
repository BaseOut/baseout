#!/usr/bin/env node
// Sync apps/server/.dev.vars into the deployed Worker's secret set via
// `wrangler secret bulk`. Filters out:
//   - empty-value entries (wrangler bulk treats those as deletes)
//   - keys declared as `vars` (plaintext) in the wrangler config, since
//     a name can be either a var OR a secret, not both
//
// Invoked from package.json `secrets:sync:dev` after `wrangler deploy
// --env dev`. The fix-up exists because hand-set secrets on dev Workers
// drift away from .dev.vars; the deploy script keeps them aligned
// automatically. See CLAUDE.md §3.3 and the auto-memory.

import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const configIdx = args.indexOf("--config");
const configPath = configIdx >= 0 ? args[configIdx + 1] : "wrangler.jsonc";

const raw = readFileSync(configPath, "utf8");
const cfg = JSON.parse(stripJsoncToJson(raw));

// String-aware jsonc → json: drops // line comments + /* block */ comments
// but leaves comment-shaped substrings inside string literals alone. Also
// strips trailing commas before } or ].
function stripJsoncToJson(input) {
  let out = "";
  let i = 0;
  let inString = false;
  let quote = "";
  while (i < input.length) {
    const c = input[i];
    const n = input[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < input.length) {
        out += n;
        i += 2;
        continue;
      }
      if (c === quote) {
        inString = false;
        quote = "";
      }
      i++;
    } else if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      i++;
    } else if (c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < input.length - 1 && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const declaredVars = new Set([
  ...Object.keys(cfg.vars || {}),
  ...Object.keys(cfg.env?.dev?.vars || {}),
  ...Object.keys(cfg.env?.staging?.vars || {}),
  ...Object.keys(cfg.env?.production?.vars || {}),
]);

const lines = readFileSync(".dev.vars", "utf8").split(/\r?\n/);
const out = [];
const skipped = [];
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) {
    out.push(line);
    continue;
  }
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) {
    out.push(line);
    continue;
  }
  const [, key, val] = m;
  if (val.trim().length === 0) {
    skipped.push(`${key} (empty value)`);
    continue;
  }
  if (declaredVars.has(key)) {
    skipped.push(`${key} (declared as var in ${configPath})`);
    continue;
  }
  out.push(line);
}

if (skipped.length > 0) {
  console.log(`Skipping ${skipped.length} keys:`);
  for (const s of skipped) console.log(`  - ${s}`);
}

// wrangler secret bulk's stdin detection is finicky under spawnSync, so we
// write a temp file and pass it as the positional arg instead.
const tmpDir = mkdtempSync(join(tmpdir(), "baseout-secrets-"));
const tmpPath = join(tmpDir, "secrets.env");
writeFileSync(tmpPath, out.join("\n"));
try {
  const result = spawnSync("wrangler", ["secret", "bulk", tmpPath, ...args], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
} finally {
  try { unlinkSync(tmpPath); } catch {}
}
