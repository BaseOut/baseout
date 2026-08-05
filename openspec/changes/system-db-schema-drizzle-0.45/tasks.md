# system-db-schema-drizzle-0.45 — tasks

Gate: `@baseout/db-schema` + all consumers (`apps/web`/`server`/`admin`) typecheck and pass their suites after the bump; `pnpm install --frozen-lockfile` clean. Local commits; push per the remediation loop.

- [ ] 1.1 Confirm every workspace consumer's `drizzle-orm` range (baseline: `packages/db-schema` `^0.36.0` → 0.36.4; `apps/web` already `^0.45.2`). Identify the 0.36-era call sites.
- [ ] 1.2 Bump `packages/db-schema` (and any other 0.36.x consumer) to `^0.45.2`; regenerate `pnpm-lock.yaml`; `--frozen-lockfile` clean.
- [ ] 1.3 Reconcile 0.36→0.45 API deltas in the shared schema/query code (builder signatures, `sql` fragments, inferred types); add/extend db-schema unit tests for touched builders (TDD, §3.4) — note db-schema has no `test` script on `main` yet.
- [ ] 1.4 Verify consumers: `pnpm --filter @baseout/db-schema` typecheck+tests; `apps/web`/`server`/`admin` typecheck + build + suites green (baseline the known pre-existing `cloudflare:workers` errors — don't chase).
- [ ] 1.5 Confirm the 2 `drizzle-orm` highs clear on rescan; update the `system-dep-remediation` ledger §9.
