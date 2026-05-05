## Context

`apps/webhooks` was just renamed from `apps/webhook-ingestion` in the `rename-webhook-app` change. This follow-up trims one more syllable: `hooks` is the shortest unambiguous name for a webhook-receiver app. The files are still untracked in git.

## Goals / Non-Goals

**Goals:**
- Rename directory and update all references in one clean pass

**Non-Goals:**
- Any code or behaviour changes inside the app

## Decisions

**`mv` not `git mv`** — still untracked.

**Reference scope** — same pattern as prior renames:
1. `apps/hooks/package.json` — `name` field
2. Root `package.json` — dev script key and filter
3. `apps/hooks/wrangler.jsonc` — all three `name` fields
4. `apps/hooks/src/index.ts` — comment + placeholder response string
5. `scripts/fix-symlinks.js` — symlink source path
6. `apps/server/wrangler.jsonc` — comment mentioning `webhooks`
7. `packages/shared/src/hmac.ts` — comment mentioning `webhooks`

## Risks / Trade-offs

- Minimal — directory has been renamed once already this session, no deployed state exists.
