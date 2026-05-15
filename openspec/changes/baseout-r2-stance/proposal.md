## Why

Commit `8fc1f61` (refactor(server): write backup CSVs to local disk; remove R2 entirely) removed every Cloudflare R2 binding from `apps/server`:

- `BACKUPS_R2` binding removed from [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example) and `wrangler.test.jsonc`
- `env.BACKUPS_R2` removed from `apps/server/src/env.d.ts`
- `trigger/tasks/_lib/r2-proxy-write.ts` deleted (replaced by `local-fs-write.ts`)
- `src/pages/api/internal/runs/upload-csv.ts` deleted
- Integration tests `tests/integration/r2-proxy-write.test.ts` and `tests/integration/runs-upload-csv.test.ts` removed

Backup CSVs now write to `apps/server/.backups/` on the dev machine via [`trigger/tasks/_lib/local-fs-write.ts`](../../../apps/server/trigger/tasks/_lib/local-fs-write.ts). That path is dev-only — there is no production destination today.

Meanwhile, three downstream proposals still assume R2 exists:

- [`baseout-server-byos-destinations`](../baseout-server-byos-destinations/proposal.md) Phase B lists `r2-managed.ts` as a strategy that "wraps the existing `env.BACKUPS_R2.put` path." That path is gone.
- [`baseout-server-attachments`](../baseout-server-attachments/proposal.md) names `r2_object_key` as a column on `attachment_dedup` and Phase B says "pipe to R2."
- [`baseout-server-retention-and-cleanup`](../baseout-server-retention-and-cleanup/proposal.md) says the cleanup engine issues `DELETE` requests against R2 objects.

This drift is flagged in [specreview/05-update-2026-05-13b.md §A](../../../specreview/05-update-2026-05-13b.md). None of those three proposals can start implementation until the R2 question is settled.

## What Changes

**Decision: R2 is the default managed destination under a `StorageWriter` abstraction.**

[PRD §7.2](../../../shared/Baseout_PRD.md) lists Cloudflare R2 as the all-tiers default ("Cloudflare R2 (Baseout-managed) — ✓ (default)"). The trial flow assumes a backup runs without any BYOS setup. Removing managed R2 entirely would break both: customers on the free tier would have no place to write backups, and the wizard would gain a mandatory storage-connect step. Keeping R2 also matches [Features §6.6](../../../shared/Baseout_Features.md), which lists managed storage as part of every tier.

The `8fc1f61` removal was a temporary measure to unblock local-dev iteration while the engine end-to-end was being shaped — not a product pivot. With BYOS now scheduled under `baseout-server-byos-destinations`, R2 returns as the first strategy implementation behind the same interface every other provider implements.

### Concrete consequences

1. **`baseout-server-byos-destinations` gains a Phase 0**: re-introduce the `BACKUPS_R2` binding (in `wrangler.jsonc.example`, `wrangler.test.jsonc`, `env.d.ts`), then implement the `StorageWriter` interface, then ship `r2-managed.ts` as the first strategy. Phases A (schema) and B+ (per-provider) build on top.
2. **`baseout-server-attachments` depends on `byos-destinations` Phase 0** before its R2-writing path becomes implementable. The `r2_object_key` column on `attachment_dedup` is fine to define in schema, but Phase B's "pipe to R2" cannot start until Phase 0 of `byos-destinations` lands.
3. **`baseout-server-retention-and-cleanup` depends on `byos-destinations` Phase 0** before its `DELETE` path becomes implementable. The cleanup engine calls `writer.delete(path)` per the `StorageWriter` interface — that interface must exist first.
4. **`local-fs-write.ts` stays as the dev path** only — it is what makes `pnpm dev` work without R2 credentials. Once `byos-destinations` Phase 0 lands, the dev path can either continue to point at local-fs (configured via env var) or switch to a Miniflare-backed R2 bucket. Decision deferred to the implementer.

### What this change does NOT do

- It does not bring R2 back in code. That is `baseout-server-byos-destinations` Phase 0.
- It does not require a vote on whether to support BYOS. BYOS is already approved in [PRD §7.2](../../../shared/Baseout_PRD.md) and scheduled in `baseout-server-byos-destinations`.
- It does not change `local-fs-write.ts`. That stays as the dev path.

## Out of Scope

| Deferred to | Item |
|---|---|
| `baseout-server-byos-destinations` Phase 0 | Re-introduce `BACKUPS_R2` binding + `StorageWriter` interface + `r2-managed.ts`. |
| `baseout-server-byos-destinations` Phase B+ | Per-provider OAuth + strategy classes. |
| `baseout-server-attachments` Phase B | R2-writing path for attachments (gated on `byos-destinations` Phase 0). |
| `baseout-server-retention-and-cleanup` Phase B | R2-DELETE path for snapshots (gated on `byos-destinations` Phase 0). |
| Future change | Decide whether the dev path stays local-fs or moves to Miniflare-R2. |

## Capabilities

### New capabilities

None. This is a docs-only decision.

### Modified capabilities

None directly. The capabilities defined in `baseout-server-byos-destinations` (`backup-storage-writer-interface`, `backup-storage-destination-persistence`, `backup-storage-oauth-connect`) are unchanged; this change clarifies the order in which they ship.

## Impact

- **Master DB**: none.
- **Secrets**: none new from this change. `baseout-server-byos-destinations` Phase 0 will require the existing R2 secret pair (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) or the binding token — whichever shape `wrangler.jsonc.example` documents.
- **Cross-app contract**: unchanged. The decision affects the ordering of work, not the wire format between `apps/web` and `apps/server`.

## Reversibility

The decision itself is reversible — if the product later pivots to BYOS-only, this proposal can be archived as superseded and the three downstream proposals updated to drop R2. No data or code commits as a result of this change.
