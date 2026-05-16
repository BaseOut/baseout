# baseout-web-workspace-rediscovery

The frontend half of workspace-base rediscovery. Pairs with [`baseout-server-workspace-rediscovery`](../baseout-server-workspace-rediscovery/proposal.md) (the engine writes; this side reads + dispatches).

This change adds:

- A **Rescan bases** button in the Integrations view that proxies through the `BACKUP_ENGINE` service binding to the engine's manual rescan endpoint.
- An inline banner showing the most recent unread `space_events` row of kind `bases_discovered`, with discovered / auto-added / blocked-by-tier counts.
- A **dismiss** endpoint that sets `space_events.dismissed_at` for a given event ID.
- An **auto-add future bases** toggle persisted to `backup_configurations.auto_add_future_bases` via the existing `PATCH /api/spaces/:spaceId/backup-config` route.
- A `SpaceEventSummary` type added to the integrations nanostore so the banner survives client-side navigation.

The route handlers exist on the branch in uncommitted form ([apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts) + dismiss + tests). The state hydration and view wiring also live in uncommitted edits to [integrations.ts](../../../apps/web/src/lib/integrations.ts), [persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts), [stores/connections.ts](../../../apps/web/src/stores/connections.ts), and [IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro).

This change documents the contract so the engine + web halves stay in sync.

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md).
