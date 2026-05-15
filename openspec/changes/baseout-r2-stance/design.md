## Overview

This is a docs-only change. The "design" is the rationale for picking **R2-stays-as-default** over the two alternatives. Three options were considered:

1. **R2 stays as default; BYOS as alternates (CHOSEN).** Managed R2 is the trial/free-tier landing destination. `StorageWriter` is the interface every destination implements; `r2-managed.ts` is the first strategy. BYOS adds OAuth-connected providers.
2. **BYOS-only — Baseout never holds customer bytes.** No managed R2. Every customer must connect a BYOS destination before their first backup runs.
3. **R2 only — no BYOS for V1.** Managed R2 stays; BYOS deferred to V2.

## Decision rationale

### Why not BYOS-only (Option 2)

- [PRD §7.2](../../../shared/Baseout_PRD.md) names Cloudflare R2 as the "all-tiers" default. Changing that is a product-level pivot, not a refactor decision.
- The trial flow ([PRD §3.1](../../../shared/Baseout_PRD.md)) assumes a backup can run without storage setup. Forcing a BYOS connection before the first run inserts friction that the trial spec was written to avoid.
- The 7-day trial / 1-run cap path enforced by [`baseout-server-trial-quota-enforcement`](../baseout-server-trial-quota-enforcement/proposal.md) needs a working destination on day 0. Managed R2 is the only zero-config option.
- Customer support: with BYOS-only, every "backup didn't run" ticket starts with "did you connect your destination?" Managed R2 keeps the default path empty-of-customer-config.

### Why not R2-only (Option 3)

- [PRD §7.2](../../../shared/Baseout_PRD.md) lists BYOS as a V1 Must-Have. It is not deferrable.
- The `StoragePicker` UI already exists with seven destinations. Backing it out is more work than building forward.
- BYOS is a moat against vendor-lock-in concerns: customers can leave Baseout and keep their backups in their own Drive/Dropbox/S3.

### Why R2 + BYOS (Option 1)

- Matches the PRD exactly.
- Lets the `StorageWriter` abstraction do real work: managed R2 is the first concrete implementation; BYOS providers are the second, third, fourth.
- The work to re-introduce the R2 binding is mechanical: `wrangler.jsonc.example` already has the example, `env.d.ts` had the typing, and the deleted `r2-proxy-write.ts` is still in `git log`.
- Local-dev path stays at `local-fs-write.ts` (which works without R2 credentials) until someone wants to make Miniflare-R2 the dev path.

## Implementation order (downstream)

This decision unlocks the following dependency chain (executed by other changes, not by this one):

```
baseout-r2-stance (decision)
  └─→ baseout-server-byos-destinations Phase 0 (re-introduce binding + StorageWriter)
        ├─→ baseout-server-byos-destinations Phase A+ (other providers)
        ├─→ baseout-server-attachments Phase B (R2-writing for attachments)
        └─→ baseout-server-retention-and-cleanup Phase B (R2-DELETE for snapshots)
```

Nothing in this change executes that order — it only documents it.

## What stays local-fs

[`apps/server/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/server/trigger/tasks/_lib/local-fs-write.ts) stays as the dev path. It is the only write target during local development today. The `baseout-server-byos-destinations` Phase 0 implementer decides whether the dev path:

- Remains `local-fs-write.ts` selected by an env var (e.g. `STORAGE_DEV_MODE=local-fs`), or
- Switches to a Miniflare-backed R2 bucket so dev exercises the same code path as production.

Either is defensible. This proposal does not pick.

## Open questions

None. This change is purely a recorded decision; the open questions belong to `baseout-server-byos-destinations`.
