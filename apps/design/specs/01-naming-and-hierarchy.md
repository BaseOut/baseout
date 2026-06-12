# 01 — Naming & Hierarchy

The words on screen are part of the design. Get them wrong and the
mental model breaks. This page is the dictionary.

---

## The hierarchy (top-down)

```
Organization                  ← billing entity, one per company
   └── Space                  ← bound to ONE platform (Airtable, in V1)
         ├── Connection       ← OAuth link to that platform
         └── Bases            ← Airtable bases inside the connection
               └── Tables / Fields / Records / Views / Automations / Interfaces
```

A user belongs to one or more Organizations.
Each Organization contains one or more Spaces.
Each Space is bound to a single Platform (currently always Airtable)
via one Connection. The Connection sees one or more Bases. Each
Base contains the standard Airtable hierarchy.

---

## Canonical names (use these exactly)

| Word | Means | Avoid |
|---|---|---|
| **Organization** | Top-level customer entity. Billing lives here. | Account, Company, Org (in copy — abbreviate only in tight UI) |
| **Space** | A platform-bound container inside an Organization. Has its own backups, storage, settings. | Project, Workspace, Environment |
| **Platform** | A supported source system (Airtable, eventually Notion / HubSpot / Salesforce). | Source, Provider, Integration |
| **Connection** | An OAuth or API-key link between an Organization and a Platform. | Link, Auth, Credential |
| **Base** | An Airtable base inside a Connection. | Database, App |
| **Table** | A table inside a Base. | Sheet, Tab |
| **Field** | A column on a Table. | Column, Attribute |
| **Record** | A row on a Table. | Row, Entry, Item |
| **Attachment** | A file on an Attachment-type field. | File, Asset |
| **View** | A saved view on a Table (grid / kanban / etc.). | Filter, Layout |
| **Automation** | An Airtable automation (trigger + actions). | Workflow, Script |
| **Interface** | An Airtable interface (custom UI page). | Page, Dashboard |

**Why "Space" not "Workspace":** Airtable already uses "Workspace"
for their own concept. Calling ours "Workspace" too would create
constant confusion when a user has multiple Airtable Workspaces
inside one Baseout Space.

---

## Backup vocabulary

| Word | Means |
|---|---|
| **Backup** | The point-in-time snapshot of a Base. |
| **Backup Run** | One execution of the backup process. Has status: queued / running / succeeded / failed / cancelled / trial. |
| **Backup Snapshot** | The actual file output of a Backup Run. What you'd restore from. |
| **Storage Destination** | Where backup files land (Google Drive, Dropbox, Box, OneDrive, S3, R2). |
| **Database Tier** | The DB option for "dynamic" backups (D1, Shared Postgres, Dedicated Postgres, BYODB). |
| **Static Backup** | Files-only backup mode. Output is CSV/JSON. No database. |
| **Dynamic Backup** | Database-backed backup mode. Enables SQL access, real-time sync. |
| **Instant Backup** | Webhook-driven, real-time. Business+ tier only. |
| **BYOS** | "Bring Your Own Storage" — customer-provided storage destination. |
| **BYODB** | "Bring Your Own Database" — customer-provided Postgres. Enterprise only. |
| **Restore** | Writing a Backup Snapshot back into Airtable. Always creates new data — never overwrites. |
| **Health Score** | Per-base quality grade (schema cleanliness, data quality, config best practices). |
| **Changelog** | Auto-generated time-ordered diff of a thing (schema, data, automations). |
| **Capability** | A discrete functional area: Backup, Schema, Data, Automations, Interfaces, AI, Analytics, Governance, Integrations. |
| **Credit** | Unit of transfer/activity usage. Resets monthly. |
| **Overage** | Usage above the tier allowance. Billed per credit (transfer/activity) or per GB (storage). |

---

## Connection status vocabulary

A Connection has one of four states. Each maps to a visual treatment.
The mapping is already implemented (`IntegrationsView.astro` lines
53–58); keep the labels consistent if you redesign.

| State | UI label | Color | Dot? | What it means |
|---|---|---|---|---|
| `active` | "Connected" | success (green) | yes (live) | OAuth tokens are fresh, backups can run |
| `refreshing` | "Refreshing tokens" | warning (amber) | yes (live) | Token refresh is mid-flight, brief transient state |
| `pending_reauth` | "Reconnect required" | warning (amber) | no | User action needed — token expired and refresh failed |
| `invalid` | "Disconnected" | error (red) | no | Connection broken, backups will not run until user reconnects |

For `pending_reauth` and `invalid`, the Reconnect button must be
prominent — it's the only way back to working state.

---

## Backup Run status vocabulary

The Backup History widget shows runs in these states. Visual
treatment is up to you, but the canonical wording stays:

| Status | UI label | Suggested treatment |
|---|---|---|
| `queued` | "Queued" | neutral / muted, no spinner |
| `running` | "Running" | warning / live spinner, optional progress |
| `succeeded` | "Succeeded" | success (green) |
| `failed` | "Failed" | error (red), error message expandable |
| `cancelled` | "Cancelled" | neutral / muted |
| `trial` / `trial_succeeded` | "Trial run" | informational (blue), pre-payment |

A "failed" run usually has a one-line reason; the user should be
able to click it to see the full error and a retry button if it's a
retryable failure.

---

## Tier names (pricing)

Used in copy ("Upgrade to Pro to enable…"), and gating ("3 of your
12 bases are not included — upgrade to add more").

- **Trial** (Free) — pre-payment exploration
- **Starter** — single-base, weekly backups
- **Pro** — multi-base, daily backups, BYOS
- **Business** — instant backups, SQL API access
- **Enterprise** — BYODB, custom SLAs, dedicated support

You don't need to design pricing pages here — that's a separate
project. But if you reference a tier in copy, use these names
exactly.

---

## Person vs. system voice

When the UI is *telling* the user something:

- **"You're signed in to Acme Co."** — second person, present.
- **"We found 3 new bases."** — first-person plural is fine when
  the system did something on the user's behalf.
- **"This space has no backup configuration yet."** — neutral
  state-of-the-world. Acceptable.

When the system is *describing itself*:

- Use "Baseout" sparingly. The user knows where they are. Saying
  "Baseout connected to Airtable" everywhere is noisy.

---

## Things to avoid

- Synonyms drifting in. Once you call it a Base, call it a Base
  forever. Don't switch to "database" in one card and "Airtable
  base" in another.
- Friendly diminutives. "Your awesome backups", "Let's get you set
  up!" — wrong voice.
- Selling. The product is already paid for once they're in. No
  "Powered by Baseout" badges, no "Try Pro today!" banners on every
  page. The trial-conversion CTA appears on a few specific surfaces
  (dashboard nudge, integrations limit) and nowhere else.
- Jargon that requires Baseout-team knowledge to decode ("Durable
  Object", "INTERNAL_TOKEN", "Trigger.dev task"). The user never
  sees these.
