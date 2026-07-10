# server-schema-descriptions — Zero-setup AI schema descriptions (Workers AI)

## Status

PROPOSED — 2026-07-09, building immediately as a POC (product decision: quality
sacrificed for zero-setup; see Tier-gate note below before any production launch).

## Why

The Schema page's documentation surfaces (Browse entity panels, the Docs story)
are empty for every user until they hand-write descriptions in Airtable or author
Docs — the exact setup burden we want to remove. The per-Space entity tables
already carry `ai_description` columns and the panels already render them; the
ONLY missing piece is a generation path.

**Provider decision: Cloudflare Workers AI, engine-side.** The engine is a
Cloudflare Worker, so Workers AI is a platform-authenticated **binding**
(`env.AI`) — zero API keys, zero `.dev.vars` entries, zero Trigger.dev env
setup, none of this repo's recurring secret-drift failure mode, and billing on
the Cloudflare account that already exists. Cost: 10k free neurons/day covers
dev. Quality is open-model tier (POC-acceptable); the generation call sits
behind a narrow `generate(prompt)` seam so upgrading any surface to Claude
later (per the repo's default-to-Claude convention) is a config change, not a
rewrite. Chat / Insights / Health stay on the Claude path — this change is
descriptions only.

## What Changes

- **`ai` binding** on the engine Worker (`wrangler.jsonc.example` top-level +
  `env.dev`; `Env.AI?: Ai` — optional so environments without the binding skip
  generation gracefully).
- **Pure module** `apps/server/src/lib/per-space/describe-schema.ts` — plans
  which entities need describing (POC rule: `ai_description IS NULL` and
  `status='active'`), builds one batched prompt per table (fields included) +
  one per base, and parses the model's JSON output defensively (fenced-JSON
  tolerant; unknown entity ids dropped; length-capped).
- **IO module** `describe-schema-io.ts` — loads the base's undescribed
  entities, calls the injected `generate` fn per batch, writes
  `ai_description` via `withSpaceSchema`. Idempotent: a second run over an
  already-described base is a no-op.
- **Hook**: after a successful `/schema-sync`, `ctx.waitUntil(...)` runs
  generation for the synced base — advisory (never fails or delays the sync
  response), with a **fresh per-task DB client** (the request-scoped client is
  torn down when the response returns). Runs only when `env.AI` is present and
  `AI_DESCRIPTIONS_ENABLED` is not `"false"`.
- Model pinned via `AI_DESCRIPTIONS_MODEL` (default a small instruct model —
  verify the current catalog id at build time), so cost/quality is an env
  knob.

## Tier-gate note (flagged per CLAUDE.md §1 — spec conflict to resolve pre-launch)

Features §7 puts AI-assisted description generation at **Pro+**. The engine has
no tier resolver (capability resolution lives in apps/web), so this POC
generates for every managed_pg Space. BEFORE production launch this needs
either a tier flag passed through the sync payload/master DB read, or the
enqueue moved behind a web-resolved gate. Tracked as an explicit unchecked task
— do not archive this change with the gate unresolved. (PRD lists auto data
dictionaries as V2; Features §7 lists AI describe as V1 Pro+ — building to the
Features reading, as a POC.)

## Capabilities

### New Capabilities

- `schema-ai-descriptions`: post-backup, entities lacking a description get an
  AI-generated one (Workers AI), rendered by the existing Browse panels — zero
  user setup.

## Impact

- `apps/server/wrangler.jsonc.example` (+ rendered local `wrangler.jsonc`),
  `src/env.d.ts`, `src/lib/per-space/describe-schema.ts` + `describe-schema-io.ts`
  (+ tests), `schema-sync.ts` (waitUntil hook).
- No DB change (columns exist), no per-Space version bump, no web change
  (panels already render `ai_description`), no workflows change, no new secrets.
- **Deferred:** re-describe on schema change (POC fills missing only);
  per-entity "Regenerate" UI; Claude upgrade path; AI Gateway front door;
  the Pro+ tier gate (pre-launch blocker, above).
