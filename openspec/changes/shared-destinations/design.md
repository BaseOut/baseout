# Design — Account-level destinations

## Product model (founder-confirmed)

Destinations are account-level reusable objects (founder, Slack): "tied to the account, then linked to 1+ spaces as being 'in use' by that space." A backup fans out to **1 file store** (Google Drive / Box / Dropbox / S3, or managed Baseout R2) **plus optionally 1 database** (Postgres / Neon / Supabase / BYODB). The database is **encouraged** (more utilization → upsell) but **never required**. First-time setup stays one simple flow; richer destination management lives after setup. Each destination carries **its own status + reconnect** — the user's own ask: "show the destination as its own thing user can manage — own status, own reconnect."

## Competitor grounding

A reusable account-level destination registry is the standard in data tools:
- **Airbyte** (the client's reference): separate **Sources / Destinations / Connections**; a destination is reusable and **delete is blocked while in use**.
- **Fivetran**: account **Destinations** list; the destination detail page lists the connections using it (= "in use by"); status `Broken` → re-authorize.
- **Hevo / Census / Estuary**: connect-first, reusable source/destination objects.
- **Customer.io Data Pipelines** = the closest analog to ours: a Destinations table with a **Sources column ("in use by")** plus a 4-step add wizard. (Stripe Data Pipeline and MS Fabric fan out to a warehouse **and** storage — precedent for file + database in parallel.)
- **Backup tools** (Rewind, ProBackup, CloudAlly, On2Air, Druva): managed-default + **BYOS-optional** extra copy + plan-gated soft upsell.

**Patterns adopted:** status table with an in-use count; type → auth → config → test add flow; status + reconnect **on the destination** (one reconnect fixes every linked Space); a **delete guardrail** while in use; a **two-level path** (destination connection + per-Space subfolder, from SimpleBackups / On2Air); a **visible-but-gated** database upsell (recommended, never hidden, never blocking).

## What is ours (not founder-stated)

Per [no-fabrication discipline], separating what's mandated from what we chose:
- Relabel **Static / Dynamic → "File storage / Database"** for clarity.
- Place the registry in **account Settings** (cadence = set-up-once, rarely touched), not a top-nav peer; surface broken-destination state where the user already looks.
- The **"Needs connection" lifecycle** — create the object first, connect after — so creating a destination doesn't force authorization up front and matches the reusable-object model.
- Dropped **OneDrive** (not in the founder's destination list / unverified support) and **Cloudflare D1** (skeleton simplification; in the full model).

## IA / open question

Destinations are account-level (confirmed). The **source (Airtable) connection scope is still open** (account vs per-Space). If the source is account-level too, sources + destinations unify under one account "Connections" area, and the per-Space Integrations page becomes "which account connections this Space uses."
