## Why

The current app directory names (`backup/`, `inbound-api/`, `sql-rest-api/`) are either unclear or overly verbose. Renaming them to `server/`, `api/`, and `sql/` improves consistency, reduces path length, and better reflects each app's actual role.

## What Changes

- Rename `apps/backup/` → `apps/server/`
- Rename `apps/inbound-api/` → `apps/api/`
- Rename `apps/sql-rest-api/` → `apps/sql/`
- Update all internal references (package.json names, pnpm workspace paths, import aliases, tsconfig paths, scripts) to reflect the new names

## Capabilities

### New Capabilities
<!-- None — this is a rename/refactor, no new capabilities -->

### Modified Capabilities
<!-- No spec-level behavior changes -->

## Impact

- `pnpm-workspace.yaml`: workspace glob paths updated if hardcoded
- Each app's `package.json`: `name` field updated
- Root `package.json` / scripts: any references to old directory or package names updated
- `tsconfig.base.json` and per-app `tsconfig.json`: path aliases updated if present
- CI/CD configuration (`.github/` workflows): any hardcoded paths updated
- Cross-app imports between workspace packages updated
