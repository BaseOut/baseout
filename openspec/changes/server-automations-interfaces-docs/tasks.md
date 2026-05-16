## Phase A — Schema

- [ ] A.1 Generate `apps/web/drizzle/0014_submitted_entities.sql` per design.md §Phase A.
- [ ] A.2 Apply migration.
- [ ] A.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) with `submittedEntities`.
- [ ] A.4 Engine mirror.

## Phase B — Inbound API endpoints

- [ ] B.1 TDD red: `apps/api/tests/integration/submitted-entities-automations.test.ts` — 401 / 403 (tier) / 400 (oversize) / 409 (no API token surface yet) / 200.
- [ ] B.2 Implement `apps/api/src/pages/v1/spaces/[spaceId]/automations.ts`.
- [ ] B.3 Same for `interfaces.ts` and `documentation.ts`.
- [ ] B.4 Shared helpers `apps/api/src/lib/submitted-entities/upsert.ts`, `validate.ts`.
- [ ] B.5 Wire into [apps/api/src/index.ts](../../../apps/api/src/index.ts) routing.

## Phase C — Airtable Script generator

- [ ] C.1 New page `apps/web/src/pages/spaces/[spaceId]/submitted-entities/script-generator.astro`.
- [ ] C.2 Template the Script snippet per entity type. Use a token already provisioned for this Org (PII: the token is sensitive — display once with copy-to-clipboard, don't store in browser).
- [ ] C.3 Vitest for the template-rendering logic.

## Phase D — Airtable Automation template

- [ ] D.1 New page `apps/web/src/pages/spaces/[spaceId]/submitted-entities/automation-generator.astro`.
- [ ] D.2 Renders JSON config for Airtable Automation's "Run script" action.
- [ ] D.3 Test.

## Phase E — Manual Form UI

- [ ] E.1 New page `apps/web/src/pages/spaces/[spaceId]/submitted-entities/index.astro` — tab layout (Automations / Interfaces / Documentation).
- [ ] E.2 Per-tab list view: latest version per logical entity + click-to-expand version history.
- [ ] E.3 Per-tab submit form: file-upload + paste textarea (Automation/Interface); markdown editor (Documentation).
- [ ] E.4 Browser-side fetch to api.baseout.com endpoints.
- [ ] E.5 Test: render + submit POST flow.

## Phase F — Backup-run inclusion

- [ ] F.1 New module `apps/server/src/lib/submitted-entities/load-latest.ts` — SELECT latest version per logical entity per Space.
- [ ] F.2 Workflows-side finalization (writes `<runId>/submitted-<type>.json` in static mode, UPSERTs `_baseout_<type>` tables in dynamic mode) lives in [`workflows-automations-interfaces-docs`](../workflows-automations-interfaces-docs/tasks.md).
- [ ] F.3 Server-side: declare the engine-callback endpoint the workflows finalization step POSTs to (`/api/internal/runs/:runId/docs`). Vitest under `apps/server/tests/integration/` for the route handler.

## Phase G — Tier-gating

- [ ] G.1 TDD red: `resolveSubmittedEntityCapability(tier)` per Phase G of design.md.
- [ ] G.2 Implement in `apps/web/src/lib/billing/capabilities.ts`.
- [ ] G.3 apps/api endpoints consult resolver; 403 lower-tier attempts.

## Phase H — Doc sync

- [ ] H.1 Update [shared/Baseout_Features.md §4.2](../../../shared/Baseout_Features.md) — Automations + Interfaces aligned to Growth+ per PRD.
- [ ] H.2 Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) Out-of-Scope.
- [ ] H.3 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Phase I — Final verification

- [ ] I.1 `pnpm --filter @baseout/api typecheck && pnpm --filter @baseout/api test` — all green.
- [ ] I.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] I.3 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] I.4 Human checkpoint smoke:
  - Open Manual Form on a Growth Space, submit an automation JSON. Verify row in `submitted_entities`.
  - Run a backup. Verify R2 has `submitted-automation.json` next to records CSV.
  - Re-submit same automation with `airtableEntityId` matching previous; verify version=2 row.
- [ ] I.5 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `submitted-entities-validation` — JSON-schema validation per entity type.
- [ ] OUT-2 `submitted-entities-restore` — Restore back into Airtable.
- [ ] OUT-3 `submitted-entities-diff` — Diff a new version against previous.
- [ ] OUT-4 `submitted-entities-ai-import` — LLM-assisted bulk import.
- [ ] OUT-5 `submitted-entities-retention` — Prune old versions beyond N per logical entity.
- [ ] OUT-6 `submitted-entities-reminders` — Email reminder for tier-eligible Spaces with no submissions.
