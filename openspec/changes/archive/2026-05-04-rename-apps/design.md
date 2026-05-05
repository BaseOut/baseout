## Context

The monorepo has five apps under `apps/`. Three have names that are either vestigial (`backup` — leftover from early scaffolding), redundant with their function (`inbound-api`), or verbose (`sql-rest-api`). The target names (`server`, `api`, `sql`) are shorter, clearer, and consistent with the naming style of the other apps (`web`, `admin`).

This is a pure refactor — no runtime behavior changes.

## Goals / Non-Goals

**Goals:**
- Rename the three directories
- Update all references so the workspace builds and types-check cleanly after the rename

**Non-Goals:**
- Changing package scope prefixes or adding new ones
- Refactoring code inside the renamed apps
- Changing any app's external API surface or port configuration

## Decisions

**Rename in-place (move directory, update refs) vs. recreate**
→ Move directories. Recreating would lose git history. A simple `mv` followed by reference updates preserves history and keeps the diff minimal.

**Reference update scope**
The following files must be updated:
1. Each app's `package.json` — `name` field (e.g., `"name": "backup"` → `"name": "server"`)
2. `pnpm-workspace.yaml` — only if it has hardcoded paths instead of a glob
3. Root `package.json` — any `workspace:` references or script `--filter` flags using old names
4. `tsconfig.base.json` — any `paths` aliases pointing to old names
5. Per-app `tsconfig.json` — any `extends` or `references` paths that are directory-relative
6. `.github/` workflows — any `cd apps/backup` or `--filter backup` style references

## Risks / Trade-offs

- **Missed reference** → Build or type-check failure. Mitigation: grep for all three old names after renaming before committing.
- **pnpm lock file drift** → Run `pnpm install` after rename to regenerate lock. Mitigation: include this in migration steps.
- **git history** — `git mv` preserves rename tracking; plain `mv` + `git add` shows as delete+add. Use `git mv` for each directory.

## Migration Plan

1. `git mv apps/backup apps/server`
2. `git mv apps/inbound-api apps/api`
3. `git mv apps/sql-rest-api apps/sql`
4. Update `package.json` `name` fields inside each moved app
5. Grep for `backup`, `inbound-api`, `sql-rest-api` across the repo and fix any remaining references
6. Run `pnpm install` to update the lockfile
7. Run `pnpm -r build` (or type-check) to verify no broken references
8. Commit all changes together in one atomic commit
