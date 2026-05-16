# server-cron-oauth-refresh

Activates a Cloudflare Workers cron in `apps/server` that proactively refreshes Airtable Connection OAuth tokens before they expire. Today's only refresh path is on-demand (during a backup, or on user re-connect via `apps/web`); this change adds a 15-minute scheduled refresher so connections don't silently rot.

The change is fully internal to `apps/server`. No `apps/web` code changes; the existing `connections.status` set (`active | refreshing | pending_reauth | invalid`) and `apps/web`'s [IntegrationsView](../../../apps/web/src/views/IntegrationsView.astro) already handle every state the cron produces. No master-DB schema migration.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
