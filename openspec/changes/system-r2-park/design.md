## Overview

`system-r2-park` is a docs-and-decision change that reverses [`system-r2-stance`](../archive/2026-05-18-system-r2-stance/proposal.md). The "design" here is the rationale for picking the **delete-code-keep-enum-drop-default** pause shape over alternatives. Three reversal shapes were considered, all triggered by the same boss veto:

1. **Pause: delete code, keep enum, drop default (CHOSEN).** Remove every R2 binding, helper, strategy, and test from `apps/server`. Leave the `r2_managed` value in the `storage_destinations.type` CHECK constraint. Drop only the `'r2_managed'` DEFAULT on `backup_configurations.storageType`. Mark R2 work in three downstream openspec proposals as Out of Scope. PRD/Features get a one-row touch-up each. Revival is a `git revert` + a single DEFAULT migration.

2. **Hard pivot: BYOS-only forever.** Remove the `r2_managed` enum value entirely (CHECK-constraint migration), rewrite PRD §7.2 / Features §6.6 to make BYOS architecturally mandatory, archive `server-byos-destinations` Phase 0 outright, delete the trial-flow assumption that storage is zero-config.

3. **Soft pause: gate R2 behind a feature flag.** Keep the binding, the strategy, and the integration test in the tree. Add a `MANAGED_R2_ENABLED` env var defaulting to `false`. Leave the DEFAULT in place. Rely on the flag to hide R2 from the UI.

## Decision rationale

### Why not the hard pivot (Option 2)

- **Cost of reversal.** If the boss reverses the veto next week, Option 2 requires a CHECK-constraint migration to *re-add* `r2_managed`, a PRD rewrite to put R2 back, and resurrecting the Phase 0 work in `server-byos-destinations`. That is a multi-day job to undo a one-day decision.
- **Magnitude of the signal.** The veto was verbal, post-implementation, and arrived <24 hours after the prior decision-of-record. That cadence reads as "let's not pay for this right now," not "BYOS is the architecture forever." A hard pivot over-fits the signal.
- **Trial-flow risk.** [PRD §3.1](../../../shared/Baseout_PRD.md) assumes a backup can run on day 0 without storage setup. Killing R2 *and* removing the enum value forces a PRD-level revisit of the trial spec. Out of scope for a same-day pause.

### Why not the soft pause (Option 3)

- **Dead code rots.** A feature-flagged `r2-managed.ts` becomes a maintenance burden — every refactor of `StorageWriter` has to keep the R2 strategy compiling, even though no test exercises it in production. The integration test would either be skipped (and silently bitrot) or kept running against a Miniflare bucket that contradicts the pause decision.
- **Reviewer confusion.** A new contributor sees the binding in `wrangler.jsonc.example` and assumes R2 is the path. The flag mitigates that less than deletion does.
- **Reversal cost is *not* materially lower than Option 1.** `git revert` of a code-deletion commit is roughly the same effort as flipping a feature flag — both land in a single commit. The flag's only advantage is that the binding stays in `wrangler.jsonc.example`, which is also its main downside.

### Why the chosen shape works

- **Code and openspec and PRD all agree.** After this change, a contributor reading any of the three sources gets the same answer: managed R2 is paused, BYOS is the only writeable path, Google Drive is the de-facto default. No "but the code says…" branches.
- **Schema is forward-compatible.** Leaving `r2_managed` in the CHECK constraint means existing rows (if any future migration backfills the default before the DEFAULT drop lands) are still valid; future revival doesn't need a migration to *add* a value back to the enum.
- **Drops the DEFAULT, not the type.** [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) currently has `.default('r2_managed')` on the column. Dropping the default forces a UI-layer decision: every new backup config must reference a connected `storage_destinations` row. That makes the BYOS-required path explicit at the type system level, with zero structural risk.
- **Three downstream proposals park, don't archive.** Parking R2-specific tasks in each proposal's Out of Scope table preserves the audit trail (anyone reading `server-byos-destinations` later sees both "Phase 0 was real" and "Phase 0 was paused on 2026-05-20"). Archiving the proposals outright would lose that history.

## Implementation order (downstream)

This decision triggers the following dependency chain — executed in this same change's `tasks.md`, not by other changes.

```
system-r2-park (decision)
  ├─→ Step 2 — Edit 3 downstream openspec proposals (park R2 phases)
  ├─→ Step 3 — Code rollback in apps/server (delete + edit)
  ├─→ Step 4 — Frontend rollback in apps/web (allowlist + default + StoragePicker)
  ├─→ Step 5 — Product-spec touch-ups (one row per file)
  └─→ Step 6 — Memory hygiene (informal-veto → documented-pause)
```

Steps 3 and 4 are landed as one commit (`revert(server): pause managed R2 per system-r2-park`) OR as paired commits — both touch the `storageType` default and the test fixtures. Steps 1, 2, and 5 are docs-only and can land first. The verification plan in `tasks.md` calls out the per-commit smoke commands.

## What `local-fs-write.ts` does in this world

[`apps/workflows/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts) is **unchanged**. It remains the dev path for backup output, writing to `apps/server/.backups/` on the dev machine. It is not a `StorageWriter` strategy — it lives in the workflows app on the Node runner, not the Worker — and it is not user-facing.

Production today has no destination. After this change, production has BYOS providers (Google Drive shipped in `cea7f08`; Dropbox is next per [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/proposal.md)). The trial flow assumption — that a customer can backup on day 0 without setup — is broken by this pause. That break is acknowledged and not addressed here; it returns when (if) managed R2 returns, or when a "tracer-bullet" trial path lands using a Baseout-owned Drive folder.

## On `buildR2Key`

[`apps/workflows/trigger/tasks/_lib/r2-path.ts`](../../../apps/workflows/trigger/tasks/_lib/r2-path.ts) exports `buildR2Key`, which is used by `local-fs-write.ts` to compute the file path inside `apps/server/.backups/`. The name is a historical artifact — the function is provider-agnostic. **Leave it alone.** Renaming is a drive-by refactor that adds review burden without changing behavior; queue it for a future change that has a real reason to touch the file.

## Open questions

None for this change. Open questions about the trial-flow story without managed R2 belong to a future change (either `system-r2-revive` or a `web-trial-flow-byos-onboarding` proposal).
