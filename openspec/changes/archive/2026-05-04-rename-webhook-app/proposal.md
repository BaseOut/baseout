## Why

`apps/webhook-ingestion` is verbose and inconsistent with the short single-word naming adopted for the other apps (`server`, `api`, `sql`, `web`, `admin`). Renaming to `apps/webhooks` aligns the directory with the rest of the monorepo.

## What Changes

- Rename `apps/webhook-ingestion/` → `apps/webhooks/`
- Update `apps/webhooks/package.json` `name` from `"@baseout/webhook-ingestion"` to `"@baseout/webhooks"`
- Update root `package.json` script `"dev:webhook-ingestion"` → `"dev:webhooks"`
- Update `apps/webhooks/wrangler.jsonc` worker name from `"baseout-webhook-ingestion"` to `"baseout-webhooks"`
- Update `apps/webhooks/src/index.ts` comment header
- Update `scripts/fix-symlinks.js` symlink mapping

## Capabilities

### New Capabilities
<!-- None — pure rename, no new capabilities -->

### Modified Capabilities
<!-- No spec-level behavior changes -->

## Impact

- `apps/webhook-ingestion/` directory and all files within
- Root `package.json` dev script
- `scripts/fix-symlinks.js` symlink table
- Any cross-app references to `@baseout/webhook-ingestion` or `baseout-webhook-ingestion` in other apps' wrangler configs or source files
