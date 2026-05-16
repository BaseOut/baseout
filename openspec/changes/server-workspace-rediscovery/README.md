# server-workspace-rediscovery

Adds the engine-side path that picks up Airtable bases added to a workspace **after** the OAuth callback fired. The OAuth callback writes the initial `at_bases` rows; everything added later was previously invisible to Baseout. This change is the single writer for rediscovery (both manual `POST /api/internal/spaces/:id/rescan-bases` and the future `SpaceDO` alarm path route through `runWorkspaceRediscovery`) so the auto-add + tier-cap policy stays consistent.

The schema scaffolding shipped in commit `3eeedfb` (Phase 1 of this change). The pure orchestrator + dep wiring + manual rescan route are in-flight on `autumn/server-setup` (Phase 2 of this change). Alarm-driven scheduled rediscovery is **deferred to Phase 3** until `server-schedule-and-cancel` archives — the alarm code path is the wrong place to introduce two-writer concerns simultaneously.

Cross-app contract: `apps/web` writes the auto-add toggle + reads `space_events`; `apps/server` is the secondary writer of `space_events` rows during rediscovery + the canonical writer of `at_bases` + `backup_configuration_bases`. Both share the `space_events` schema written canonically by [`apps/web/drizzle/0008_workspace_rediscovery.sql`](../../../apps/web/drizzle/0008_workspace_rediscovery.sql).

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md), and the paired UI change [`web-workspace-rediscovery`](../web-workspace-rediscovery/proposal.md).
