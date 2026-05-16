# Implementation tasks

This change captures the workflows app boundary itself. Per-task work (the actual task definitions for backup-base, cleanup, attachments, etc.) lives in the sibling `workflows-<topic>` changes.

## 1. Workspace package scaffold

- [x] 1.1 Create `apps/workflows/` directory with `package.json` (name `@baseout/workflows`, deps `@trigger.dev/sdk`, `@trigger.dev/build`, `papaparse`, devDeps `vitest`, `@types/node`, `@types/papaparse`, `typescript`)
- [x] 1.2 Create `apps/workflows/tsconfig.json` extending `../../tsconfig.base.json`, includes `trigger/**/*`, `trigger.config.ts`, `tests/**/*`
- [x] 1.3 Create `apps/workflows/vitest.config.ts` with `environment: "node"` and `include: ["tests/**/*.test.ts"]`
- [x] 1.4 Create `apps/workflows/trigger.config.ts` (port from former server location, project ref `proj_lklmptmrmrkeaszrmhcs`)
- [x] 1.5 Create `apps/workflows/README.md` describing the runner-vs-Worker boundary, env-var contract, and test setup
- [x] 1.6 Create `apps/workflows/.gitignore` covering `.backups/`, `.trigger/`, `dist/`, `node_modules/`

## 2. Move existing Trigger.dev source out of apps/server/

- [x] 2.1 `git mv apps/server/trigger/tasks/_ping.ts apps/workflows/trigger/tasks/_ping.ts`
- [x] 2.2 `git mv apps/server/trigger/tasks/backup-base.task.ts apps/workflows/trigger/tasks/backup-base.task.ts`
- [x] 2.3 `git mv apps/server/trigger/tasks/backup-base.ts apps/workflows/trigger/tasks/backup-base.ts`
- [x] 2.4 `git mv apps/server/trigger/tasks/_lib/*.ts apps/workflows/trigger/tasks/_lib/`
- [x] 2.5 Add `apps/workflows/trigger/tasks/index.ts` with type-only re-exports (`pingTask`, `backupBaseTask`, `BackupBaseTaskPayload`, `BackupBaseResult`, `BackupBaseInput`)
- [x] 2.6 `git mv apps/server/tests/integration/{airtable-client,backup-base-task,backup-base-task-cancel,csv-stream,field-normalizer,r2-path}.test.ts → apps/workflows/tests/`
- [x] 2.7 Update relative import paths in moved tests (`../../trigger/` → `../trigger/`)
- [x] 2.8 Delete `apps/server/trigger.config.ts` (now in workflows)
- [x] 2.9 Update `apps/workflows/trigger/tasks/_lib/local-fs-write.ts` BACKUP_ROOT anchor + path comments

## 3. Server-side adjustments

- [x] 3.1 Remove `papaparse`, `@types/papaparse`, `@trigger.dev/build` from `apps/server/package.json`
- [x] 3.2 Add `@baseout/workflows: workspace:*` to `apps/server/package.json`
- [x] 3.3 Update `apps/server/src/lib/trigger-client.ts` to `import type { pingTask, backupBaseTask } from "@baseout/workflows"`
- [x] 3.4 Update `apps/server/tsconfig.json` include list — drop `trigger/**/*` and `trigger.config.ts`
- [x] 3.5 Drop `.backups/` from `apps/server/.gitignore` (moved to workflows)
- [x] 3.6 Move `apps/server/.claude/agents/trigger-dev-task-writer.md` → `apps/workflows/.claude/agents/`
- [x] 3.7 Move `apps/server/.github/instructions/trigger-basic.instructions.md` → `apps/workflows/.github/instructions/`
- [x] 3.8 Rewrite `apps/server/CLAUDE.md` to enqueue-only Trigger.dev guidance; add `apps/workflows/CLAUDE.md` with full task-definition guidance

## 4. Root-level wiring

- [x] 4.1 Update root `CLAUDE.md` Repo Layout + Repo Split sections to include `apps/workflows/`
- [x] 4.2 Add `dev:workflows` script + include workflows in `dev:all` in root `package.json`
- [x] 4.3 Update `README.md` Apps section, Monorepo layout, and setup loop to include workflows
- [x] 4.4 Update `openspec/specs/app-naming/spec.md` with the `apps/workflows` requirement

## 5. OpenSpec change rename + fork

- [x] 5.1 `git mv openspec/changes/backup → openspec/changes/server`
- [x] 5.2 `git mv openspec/changes/server-<topic> → openspec/changes/server-<topic>` for every in-flight change in the family
- [x] 5.3 Update `apps/server/openspec` symlink target to `../../openspec/changes/server`
- [x] 5.4 Create `apps/workflows/openspec` symlink → `../../openspec/changes/workflows`
- [ ] 5.5 For each in-flight `server-<topic>` that touches Trigger.dev tasks, create a sibling `workflows-<topic>` change with proposal.md + tasks.md scoping the workflows-side work; trim those bullets from the server-side change.

## 6. Verification

- [ ] 6.1 `pnpm install` resolves without errors; `@baseout/workflows` workspace symlink lands in `apps/server/node_modules/`
- [ ] 6.2 `pnpm --filter @baseout/server typecheck` passes
- [ ] 6.3 `pnpm --filter @baseout/workflows typecheck` passes
- [ ] 6.4 `pnpm --filter @baseout/workflows test` runs the migrated test suite green
- [ ] 6.5 `pnpm --filter @baseout/server test` still passes (no test moved out should regress)
