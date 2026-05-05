## Context

One app remains with a multi-word hyphenated name after the `rename-apps` change renamed `backup`, `inbound-api`, and `sql-rest-api`. `webhook-ingestion` → `webhooks` completes the naming pass and gives every app a short single-word directory name.

All files are untracked in git, so `mv` is used instead of `git mv`.

## Goals / Non-Goals

**Goals:**
- Rename the directory and update all references so the workspace builds cleanly

**Non-Goals:**
- Changing the Cloudflare Worker's public route or behaviour
- Refactoring code inside the app

## Decisions

**`mv` not `git mv`** — directory is untracked, same as the previous rename batch.

**Reference update scope:**
1. `apps/webhooks/package.json` — `name` field: `@baseout/webhook-ingestion` → `@baseout/webhooks`
2. Root `package.json` — `dev:webhook-ingestion` script → `dev:webhooks`
3. `apps/webhooks/wrangler.jsonc` — worker `name` fields: `baseout-webhook-ingestion` → `baseout-webhooks`
4. `apps/webhooks/src/index.ts` — comment header
5. `scripts/fix-symlinks.js` — symlink entry: `apps/webhook-ingestion/openspec` → `apps/webhooks/openspec`
6. Grep all other apps for cross-references to `@baseout/webhook-ingestion` or `baseout-webhook-ingestion`

## Risks / Trade-offs

- **Missed cross-app binding** → `apps/server/wrangler.jsonc` has a comment referencing `webhook-ingestion`; must be updated. Mitigation: grep before committing.
- **Ghost directory from postinstall** → if `pnpm install` runs before `fix-symlinks.js` is updated, it would recreate `apps/webhook-ingestion/openspec`. Update the script first.

## Migration Plan

1. `mv apps/webhook-ingestion apps/webhooks`
2. Update `apps/webhooks/package.json` name
3. Update root `package.json` script
4. Update `apps/webhooks/wrangler.jsonc` worker names
5. Update `apps/webhooks/src/index.ts` comment
6. Update `scripts/fix-symlinks.js` symlink entry
7. Grep for any remaining `webhook-ingestion` references and fix
8. Run `pnpm install && pnpm -r typecheck` to verify
