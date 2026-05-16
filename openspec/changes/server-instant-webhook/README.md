# server-instant-webhook

Implements the **Instant** backup frequency per [PRD §2.2](../../../shared/Baseout_PRD.md) (Pro+ tier per PRD, Business+ per Features — this change commits to the PRD's Pro+ reading per CLAUDE.md authority resolution). Airtable webhooks fire when records change in a connected base; this change receives the webhook in `apps/hooks`, forwards to `apps/server`, coalesces events in a per-Space Durable Object, and triggers an incremental backup run once a debounce threshold is reached.

Depends on `server-dynamic-mode` shipping — Instant backups write incremental record changes to the dynamic DB, not to a CSV snapshot.

Cross-app: `apps/hooks` owns the Airtable webhook receiver + HMAC verification; `apps/server` owns the per-Space DO event coalescer + incremental run path.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
