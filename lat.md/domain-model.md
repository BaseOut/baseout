# Domain Model

Canonical entity model and naming dictionary for Baseout. All code, copy, schemas, and APIs must use these terms exactly. Long-form prose with aliases-to-avoid lives in [shared/Baseout_Features.md](../shared/Baseout_Features.md) §1; this section is the searchable graph node.

## Hierarchy

The shape of customer data in Baseout. V1 is Airtable-only; cross-platform Spaces are V2+.

```
Organization (billing entity)
└── Connection (OAuth/API key → Platform)
    └── Space (config + billing unit, bound to one Platform)
        └── Base
            ├── Table → Field → Record → Attachment
            ├── View
            ├── Automation
            └── Interface
```

## Organization

Top-level billing entity. One per customer company. Users belong to an Organization. Maps to a single Stripe customer.

Aliases to **avoid**: Account, Org, Company.

## Space

Container within an Organization, bound to a single Platform. **Primary unit of configuration and billing.** Each Space has its own backup configuration, database, storage settings, and capability set.

Aliases to **avoid**: Project, Workspace, Environment. ("Space" was chosen to avoid collision with Airtable's "Workspace".)

### Single-Platform Space

A Space connected to exactly one Platform (e.g. Airtable). All capabilities are scoped to that platform's data model. The primary Space type in V1.

### Multi-Platform Space

V2+. Aggregates data across multiple Single-Platform Spaces. Does not contain its own data — references data from other Spaces. Some capabilities will be exclusive to Multi-Platform Spaces.

## Platform

A supported external data source. Each Platform has its own supported [[domain-model#Domain Model#Capability]] set — capabilities vary per Platform.

V1 supports **Airtable only**. Future Platforms: Notion, HubSpot, Salesforce.

## Connection

Authenticated link between an Organization and a Platform (OAuth or API key). One Connection serves multiple Spaces.

Each Connection gets its own per-Connection rate-limit gateway in `apps/server` — see [apps/server lat graph](../apps/server/lat.md/) for the Durable Object that backs it.

Aliases to **avoid**: Link, Auth, Credential.

## Airtable Entities

Map directly to Airtable's own concepts and **must not be renamed**. The Baseout schema and copy reuse these exact terms.

| Term | Airtable concept |
|---|---|
| **Base** | An Airtable base. Primary unit of data within a Space. |
| **Table** | A table within a Base. |
| **Field** | A column. Has name, type, configuration. |
| **Record** | A single row. |
| **Attachment** | File attached via an Attachment field. Stored separately. |
| **Automation** | Trigger + action workflow. Backed up as metadata; not executable in Baseout. |
| **Interface** | Custom UI page. Backed up as metadata; not renderable in Baseout. |
| **View** | Saved view (grid, kanban, calendar, etc.). Part of schema metadata. |
| **Schema** | Structural definition of a Base — Tables, Fields, relationships. **Excludes record data.** |

## Backup Vocabulary

Terms used throughout the backup engine, billing, and customer-facing copy. Static vs Dynamic is the most consequential split — it determines whether customer data ever lands in a Baseout-managed database.

| Term | Meaning |
|---|---|
| **Backup** | Point-in-time snapshot of Base data. |
| **Backup Run** | Single execution of the backup process. Produces a Backup Snapshot. |
| **Backup Snapshot** | The stored output of a Backup Run. Restorable. |
| **Static Backup** | Flat file (CSV/JSON) export to a Storage Destination. **Never persisted in Baseout-managed DB.** Streams through memory only. |
| **Dynamic Backup** | Written to a Baseout-provisioned or customer DB. Enables SQL access + real-time sync. Requires opt-in. |
| **Instant Backup** | Webhook-driven, real-time. Business+ only. |
| **Storage Destination** | External file storage (R2, GDrive, Dropbox, Box, OneDrive, S3, Frame.io). |
| **BYOS** | Bring Your Own Storage. Pro+. |
| **BYODB** | Bring Your Own Database. Enterprise only. |

## Capability

Discrete functional area within Baseout. Enabled/disabled per pricing tier (see [[pricing-tiers]]) and varies by Platform. Backup is always on; everything else is gated.

The full list: **Backup**, Schema, Data, Automations, Interfaces, AI, Analytics, Governance, Integrations.

Aliases to **avoid**: Feature, Component, Add-on.

## Cross-Cutting Terms

Top-level vocabulary that spans Capabilities — these terms appear in dashboards, billing, and APIs and must mean the same thing everywhere.

- **Changelog** — time-ordered record of changes to schema/data/automations/interfaces. Generated from backup diffs. **Not** the same as application audit logs.
- **Insight** — auto-generated observation about a customer's data/schema/usage. Produced by Data/Schema/AI capabilities.
- **Alert** — user-configurable notification when criteria are met. Delivered via Notifications.
- **Health Score** — composite audit grade for a Base. Surfaced on the dashboard.
- **Restore** — write a Backup Snapshot back into Airtable. **Always creates new data — never overwrites.**
- **Credit** — unit of metered usage (transfer + activity). Resets monthly. No rollover. Storage is billed separately in dollars.
- **Overage** — credit/storage usage above the tier allocation. Either auto-billed or hard-capped per customer setting.

## Where to Look

Pointers into the canonical specs. lat.md sections summarise; the spec docs in `shared/` remain authoritative for any nuance not captured here.

- Full naming table with aliases-to-avoid: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §1
- Hierarchy diagrams (V1 + V2): [shared/Baseout_Features.md](../shared/Baseout_Features.md) §2
- Capability matrix per platform / tier: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §4
- Database schema realising this model: [[db-schema-overview]]
