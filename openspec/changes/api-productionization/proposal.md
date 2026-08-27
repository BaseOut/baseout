# api-productionization

> **Filed for sequencing** (Phase 5 of `plans/2026-08-27-mcp-app-parity.md`). Design + tasks
> authored when the feature phases are demoable and Dan's env split has landed apps/api's lane.

## Why

Phases 0–4 make the MCP/API surface real; this change makes it a product: today rate limiting is
shadow-only with placeholder numbers, `plan` is hardcoded null, there is no quota against the
Features §3 monthly call allowance (10K/50K/250K/1M), OAuth 2.1/DCR is absent (blocks claude.ai
connector-directory listing), and the support portal's API/MCP manual pages are deliberate
templates waiting for exactly these endpoints.

## What Changes

- Flip `RATE_LIMIT_ENFORCE` with real per-tier numbers (Dan decision); 429 + Retry-After.
- Tier resolution in apps/api (resolveEntitlements-backed `plan` + monthly call quota debited
  off the Analytics Engine usage dataset).
- OAuth 2.1 + Dynamic Client Registration IF connector-directory listing is wanted (Dan
  decision); `mcp.baseout.com` alias.
- Production deploy on `api.baseout.com` with prod Hyperdrive (Dan's env lane).
- Fill the support portal `docs/{api,mcp}` template pages via `/support-docs-update` — the
  `api:` frontmatter slugs finally get real reference targets, closing the loop with the
  docs-automation program.

## Impact

apps/api + support-portal content. Blocked on: Dan's env lane, quota numbers, connector ambition
(all named in the plan's decision list). Nothing in Phases 1–4 waits for this.
