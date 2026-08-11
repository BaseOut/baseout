# workflows-base-collaborators — Proposal

## Why

The paired [`server-base-collaborators`](../server-base-collaborators/proposal.md) persists base/workspace/interface collaborators and invite links; something has to fetch them. The natural moment is the backup run, which already fetches `getBaseSchema()` per base — one extra metadata GET rides the same cadence the customer chose as their staleness tolerance.

## What Changes

- The `backup-base` task gains a **collaborator capture step**: per base, call `GET /v0/meta/bases/{baseId}` with `include=collaborators&include=inviteLinks&include=interfaces&include=packages`, and POST the payload to the engine's `collaborators-sync` internal route.
- **Placement:** immediately after the existing base-schema fetch — same client, same rate budget, one call per base per run (unpaginated endpoint).
- **Failure isolation:** best-effort, matching comments — a failed metadata call marks the step `collaborators: skipped(reason)` in run progress and never fails the run (the server pair guarantees a skipped capture triggers no deletion diffing).
- No gating flag of its own in this change: capture rides record backup per the server pair's recommendation; if the PRD/Features amendment lands a dedicated flag, it stamps the payload the same way `commentsEnabled` does.

## Capabilities

### New Capabilities

- `collaborator-capture`: per-run fetch of the base-metadata endpoint (collaborators, invite links, interfaces, packages includes) and batched delivery to collaborators-sync, with best-effort failure isolation.

### Modified Capabilities

None (route and persistence contracts owned by the server pair).

## Impact

- **App:** `apps/workflows` only — `backup-base` orchestration + a small `_lib` metadata-fetch helper + tests (plain Vitest, injected `fetchImpl`).
- **Cross-repo contract (consumed):** collaborators-sync request body, owned by the server pair.
- **Sequencing:** after `server-base-collaborators`. Airtable cost: +1 GET per base per run against the existing per-base budget.
- No new secrets or scopes (`schema.bases:read` already granted).
