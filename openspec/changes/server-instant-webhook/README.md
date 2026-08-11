# server-instant-webhook

Implements the **Instant** backup frequency per [PRD §2.2](../../../shared/Baseout_PRD.md) (Pro+ per the PRD's reading, resolved over Features §6.1's Business+ per CLAUDE.md authority rules) as **pull-based change detection on a per-Space cadence**.

Airtable webhooks are registered once per (Organization, base) — Airtable caps webhooks at 2 per base per OAuth integration — and shared by the org's Spaces via a subscription table, each subscription holding its own payload cursor. `apps/hooks` (change `hooks`) verifies each notification ping and dirty-marks the registry (`last_ping_at`); each Space's DO polls the registry on its own configurable interval (the tier knob), and enqueues the `incremental-backup` Trigger.dev task (change `workflows-instant-webhook`) for dirty bases. The task pulls actual changes via Airtable's payloads API (primary) with a records-API `modifiedTime` reconciliation path (catch-all).

This supersedes the earlier receive→forward→DO-debounce design (and PRD §2.5's description of it): notification pings carry no data, payloads are replayable for 7 days from client-held cursors, so per-event delivery machinery (webhook_events table, service-binding forward, debounce/burst thresholds) buys nothing.

Depends on `server-dynamic-mode` — incremental runs write to the per-space dynamic DB.

Cross-change map: `hooks` = public receiver; **this change** = schema, SpaceDO polling, lifecycle, run plumbing; `workflows-instant-webhook` = the task; `server-cron-webhook-renewal` = expiry refresh + notification re-enable; `web-instant-webhook` = UI.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
