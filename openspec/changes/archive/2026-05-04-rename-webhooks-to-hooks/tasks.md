## 1. Rename Directory

- [x] 1.1 Run `mv apps/webhooks apps/hooks`

## 2. Update Package and Root Scripts

- [x] 2.1 Update `apps/hooks/package.json` — `"name"` from `"@baseout/webhooks"` to `"@baseout/hooks"`
- [x] 2.2 Update root `package.json` — `"dev:webhooks"` → `"dev:hooks"` with filter `@baseout/hooks`

## 3. Update App Config and Source

- [x] 3.1 Update `apps/hooks/wrangler.jsonc` — replace all `baseout-webhooks` with `baseout-hooks`
- [x] 3.2 Update `apps/hooks/src/index.ts` — replace `@baseout/webhooks` comment and `baseout-webhooks` placeholder

## 4. Update fix-symlinks.js

- [x] 4.1 Update `scripts/fix-symlinks.js` — change `apps/webhooks/openspec` to `apps/hooks/openspec`

## 5. Fix Cross-App References

- [x] 5.1 Update `apps/server/wrangler.jsonc` — comment `webhooks` → `hooks`
- [x] 5.2 Update `packages/shared/src/hmac.ts` — comment `webhooks` → `hooks`

## 6. Verify and Commit

- [ ] 6.1 Run `pnpm install` to regenerate lockfile
- [ ] 6.2 Run `pnpm -r typecheck` to verify
- [ ] 6.3 Commit all changes in a single atomic commit
