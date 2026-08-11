## Status

Workflows half of Relationships — DONE + green. Thin per-run trigger; the
heuristic + persistence live in `server-relationships`.

---

## 1. Pure orchestration (TDD) — DONE

- [x] 1.1 `runRelationshipInference(input, deps)` (`relationship-inference.ts`) — fan out `syncBase` per base, aggregate `{inserted,refreshed,skipped,proposed}`, isolate per-base failures into `errors[]`. Tests `tests/relationship-inference.test.ts` (3): fan-out + aggregate, per-base isolation, empty list.

## 2. Task wrapper — DONE

- [x] 2.1 `relationship-inference.task.ts` — reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN`; `syncBase` POSTs `/relationships/sync {baseId,runId}`; 409/501 → zero result; other non-2xx throws (recorded per-base). `id: "relationship-inference"`, `maxDuration: 300`.
- [x] 2.2 Type re-exports in `trigger/tasks/index.ts` (`relationshipInferenceTask`, `RelationshipInferencePayload`, result/input types) so the engine can enqueue without bundling the body.

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/workflows test` green (192, incl. the 3 new); `typecheck` clean. No stray `console.*`.
- [ ] 3.2 Human smoke: after a backup run, the run's bases get fresh synced-view candidates (visible in the Relationships tab). Needs `npx trigger.dev dev` + engine `--remote`.

## Note

The engine `schema-sync` already best-effort re-infers on each capture, so the tab
is populated even without this task firing; the task is the explicit per-run
trigger (and a future scheduled re-infer hook). Enqueuing it from the engine
run-complete path is a small follow-up (not yet wired).
