# Implementation tasks

> **Depends on**: [`system-r2-revive`](../system-r2-revive/proposal.md) decision. Delivers static CSVs → R2 end-to-end; no attachment work here.

## 1. Dependency

- [x] 1.1 Add `aws4fetch` to `apps/workflows/package.json` dependencies; `pnpm install`.

## 2. R2 StorageWriter (TDD)

- [x] 2.1 Red: `apps/workflows/tests/r2-writer.test.ts` (or co-located `_lib/storage-writers/r2.test.ts` matching the repo's test placement). Cases:
  - `writeCsv` issues `PUT <endpoint>/<bucket>/<key>` with `content-type: text/csv` and the encoded CSV body; returns `{ path, size }`.
  - `writeCsv` non-2xx → throws with status + body slice.
  - `deletePrefix` lists then batch-deletes; absent prefix → `{ deletedCount: 0 }`.
  - `..` segment in key/prefix → throws `invalid_path`.
- [x] 2.2 Green: implement `apps/workflows/trigger/tasks/_lib/storage-writers/r2.ts` per design.md (`createR2Writer`, `R2WriterCreds`).

## 3. Factory registration

- [x] 3.1 `apps/workflows/trigger/tasks/_lib/storage-writers/index.ts` — add `R2WriterCreds` + `{ kind: 'r2' }` variant to `StorageWriterCreds`; export the type; dispatch `r2_managed` + `kind === 'r2'` → `createR2Writer` before the LocalFs fallback.
- [x] 3.2 Extend the factory test (`storage-writers` index test, if present) to assert `resolveStorageWriter('r2_managed', { kind: 'r2', ... })` returns the R2 writer and `resolveStorageWriter('r2_managed', undefined)` still falls back to LocalFs.

## 4. backup-base cred plumbing

- [x] 4.1 `backup-base.ts` — add `getR2Creds?: () => R2WriterCreds | null` to the deps interface; add the `r2_managed` branch to the cred gate per design.md.
- [x] 4.2 `backup-base.task.ts` — read the four `R2_*` env vars; inject `getR2Creds`; throw a clear error if `r2_managed` + any env var missing.
- [x] 4.3 Extend `backup-base` test(s) to assert `r2_managed` + present creds resolves the R2 writer (fake fetch), and `r2_managed` + null creds falls back to LocalFs.

## 5. Doc-only

- [x] 5.1 Update the "R2 removed" header comment in `apps/workflows/trigger/tasks/_lib/r2-path.ts`.

## 6. Verification

- [x] 6.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
- [ ] 6.2 Human smoke (gated on R2 env provisioning): run a backup with `storageType='r2_managed'`; confirm per-table CSVs appear as R2 objects under `<orgSlug>/<space>/<base>/<ts>/`.
