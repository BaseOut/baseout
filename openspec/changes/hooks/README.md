# hooks

Public Airtable webhook receiver at `hooks.baseout.com` (`apps/hooks`).

Verifies each Airtable notification ping's HMAC and dirty-marks the central `airtable_webhooks` registry row (`last_ping_at`). Pings carry no change data — the per-Space polling pipeline (`server-instant-webhook`) discovers dirty bases from the registry and pulls actual changes via Airtable's payloads API (`workflows-instant-webhook`).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).
