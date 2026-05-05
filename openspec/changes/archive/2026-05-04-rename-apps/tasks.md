## 1. Rename Directories

- [x] 1.1 Run `git mv apps/backup apps/server`
- [x] 1.2 Run `git mv apps/inbound-api apps/api`
- [x] 1.3 Run `git mv apps/sql-rest-api apps/sql`

## 2. Update Package Names

- [x] 2.1 Update `apps/server/package.json` — change `"name"` from `"@baseout/backup"` to `"@baseout/server"`
- [x] 2.2 Update `apps/api/package.json` — change `"name"` from `"@baseout/inbound-api"` to `"@baseout/api"`
- [x] 2.3 Update `apps/sql/package.json` — change `"name"` from `"@baseout/sql-rest-api"` to `"@baseout/sql"`

## 3. Update Root Package Scripts

- [x] 3.1 Update `package.json` script `"dev:backup"` → `"dev:server"` with filter `@baseout/server`
- [x] 3.2 Update `package.json` script `"dev:inbound-api"` → `"dev:api"` with filter `@baseout/api`
- [x] 3.3 Update `package.json` script `"dev:sql-rest-api"` → `"dev:sql"` with filter `@baseout/sql`
- [x] 3.4 Search and replace any other `--filter @baseout/backup`, `--filter @baseout/inbound-api`, `--filter @baseout/sql-rest-api` references in `package.json`

## 4. Update Config Files

- [x] 4.1 Grep repo for `@baseout/backup`, `@baseout/inbound-api`, `@baseout/sql-rest-api` and fix any remaining references in `tsconfig.base.json`, per-app `tsconfig.json`, or other config files

## 5. Verify and Commit

- [ ] 5.1 Run `pnpm install` to regenerate the lockfile with new package names
- [ ] 5.2 Run `pnpm -r build` or `pnpm -r typecheck` to verify no broken references
- [x] 5.3 Confirm no stale references remain: `grep -r "inbound-api\|sql-rest-api\|@baseout/backup" apps/ package.json tsconfig*.json`
- [ ] 5.4 Commit all changes in a single atomic commit
