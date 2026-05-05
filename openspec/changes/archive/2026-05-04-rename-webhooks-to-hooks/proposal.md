## Why

`apps/webhooks` was just renamed from `apps/webhook-ingestion`. On reflection, `hooks` is shorter and still unambiguous in the context of this codebase where the app's sole job is receiving Airtable webhook callbacks.

## What Changes

- Rename `apps/webhooks/` → `apps/hooks/`
- Update `apps/hooks/package.json` `name`: `"@baseout/webhooks"` → `"@baseout/hooks"`
- Update root `package.json` script `"dev:webhooks"` → `"dev:hooks"`
- Update `apps/hooks/wrangler.jsonc` worker names: `baseout-webhooks` → `baseout-hooks`
- Update `apps/hooks/src/index.ts` comment and placeholder
- Update `scripts/fix-symlinks.js` symlink entry
- Update `apps/server/wrangler.jsonc` comment referencing `webhooks`
- Update `packages/shared/src/hmac.ts` comment referencing `webhooks`

## Capabilities

### New Capabilities
<!-- None — pure rename -->

### Modified Capabilities
<!-- No spec-level behavior changes -->

## Impact

- `apps/webhooks/` directory (renamed to `apps/hooks/`)
- Root `package.json` dev script
- `scripts/fix-symlinks.js` symlink table
- Cross-app comments in `apps/server/wrangler.jsonc` and `packages/shared/src/hmac.ts`
