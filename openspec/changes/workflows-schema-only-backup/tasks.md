## Status

Workflows half of dual schema+data schedules. `backup-base` honors `kind='schema'` (schema capture only). Pairs with `server-backup-scope` (sets `kind`). Cross-app contract: `BackupBaseTaskPayload.kind`.

---

## 1. Payload + branch (TDD)

- [x] 1.1 Failing tests `apps/workflows/tests/backup-base-schema-only.test.ts` (3): a `kind='schema'` run calls schema capture but NOT `listRecords`/`syncRecords`/`writeCsv`, reports `recordsProcessed=0`/`attachmentsProcessed=0` with per-table `tableDetail` (recordCount=0, fieldCount from schema); a schema run with `storageType='r2_managed'` succeeds without R2 creds (storage guard skipped); a `kind='full'` run still writes CSV + processes records.
- [x] 1.2 `BackupBaseInput` + `BackupBaseTaskPayload` += `kind?: 'full' | 'schema'`. `backup-base.ts`: `isSchemaOnly` skips the r2 creds guard + the BYOS/R2 credential fetch, and returns right after `syncSchema` (before the record/CSV/attachment loop) with the schema `tableDetail`. The finally still unlocks. `kind` flows into `runBackupBase` via the payload spread. Green.

## 2. Verification

- [x] 2.1 `pnpm --filter @baseout/workflows test backup-base-schema-only` 3/3 + all `backup-base` suites 20/20 (no regression) + `typecheck` clean. No stray `console.*`.
- [ ] 2.2 Human smoke (with `server-backup-scope`): a schema-scheduled run fills no CSVs and reports zero records; a full run still writes CSVs.
