## 1. Rename Directory

- [x] 1.1 Run `mv apps/webhook-ingestion apps/webhooks`

## 2. Update Package Name

- [x] 2.1 Update `apps/webhooks/package.json` — change `"name"` from `"@baseout/webhook-ingestion"` to `"@baseout/webhooks"`

## 3. Update Root Package Script

- [x] 3.1 Update `package.json` script `"dev:webhook-ingestion"` → `"dev:webhooks"` with filter `@baseout/webhooks`

## 4. Update App Config and Source

- [x] 4.1 Update `apps/webhooks/wrangler.jsonc` — replace all `baseout-webhook-ingestion` with `baseout-webhooks` (name, env.production.name, env.staging.name)
- [x] 4.2 Update `apps/webhooks/src/index.ts` — replace `@baseout/webhook-ingestion` comment and `baseout-webhook-ingestion` placeholder response

## 5. Update fix-symlinks.js

- [x] 5.1 Update `scripts/fix-symlinks.js` — change `apps/webhook-ingestion/openspec` entry to `apps/webhooks/openspec`

## 6. Fix Cross-App References

- [x] 6.1 Update `apps/server/wrangler.jsonc` comment referencing `webhook-ingestion` → `webhooks`
- [x] 6.2 Grep repo for any remaining `webhook-ingestion` references and fix (`packages/shared/src/hmac.ts` updated; lockfile will regenerate)

## 7. Verify and Commit

- [x] 7.1 Run `pnpm install` to regenerate lockfile
- [x] 7.2 Run `pnpm -r typecheck` to verify no broken references
- [ ] 7.3 Commit all changes in a single atomic commit
