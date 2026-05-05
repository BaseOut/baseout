# Baseout — Complete Feature Set & Pricing Specification

**Version:** 1.1  
**Date:** April 23, 2026  
**Status:** Draft — Requires Stakeholder Review  
**Source:** Features_Raw_Input.txt + BaseOut_PRD_v2.md + Pricing_Credit_System.md

---

## Table of Contents

1. [Naming Conventions Dictionary](#1-naming-conventions-dictionary)
2. [Organizational Hierarchy](#2-organizational-hierarchy)
3. [Pricing Tiers Overview](#3-pricing-tiers-overview)
4. [Tier Limits & Quotas](#4-tier-limits--quotas)
5. [Overage Pricing](#5-overage-pricing)
6. [Billing Architecture & Stripe Integration](#56-billing-architecture--stripe-integration)
7. [Capability 1: Backup](#6-capability-1-backup)
8. [Capability 2: Schema](#7-capability-2-schema)
9. [Capability 3: Data](#8-capability-3-data)
10. [Capability 4: Automations](#9-capability-4-automations)
11. [Capability 5: Interfaces](#10-capability-5-interfaces)
12. [Capability 6: AI](#11-capability-6-ai)
13. [Capability 7: Analytics](#12-capability-7-analytics)
14. [Capability 8: Governance](#13-capability-8-governance)
15. [Capability 9: Integrations](#14-capability-9-integrations)
16. [Data Intake Methods](#15-data-intake-methods)
17. [Notifications & Alerting](#16-notifications--alerting)
18. [Open Questions](#17-open-questions)

---

## 1. Naming Conventions Dictionary

> **IMPORTANT:** All user-facing copy, documentation, API references, database schemas, and code should use these canonical terms consistently. This dictionary is the single source of truth for naming.

### Organizational & Structural Terms

| Canonical Term | Definition | Aliases to Avoid | Notes |
|---|---|---|---|
| **Organization** | The top-level billing entity. One Organization per customer company. Maps to a single billing relationship. Users belong to an Organization. | Account, Org, Company | "Organization" represents the company-level entity that users are associated with, distinguishing it clearly from a user's individual account. |
| **Space** | A container within an Organization that is bound to a single Platform. Has a Space Type of either Single-Platform or Multi-Platform. Each Space has its own backup configuration, database, storage settings, and available capabilities. V1 supports Single-Platform Spaces on Airtable only. | Project, Workspace, Environment | "Space" was chosen to avoid collision with Airtable's "Workspace" concept while conveying a persistent operational environment. A Space is the primary unit of configuration and billing. |
| **Space Type** | Defines whether a Space is bound to a single platform (Single-Platform Space) or aggregates data across multiple Single-Platform Spaces (Multi-Platform Space). | Space Mode, Space Kind | V1 supports Single-Platform Spaces only. Multi-Platform Spaces are a future capability. Each Space Type exposes a different set of available capabilities and tools. |
| **Single-Platform Space** | A Space connected to exactly one Platform (e.g., Airtable). All capabilities within the Space are specific to that platform. The primary Space type in V1. | — | Capabilities are scoped to the platform's data model. An Airtable Single-Platform Space exposes Airtable-specific capabilities (Schema, Backup, Data, Automations, Interfaces, etc.). |
| **Multi-Platform Space** | A future Space type that aggregates data across multiple Single-Platform Spaces. Enables cross-platform tools that can reference entities (Bases, records, schemas) from different platforms. Users select a source Space and entity from each platform to power cross-platform capabilities. | — | V2+. Multi-Platform Spaces do not contain their own data — they reference data from Single-Platform Spaces. Some capabilities will be exclusive to Multi-Platform Spaces. |
| **Platform** | A supported external data source (e.g., Airtable). Platforms are connected at the Organization level via a Connection. Each Platform has its own set of supported capabilities. | Source, Provider, Integration | V1 supports only the Airtable Platform. Future Platforms: Notion, HubSpot, Salesforce. Capabilities vary per Platform — not all capabilities will be available on all Platforms. |
| **Connection** | An authenticated link between a Baseout Organization and an external Platform. Uses OAuth or API key. One Connection can serve multiple Spaces. | Link, Auth, Credential | Each Connection gets its own Durable Object for rate limiting and state management. |

### Airtable-Specific Terms

| Canonical Term | Definition | Aliases to Avoid | Notes |
|---|---|---|---|
| **Base** | An Airtable base. The primary unit of data within a Space. Contains Tables, Fields, Records, Automations, and Interfaces. | Database, App | Directly maps to Airtable's "Base" concept. |
| **Table** | A table within a Base. Contains Fields, Records, and Views. | Sheet, Tab | Directly maps to Airtable's "Table" concept. |
| **Field** | A column within a Table. Has a name, type, and configuration. | Column, Attribute | Directly maps to Airtable's "Field" concept. |
| **Record** | A single row of data within a Table. | Row, Entry, Item | Directly maps to Airtable's "Record" concept. |
| **Attachment** | A file attached to a Record via an Attachment field. | File, Asset, Upload | Stored separately from record data. Has its own storage limits. |
| **Automation** | An Airtable automation (trigger + action workflows). | Workflow, Script | Backed up as metadata; not executable within Baseout. |
| **Interface** | An Airtable interface (custom UI page built on Base data). | Page, Dashboard, View | Backed up as metadata; not renderable within Baseout. |
| **View** | A saved view within a Table (grid, kanban, calendar, etc.). | Filter, Layout | Backed up as part of schema metadata. |
| **Schema** | The structural definition of a Base: its Tables, Fields (names, types, options), and relationships. Does not include record data. | Structure, Definition, Model | Schema can be backed up independently of record data. |

### Backup & Storage Terms

| Canonical Term | Definition | Aliases to Avoid | Notes |
|---|---|---|---|
| **Backup** | A point-in-time snapshot of Base data (schema, records, and/or attachments). | Snapshot, Export, Dump | The act of capturing data from Airtable into Baseout storage. |
| **Backup Run** | A single execution of the backup process. Produces a Backup Snapshot. | Job, Execution, Cycle | Has a start time, end time, status, and metrics. |
| **Backup Snapshot** | The output of a Backup Run — the stored point-in-time data. | Backup Version, Checkpoint | Each Snapshot is identified by timestamp and can be used for Restore. |
| **Static Backup** | A backup mode where data is exported as flat files (CSV/JSON) directly to a Storage Destination. Data is never stored in a Baseout-managed database. | File Backup, CSV Export, Flat Backup | Data streams through memory only — never written to Baseout disk. Privacy-preserving. |
| **Dynamic Backup** | A backup mode where data is written to a Baseout-provisioned or customer-provided database. Enables SQL access, real-time sync, and advanced capabilitys. | Database Backup, Live Backup, DB Sync | Requires explicit customer opt-in to data storage. |
| **Storage Destination** | The external file storage location where static backup files and attachments are saved. | Storage Location, Cloud Storage, File Target | Examples: Google Drive, Dropbox, Box, OneDrive, S3, Cloudflare R2. |
| **Database Tier** | The type and hosting arrangement of the database used for Dynamic Backups. | DB Level, Database Plan, DB Type | Tiers: D1 (SQLite), Shared PostgreSQL, Dedicated PostgreSQL, BYODB. |
| **BYOS** | Bring Your Own Storage — customer provides their own Storage Destination. | Custom Storage, External Storage | Available on Pro and above for fully custom destinations. |
| **BYODB** | Bring Your Own Database — customer provides their own PostgreSQL database. Baseout writes to it. | Custom Database, External Database | Enterprise tier only. |
| **Instant Backup** | Webhook-driven backup that captures changes in real-time as they occur in Airtable. | Webhook Backup, Real-time Backup, Live Sync | Available on Business tier and above. Uses Airtable webhooks. |

### Capability Terms

| Canonical Term | Definition | Aliases to Avoid | Notes |
|---|---|---|---|
| **Capability** | A discrete functional area within Baseout. Capabilities are enabled/disabled per tier and vary by Platform. | Feature, Component, Add-on | Capabilities: Backup, Schema, Data, Automations, Interfaces, AI, Analytics, Governance, Integrations. Not all Capabilities are available on all Platforms. |
| **Changelog** | A time-ordered record of changes to a specific entity (schema, data, automations, interfaces). | History, Audit Log, Change Log | Generated automatically from backup diffs. Not to be confused with application-level audit logs. |
| **Insight** | An automatically generated observation or recommendation about the customer's data, schema, or usage patterns. | Finding, Suggestion, Alert | Generated by the Data, Schema, or AI capabilitys. |
| **Alert** | A configurable notification triggered when data or schema meets user-defined criteria. | Notification, Warning, Rule | Configured within individual capabilitys. Delivered via the Notifications system. |
| **Health Score** | A composite audit grade for a Base reflecting schema cleanliness, data quality, and configuration best practices. | Audit Score, Grade, Rating | Displayed on the dashboard per Base. |
| **Restore** | The process of writing backed-up data back into Airtable from a Backup Snapshot. | Recovery, Rollback, Import | Always creates new data — never overwrites existing data. |
| **Credit** | The unit of measure for transfer and activity consumption. Credits are consumed by backup runs, restores, API calls, and other billable operations. Storage is billed separately in dollars. | Token, Unit | Credits reset monthly on the billing date. No rollover. |
| **Overage** | Credit or storage usage that exceeds the tier's included allocation. Credits overage is billed per-credit at the plan's overage rate. Storage overage is billed per GB. | Excess, Surplus, Extra Usage | Customers can configure auto-overage or hard cap. |

### Infrastructure Terms

| Canonical Term | Definition | Aliases to Avoid | Notes |
|---|---|---|---|
| **D1** | Cloudflare D1 — a serverless SQLite database used as the entry-level database tier for Dynamic Backups. | SQLite, Lite DB | Cloudflare-hosted. Low cost. SQL-accessible. |
| **Shared PostgreSQL** | A PostgreSQL database on DigitalOcean shared across multiple customer Spaces. Mid-tier database option. | Shared DB, Multi-tenant DB, Shared PG | Not dedicated — multiple spaces share the same instance. |
| **Dedicated PostgreSQL** | A PostgreSQL database exclusively provisioned for a single customer Space. Hosted on Neon, Supabase, or DigitalOcean. | Dedicated DB, Isolated DB, Dedicated PG | One database per Space. Full isolation. |
| **R2** | Cloudflare R2 — S3-compatible object storage used for Baseout-managed file storage (attachments, static backups on managed plans). | Managed Storage, Internal Storage | No egress fees. Encrypted at rest. |

---

## 2. Organizational Hierarchy

### V1: Single-Platform Spaces (Airtable only)

```
Organization (Billing Entity)
├── Connection (OAuth to Airtable)
│   └── Platform: Airtable
│
├── Space A [Type: Single-Platform — Airtable]
│   ├── Backup Configuration (frequency, mode, destinations)
│   ├── Database (D1 / Shared PG / Dedicated PG / BYODB)
│   ├── Storage Destination (R2 / Google Drive / S3 / etc.)
│   ├── Base 1
│   │   ├── Schema (Tables, Fields, Views)
│   │   ├── Records
│   │   ├── Attachments
│   │   ├── Automations
│   │   └── Interfaces
│   ├── Base 2
│   │   └── ...
│   └── Capabilities (platform-specific, tier-gated)
│       ├── Backup (always enabled)
│       ├── Schema
│       ├── Data
│       ├── Automations
│       ├── Interfaces
│       ├── AI
│       ├── Analytics
│       ├── Governance
│       └── Integrations
│
└── Space B [Type: Single-Platform — Airtable]
    └── ...
```

### Future: Multi-Platform Spaces (V2+)

```
Organization (Billing Entity)
├── Connection A (OAuth to Airtable) → Platform: Airtable
├── Connection B (OAuth to Notion)   → Platform: Notion
│
├── Space A [Type: Single-Platform — Airtable]
│   └── ... (Airtable-specific capabilities)
│
├── Space B [Type: Single-Platform — Notion]
│   └── ... (Notion-specific capabilities)
│
└── Space C [Type: Multi-Platform]
    ├── References Space A (Airtable) — user selects Base or entity
    ├── References Space B (Notion)   — user selects Page or entity
    └── Capabilities (cross-platform tools only)
        └── (e.g., cross-platform analytics, unified data views)
```

### Platform & Space Rules

- A Single-Platform Space is bound to exactly one Platform — platforms cannot be mixed within a Space.
- Each Platform has its own set of supported capabilities. Not all capabilities are available on all Platforms.
- A Multi-Platform Space does not contain its own data — it references data from existing Single-Platform Spaces.
- Some capabilities will be exclusive to Single-Platform Spaces; others exclusive to Multi-Platform Spaces; some available in both.
- V1 supports Single-Platform Spaces with Airtable only. Multi-Platform Spaces and additional Platforms are V2+.

---

## 3. Pricing Tiers Overview

| | **Trial** | **Launch** | **Growth** | **Pro** | **Business** | **Enterprise** |
|---|---|---|---|---|---|---|
| **Monthly Price** | $0 | $49/mo | $99/mo | $199/mo | $399/mo | Custom |
| **Annual Price** | $0 | $468/yr ($39/mo) | $948/yr ($79/mo) | $1,908/yr ($159/mo) | $3,828/yr ($319/mo) | Custom |
| **Transfer Credits/mo** | 1,000 | 15,000 | 40,000 | 120,000 | 400,000 | Custom |
| **Onboarding Credits** | 500 | 5,000 | 10,000 | 25,000 | 75,000 | Custom |
| **Credit Overage Rate** | None (pauses) | $0.007/cr | $0.006/cr | $0.005/cr | $0.004/cr | Negotiated |
| **Backup Mode** | Static + Dynamic (Schema Only) | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic |
| **Backup Frequency** | Monthly | Weekly | Weekly | Daily | Daily + Instant | Daily + Instant |
| **Instant Backup** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Database** | D1 (schema only) | D1 (full) | D1 (full) | Shared PostgreSQL | Dedicated PostgreSQL | BYODB |
| **R2 File Storage** | 250 MB | 5 GB | 20 GB | 75 GB | 250 GB | Custom |
| **Database Storage** | 100 MB | 1 GB | 5 GB | 25 GB | 100 GB | Custom |
| **Snapshot Retention** | 30 days | 90 days | 6 months | 12 months | 24 months | Custom |
| **Spaces** | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Bases per Space** | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Connections per Space** | 2 | 2 | 2 | 2 | 2 | 2 |
| **Included Restores/mo** | 1 | 2 | 3 | 5 | 15 | Unlimited |
| **Smart Cleanup Policy** | Basic | Time-based | Two-tier | Three-tier | Custom | Custom |
| **Team Members** | 1 | 3 | 5 | 10 | 15 | Unlimited |
| **Support** | Community | Email | Priority email | Priority email | Priority + chat | Dedicated CSM + SLA |

> Trial DB storage (D1 schema only) powers the Schema capability — visualizing base structure, changelog, and health scores. Full record data storage in a Baseout-managed database requires Launch or above.

### Non-Public Plans

Not featured on the public pricing page. Discoverable for users who seek it out or are directed to it.

| Plan | Price/mo | Credits/mo | Backup Mode | DB | Spaces | Bases/Space | Frequency | Team Members |
|---|---|---|---|---|---|---|---|---|
| **Starter** | $29 | 5,000 | Static + Dynamic (Schema Only) | D1 (schema only) | 3 | 3 | Monthly | 2 |
| **On2Air Bridge** | $9.99 | 2,000 | Static + Dynamic (Schema Only) | D1 (schema only) | 1 | 3 | Monthly | 1 |

> **Starter** is for users who genuinely cannot afford Launch but need more than the free Trial — more spaces, more credits, and schema-level dynamic access. It is not marketed or featured. The **On2Air Bridge** is for On2Air Basic/Starter customers migrating at their existing price point — see §5 and §6 of Pricing_Credit_System.md for the full migration strategy.

---

## 4. Tier Limits & Quotas

### 4.1 Resource Limits

| Metric | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Spaces** | 1 | 3 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Bases per Space** | 1 | 3 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **R2 File Storage** | 250 MB | 250 MB | 5 GB | 20 GB | 75 GB | 250 GB | Custom |
| **Database Storage** | 100 MB (D1) | 250 MB (D1) | 1 GB (D1) | 5 GB (D1) | 25 GB (Shared PG) | 100 GB (Dedicated PG) | Custom |
| **Connections per Space** | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| **Max Connections (all Spaces)** | 2 | 6 | 6 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Team Members** | 1 | 2 | 3 | 5 | 10 | 15 | Unlimited |
| **Transfer Credits/mo** | 1,000 | 5,000 | 15,000 | 40,000 | 120,000 | 400,000 | Custom |
| **Snapshot Retention** | 30 days | 30 days | 90 days | 6 months | 12 months | 24 months | Custom |

> There are no hard caps on records or attachments. Credits are the natural limiter — how much data can be transferred in a billing period is determined by the monthly credit allotment, not by count-based quotas.

### 4.2 Backup Configuration by Tier

| Configuration | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Frequency** | Monthly | Monthly | Weekly | Weekly | Daily | Daily | Daily |
| **Instant (Webhook)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Manual (On-Demand)** | ✗ | ✗ | ✓ (2/mo) | ✓ (5/mo) | ✓ (Unlimited) | ✓ (Unlimited) | ✓ (Unlimited) |
| **Backup Mode** | Static + Dynamic (Schema Only) | Static + Dynamic (Schema Only) | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic |
| **What's Backed Up** | Schema, Records, Attachments | Schema, Records, Attachments | Schema, Records, Attachments, Automations, Interfaces | Same | Same | Same | Same + Custom metadata |
| **Automation Backup** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Interface Backup** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 4.3 Database Tier Details

| Database Tier | Plan(s) | Engine | Hosting | Isolation | SQL Access | REST API |
|---|---|---|---|---|---|---|
| **D1 (Schema Only)** | Trial, Starter | SQLite | Cloudflare D1 | Shared | ✗ (schema metadata only) | ✗ |
| **D1 (Full)** | Launch, Growth | SQLite | Cloudflare D1 | Per-database | ✓ | ✗ |
| **Shared PostgreSQL** | Pro | PostgreSQL 16 | DigitalOcean | Schema-level isolation | ✓ | ✓ (PG REST) |
| **Dedicated PostgreSQL** | Business | PostgreSQL 16 | Neon / Supabase / DigitalOcean | Full instance isolation | ✓ | ✓ (PG REST) |
| **BYODB** | Enterprise | PostgreSQL 13+ | Customer-hosted (AWS RDS, etc.) | Customer-controlled | ✓ | ✓ (PG REST) |

### 4.4 Storage Destination Support by Tier

| Storage Destination | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Google Drive** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Dropbox** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Box** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **OneDrive** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Amazon S3** | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Cloudflare R2 (Managed)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Frame.io** | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Custom / BYOS** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

---

## 5. Overage Pricing

> **NOTE:** Credits meter all backup, restore, and API transfer activity. Storage is billed separately in dollars and does not reset monthly. There are no per-record or per-attachment caps — credits are the single consumption meter. Customers can configure **auto-overage** (allow additional activity, billed at the end of the period) or **hard cap** (pause at limit and notify).

### 5.1 Transfer Credit Overage Rates

When monthly plan credits and all supplemental credit buckets (onboarding, purchased, promotional) are exhausted, additional activity is billed at the plan's per-credit overage rate at end of the billing period.

| Plan | Credit Overage Rate | Notes |
|---|---|---|
| **Trial** | None — pauses | Activity pauses when credits exhausted. No overage billing on free tier. |
| **Starter** | $0.008 per credit | |
| **Launch** | $0.007 per credit | |
| **Growth** | $0.006 per credit | |
| **Pro** | $0.005 per credit | |
| **Business** | $0.004 per credit | |
| **Enterprise** | Negotiated | |

### 5.2 Activity Credit Costs

Credits are consumed by transfer and activity operations. All rates are stored in the database and can be adjusted without code deploys.

| Operation | Credit Cost | Unit |
|---|---|---|
| **Schema / metadata backup** | 5 credits | Per base, per run |
| **Record data transfer** | 1 credit | Per 1,000 records |
| **Attachment data transfer** | 1 credit | Per 50 MB |
| **Restore — table level** | 15 credits | Per restore (beyond included monthly count) |
| **Restore — base (records only)** | 40 credits | Per restore (beyond included monthly count) |
| **Restore — base (records + attachments)** | 75 credits | Per restore (beyond included monthly count) |
| **Manual backup trigger** | 10 credits | Per on-demand run (beyond included monthly count) |
| **Smart cleanup — manual trigger** | 10 credits | Per manual trigger (scheduled automated runs are free) |
| **AI doc generation** | 10 credits | Per AI documentation generation run |
| **AI schema insight** | 5 credits | Per AI schema analysis run |
| **Inbound API calls** | 1 credit | Per 100 inbound API calls |
| **SQL REST queries** | 1 credit | Per 50 SQL REST queries |

### 5.3 Storage Overage Rates

Storage is persistent and does not reset monthly. Overage is billed per GB/month when usage exceeds the plan's included allocation.

| Storage Type | Overage Rate | Applies To |
|---|---|---|
| **R2 File Storage** | $0.50 / GB / month | All plans |
| **Database Storage (D1)** | $1.00 / GB / month | Trial, Starter, Launch, Growth |
| **Database Storage (Shared PG)** | $2.00 / GB / month | Pro |
| **Database Storage (Dedicated PG)** | $3.00 / GB / month | Business |

### 5.4 Monthly Recurring Credit Add-ons

A subscription add-on providing additional credits that refresh every billing period alongside plan credits. Always cheaper than paying overage, but slightly more expensive per credit than the base plan rate — designed to bridge predictable gaps without requiring a full plan upgrade. Unused add-on credits do not roll over.

| Add-on | Credits/mo | Launch | Growth | Pro | Business |
|---|---|---|---|---|---|
| **Small** | +5,000 | $25 ($0.005/cr) | — | — | — |
| **Medium** | +15,000 | $65 ($0.0043/cr) | $55 ($0.0037/cr) | — | — |
| **Large** | +50,000 | — | $175 ($0.0035/cr) | $150 ($0.003/cr) | — |
| **XLarge** | +150,000 | — | — | $420 ($0.0028/cr) | $330 ($0.0022/cr) |

> Multiple add-ons can be stacked. Customers who consistently need add-ons should upgrade their plan — plan effective rates are always cheaper per credit than add-on rates.

### 5.5 Additional Seats

| Add-on | Starter | Launch | Growth | Pro |
|---|---|---|---|---|
| Per additional seat/month | $6 | $8 | $10 | $12 |

> Business and Enterprise include unlimited team members. Upgrading the plan is more cost-effective than adding many individual seats on lower tiers.

**Overage control settings:**

| Setting | Options | Default |
|---|---|---|
| **Overage Mode** | `auto` (allow + bill at overage rate) / `cap` (pause when dollar limit is reached and notify) | `cap` |
| **Overage Dollar Cap** | User-defined maximum overage spend in dollars per billing period. When reached in `cap` mode, all creditable activity pauses until the cap is raised, credits are purchased, or the billing period resets. | None |
| **Cap Action** | `pause` — block further activity; `notify_only` — alert but continue | `pause` |
| **Credit Alert Thresholds** | Percentage of monthly plan credits consumed: 50%, 75%, 90%, 100% | All enabled |
| **Overage Dollar Alerts** | User-defined dollar amounts at which to receive overage alerts before the cap (e.g., alert at $10, $25, $50) | None set |
| **Notification Channels** | Email (all plans), Slack (Growth+), In-app (all plans) | Email + In-app |

---

## 5.6 Billing Architecture & Stripe Integration

> **RESOLVED:** This section documents the billing architecture decisions made during product specification. These decisions should inform the implementation of the billing system and must not be changed without updating this document.

### 5.6.1 Stripe Product Structure

Each platform/tier combination is a distinct Stripe Product with two Prices (monthly and annual). Products are named using the following convention:

```
Baseout — [Platform] — [Tier]
```

**V1 Stripe Products (Airtable):**

| Product Name | Monthly Price | Annual Price | Public |
|---|---|---|---|
| Baseout — Airtable — Trial | $0 | $0 | ✓ |
| Baseout — Airtable — Launch | $49/mo | $39/mo ($468/yr) | ✓ |
| Baseout — Airtable — Growth | $99/mo | $79/mo ($948/yr) | ✓ |
| Baseout — Airtable — Pro | $199/mo | $159/mo ($1,908/yr) | ✓ |
| Baseout — Airtable — Business | $399/mo | $319/mo ($3,828/yr) | ✓ |
| Baseout — Airtable — Enterprise | Custom | Custom | ✓ |
| Baseout — Airtable — Starter | $29/mo | $23/mo ($276/yr) | ✗ (hidden) |
| Baseout — Airtable — On2Air Bridge | $9.99/mo | N/A | ✗ (hidden) |

When additional platforms are launched, a new product set is created following the same naming convention (e.g., `Baseout — Notion — Pro`). Each platform maintains its own independent pricing.

### 5.6.2 Stripe Product Metadata

Every Stripe Product must include the following metadata. The application resolves capabilities and limits by reading this metadata — never by parsing the product name.

```
platform: "airtable" | "notion" | "hubspot" | ...
tier:     "trial" | "starter" | "launch" | "growth" | "pro" | "business" | "enterprise"
```

Every Stripe Price must include:
```
billing_period: "monthly" | "annual"
```

### 5.6.3 Subscription Architecture

| Rule | Detail |
|---|---|
| **One subscription per Organization** | A single Stripe subscription is created per Baseout Organization at sign-up and never replaced — only modified. |
| **One subscription item per platform** | Each active platform product occupies one subscription item within the Organization's subscription. |
| **Platform upgrades/downgrades** | Changing a tier for a platform swaps that platform's subscription item only. Other platform items are unaffected. |
| **Adding a platform** | Adds a new subscription item to the existing subscription. |
| **Removing a platform** | Removes that platform's subscription item at the end of the billing period. |

### 5.6.4 Free Trials

Trials are scoped **per platform**, not per Organization. A customer can hold one active trial per platform at a time.

| Rule | Detail |
|---|---|
| **Trial scope** | One trial per platform. A customer on an Airtable trial can independently start a Notion trial when that platform launches. |
| **Trial implementation** | Trials are applied at the subscription item level for that platform's product. The subscription itself may be active (paid) for other platforms simultaneously. |
| **Trial eligibility** | One trial per platform per Organization, ever. Cannot re-trial the same platform after the trial ends or is converted. |
| **Trial expiry** | At trial end, the subscription item converts to paid automatically (Stripe default behavior) unless cancelled. |
| **Trial duration** | TBD — to be defined per platform. May vary by platform (e.g., 14 days for Airtable). |

### 5.6.5 Multi-Platform Discount

A percentage discount is applied automatically to each platform subscription item beyond the first when an Organization holds active subscriptions for more than one platform.

| Rule | Detail |
|---|---|
| **Trigger** | Discount applies when a second (or further) platform product is added to the subscription. |
| **Discount rate** | TBD — suggested 15–20% off each additional platform item. |
| **Implementation** | Applied as a Stripe coupon on the additional subscription item(s), triggered automatically by the billing webhook when a second platform item is detected. |
| **Stacking** | Each additional platform beyond the first receives the same discount. The first (primary) platform is always full price. |
| **Trial interaction** | Discount applies to paid items only. Trial items are free and do not count as the "first" platform for discount purposes until converted to paid. |

### 5.6.6 Capability Resolution

The application determines a customer's accessible capabilities by reading their active Stripe subscription items and resolving per-platform access independently.

| Rule | Detail |
|---|---|
| **Per-platform resolution** | Each platform's capabilities and limits are resolved from that platform's active subscription item independently. |
| **No cross-platform blending** | A Pro Airtable subscription does not grant Pro-level access on Notion — each platform resolves its own tier. |
| **Multi-Platform Space access** | Requires at least two active platform subscription items (paid or trial). Resolved separately from single-platform capability access. |
| **Feature flag source of truth** | Always read from Stripe product metadata (`platform` + `tier`), never from product name strings. |

---

## 6. Capability 1: Backup

The Backup capability is the core of Baseout. It is **always enabled** on all tiers.

### 6.1 Backup Frequency

| Frequency | Description | Tiers |
|---|---|---|
| **Monthly** | One scheduled backup per month | All |
| **Weekly** | One scheduled backup per week | Launch+ |
| **Daily** | One scheduled backup per day | Pro+ |
| **Instant** | Webhook-driven — captures changes as they occur in Airtable | Business+ |

### 6.2 Backup Mode

All plans include Static backup. Dynamic database backup is available from Launch and is the default from Launch onward.

| Mode | Description | Data Storage | Availability |
|---|---|---|---|
| **Static** | Data exported as CSV/JSON to a Storage Destination. When using Baseout-managed storage (Cloudflare R2), files are stored on Baseout servers subject to plan storage limits. When using a customer-provided storage destination (BYOS), data passes through memory only and is never stored on Baseout servers. | Baseout-managed R2 (if using managed storage) or Customer's Storage Destination (BYOS) | All plans |
| **Dynamic (Schema Only)** | Schema metadata (tables, fields, views) is written to a D1 database. Record data is not stored in Baseout. Enables the Schema capability — visualization, changelog, and health score — without full data hosting. | Baseout D1 (schema metadata only) | Trial, Starter |
| **Dynamic (Full)** | Complete data written to a Baseout-managed or customer-provided database. Enables SQL access, real-time sync, and all advanced capabilities. | Baseout Database (D1 full, Shared PG, Dedicated PG) or BYODB | Launch+ |

> **Note:** Features marked with * are not available when using static file backups only.

### 6.3 What Gets Backed Up

> † These entities are not available via the Airtable REST API and are not automatically backed up. They must be submitted by the user through a Baseout intake method (Inbound API, Airtable Scripts, Airtable Automations, or Manual Forms).

| Entity | Trial | Starter | Launch | Growth | Pro | Business | Enterprise | Collection Method |
|---|---|---|---|---|---|---|---|---|
| **Schema** (Tables, Fields, Views) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Automatic (REST API) |
| **Records** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Automatic (REST API) |
| **Attachments** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Automatic (REST API) |
| **Automations** † | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | Manual (user-submitted via intake) |
| **Interfaces** † | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | Manual (user-submitted via intake) |
| **Custom Documentation** † | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | Manual (user-submitted via intake) |

### 6.4 Restore Capabilities

| Capability | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Included Restores/Month** | 1 | 1 | 2 | 3 | 5 | 15 | Unlimited |
| **Base-Level Restore** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Table-Level Restore** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Point-in-Time Selection** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Restore to New Base** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Restore to New Table** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Post-Restore Verification** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Community Restore Tooling** | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **AI-Assisted Restore Prompts** | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |

> **Additional restores beyond the included monthly count consume credits:** Table-level restore — 15 credits · Base restore (records only) — 40 credits · Base restore (records + attachments) — 75 credits.

> **Community Restore Tooling:** For entities that cannot be automatically restored (e.g., Automations, Interfaces), Baseout provides curated prompts and instructions for using AI coding assistants (e.g., Claude, ChatGPT) to reconstruct configurations via the Airtable API. Baseout provides the data and the prompts — the customer executes the restoration.

### 6.5 Database Hosting Options (Dynamic Only)

| Option | Description | Tiers |
|---|---|---|
| **D1 (Schema Only)** | Cloudflare-hosted SQLite. Stores schema metadata only. Supports Schema capability (visualization, changelog, health score). | Trial, Starter |
| **D1 (Full)** | Cloudflare-hosted serverless SQLite. Full record and schema storage. SQL-accessible. | Launch, Growth |
| **Shared PostgreSQL** | Multi-tenant PostgreSQL on DigitalOcean. Schema-level isolation. | Pro |
| **Dedicated PostgreSQL** | Single-tenant PostgreSQL on Neon, Supabase, or DigitalOcean. Full instance isolation. | Business |
| **BYODB (Bring Your Own Database)** | Customer provides a PostgreSQL 13+ instance. Baseout writes to it. Customer controls infrastructure, backups, and keys. | Enterprise |

### 6.6 Storage Destination Options

| Destination | Type | Auth | Proxy Required | Tiers |
|---|---|---|---|---|
| **Google Drive** | BYOS | OAuth | No | All |
| **Dropbox** | BYOS | OAuth | Yes | All |
| **Box** | BYOS | OAuth | Yes | All |
| **OneDrive** | BYOS | OAuth | No | All |
| **Amazon S3** | BYOS | IAM / Access Key | No | Growth+ |
| **Cloudflare R2** | Managed | Internal | No | All |
| **Frame.io** | BYOS | OAuth | TBD | Growth+ |
| **Custom / BYOS** | BYOS | Varies | Varies | Pro+ |

### 6.7 Backup Encryption

| Storage Type | Encryption |
|---|---|
| Baseout-managed database (D1, Shared PG, Dedicated PG) | ✓ Encrypted at rest — always |
| Baseout-managed file storage (Cloudflare R2) | ✓ Encrypted at rest — always |
| Customer external storage (Google Drive, Dropbox, Box, OneDrive, S3) | ⚠️ Dependent on storage provider |
| BYODB (customer-hosted database) | ⚠️ Customer-managed encryption |

### 6.8 Backup Auditing

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Backup Audit Report** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Per-Entity Verification** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Issue Notifications** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Monthly Backup Summary** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Detailed Audit Logs** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Audit History Retention** | ✗ | 30 days | 90 days | 6 months | 12 months | 24 months | Custom |

#### Audit Feature Descriptions

| Feature | Description |
|---|---|
| **Backup Audit Report** | A post-run report for each Backup Run detailing what was captured, what was skipped, and any errors encountered. Available for every completed Backup Run. |
| **Per-Entity Verification** | Confirms that each Base, Table, and Record set was successfully captured during the Backup Run. Flags missing or incomplete entities. |
| **Issue Notifications** | Alerts sent when a Backup Run completes with warnings, partial failures, or full failures. Delivered via the configured notification channels for the organization. |
| **Monthly Backup Summary** | A monthly digest per Space summarizing backup health, success rate, storage usage, and any recurring issues over the prior 30 days. |
| **Detailed Audit Logs** | Full per-run logs including record counts, field counts, attachment counts, duration, and error details. Retained for the plan's audit history period. |

### 6.9 Smart Rolling Cleanup

Smart Rolling Cleanup is an automated policy that deletes older backup snapshots to manage storage usage and prevent indefinite accumulation. Policy sophistication and automation frequency are tier-gated. Automated runs are always free; manual triggers cost credits.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Automated Cleanup** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Policy Tier** | Basic | Basic | Time-based | Two-tier | Three-tier | Custom | Custom |
| **Cleanup Schedule** | Monthly | Monthly | Weekly | Weekly | Daily | Daily | Continuous |
| **Manual Trigger** | ✗ | ✓ (10 cr) | ✓ (10 cr) | ✓ (10 cr) | ✓ (10 cr) | ✓ (10 cr) | ✓ (10 cr) |

**Policy Tiers:**

| Policy Tier | Description | Plans |
|---|---|---|
| **Basic** | Keep last N snapshots only. Simple count-based retention, no time-based windows. | Trial, Starter |
| **Time-based** | Keep daily snapshots for X days, then weekly. One configurable retention window. | Launch |
| **Two-tier** | Keep daily for X days, then weekly for Y days. Two configurable windows. | Growth |
| **Three-tier** | Keep daily for X days, weekly for Y days, monthly indefinitely. Three windows. | Pro |
| **Custom** | Fully configurable retention policy with multiple windows, rules, and exceptions. | Business, Enterprise |

---

## 7. Capability 2: Schema

The Schema capability provides tools for visualizing, documenting, auditing, and tracking changes to Airtable base schemas. Available on all tiers — Trial and Starter receive basic schema access via D1 schema storage; full schema features require Launch or above.

### 7.1 Feature Matrix

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Schema Visualization** | ✓ (basic) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Filter by Field Type** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Filter by Relationships** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Schema Documentation** | ✗ | ✗ | ✓ (manual) | ✓ (manual) | ✓ (manual + AI) | ✓ (manual + AI) | ✓ (manual + AI) |
| **Schema Changelog** | ✗ | ✓ (30 days) | ✓ (90 days) | ✓ (6 months) | ✓ (12 months) | ✓ (24 months) | ✓ (custom) |
| **Rename Tables/Fields** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Add Field Descriptions** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **AI-Generated Schema Docs** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Naming Convention Audit** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Dead Field Detection** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Schema Health Score** | ✗ | ✓ (basic) | ✓ (basic) | ✓ | ✓ (configurable) | ✓ (configurable) | ✓ (configurable) |
| **Diagram Export** | ✗ | ✗ | ✗ | PNG | PNG, SVG | PNG, SVG, PDF | All + embed widget |

### 7.2 Schema Changelog Retention

| Tier | Retention Period |
|---|---|
| Trial | None |
| Starter | 30 days |
| Launch | 90 days |
| Growth | 6 months |
| Pro | 12 months |
| Business | 24 months |
| Enterprise | Custom (unlimited available) |

### 7.3 Schema Management Actions (Pro+)

These actions write back to Airtable via the Airtable REST API:

- **Rename Table** — Update a table's name in Airtable
- **Rename Field** — Update a field's name in Airtable
- **Add/Update Description** — Set or update the description for a table or field
- **AI-Generated Documentation** — Automatically generate descriptions based on field type, usage patterns, and data analysis

### 7.4 Schema Audit Rules (Pro+)

Configurable rules for the Schema Health Score:

- Naming convention consistency (camelCase, snake_case, Title Case, etc.)
- Missing field descriptions
- Orphaned/dead fields (no records with values)
- Circular lookup chains
- Formula errors
- Duplicate field names across tables
- Unused linked record fields
- Tables with no records

---

## 8. Capability 3: Data

The Data capability provides insights, monitoring, and governance tools for the record data within a Space. **Requires Dynamic backup mode with full D1 or PostgreSQL — not available on schema-only or static backups.**

### 8.1 Feature Matrix

> \* Not available when using static file backups only or D1 schema-only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Record Count Dashboard** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Per-Table/Per-Base Metrics** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Data Changelog** | ✗ | ✗ | ✓* (90 days) | ✓* (6 months) | ✓* (12 months) | ✓* (24 months) | ✓* (custom) |
| **Data Alerts** | ✗ | ✗ | ✗ | ✗ | ✓* (5 rules) | ✓* (25 rules) | ✓* (unlimited) |
| **Data Insights** | ✗ | ✗ | ✗ | ✗ | ✓* (basic) | ✓* (advanced) | ✓* (advanced) |
| **Data Reports** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Visualization** | ✗ | ✗ | ✗ | ✗ | ✓* (basic) | ✓* (advanced) | ✓* (advanced) |
| **PII Detection** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Growth Trends** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |

### 8.2 Alert Types

| Alert Type | Description | Min Tier |
|---|---|---|
| **Record Count Threshold** | Alert when a table exceeds/drops below a record count | Pro |
| **Field Value Match** | Alert when a specific field value matches a pattern | Pro |
| **PII Detection** | Alert when potential personally identifiable information is detected | Business |
| **Data Anomaly** | Alert when record creation/deletion rate is abnormal | Business |
| **Growth Rate** | Alert when data growth exceeds a defined rate | Pro |

---

## 9. Capability 4: Automations

The Automations capability tracks, documents, and provides insights into Airtable automations. **Requires Dynamic backup mode with full D1 or PostgreSQL — not available on schema-only or static backups.**

### 9.1 Feature Matrix

> \* Not available when using static file backups only or D1 schema-only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Automation Backup** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Automation Changelog** | ✗ | ✗ | ✓* (90 days) | ✓* (6 months) | ✓* (12 months) | ✓* (24 months) | ✓* (custom) |
| **Automation Insights** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **Automation Alerts** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Automation Documentation** | ✗ | ✗ | ✗ | ✓* (manual) | ✓* (manual + AI) | ✓* (manual + AI) | ✓* (manual + AI) |
| **Automation Visualization** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |

---

## 10. Capability 5: Interfaces

The Interfaces capability tracks, documents, and provides insights into Airtable interfaces. **Requires Dynamic backup mode with full D1 or PostgreSQL — not available on schema-only or static backups.**

### 10.1 Feature Matrix

> \* Not available when using static file backups only or D1 schema-only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Interface Backup** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Interface Changelog** | ✗ | ✗ | ✓* (90 days) | ✓* (6 months) | ✓* (12 months) | ✓* (24 months) | ✓* (custom) |
| **Interface Insights** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **Interface Alerts** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Interface Documentation** | ✗ | ✗ | ✗ | ✓* (manual) | ✓* (manual + AI) | ✓* (manual + AI) | ✓* (manual + AI) |
| **Interface Visualization** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |

---

## 11. Capability 6: AI

The AI capability provides advanced artificial intelligence capabilities layered on top of the customer's data. **Requires Dynamic backup mode with PostgreSQL database (Pro+) — not available on static file backups or D1 databases.**

### 11.1 Feature Matrix

> \* Not available when using static file backups only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **AI-Assisted Documentation** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **AI Schema Insights** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **MCP Server** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **RAG Service** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Chatbot (Hosted)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Chatbot Embed Code** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Chatbot Filters** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **AI Skills (Custom)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **Vector Database** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Bring Your Own AI Model** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |

### 11.2 AI Feature Descriptions

| Feature | Description |
|---|---|
| **MCP Server** | Model Context Protocol server that exposes the customer's data layer to AI clients (Claude, ChatGPT, etc.). Enables AI assistants to query, analyze, and act on the data. |
| **RAG Service** | Retrieval-Augmented Generation pipeline that indexes the customer's data into a vector database, enabling contextual AI responses grounded in their actual data. |
| **Chatbot (Hosted)** | A Baseout-hosted conversational AI interface that can query the customer's data. Configurable with filters to restrict which data/tables the chatbot can access. |
| **Chatbot Embed Code** | An embeddable snippet that allows the customer to place the chatbot in their own website, app, or Airtable interface. |
| **AI Skills** | Custom-defined AI routines that combine the customer's API, tools, and data with Baseout's AI layer to automate specific workflows. |
| **Vector Database** | A vector database (provisioned by Baseout) that stores embeddings of the customer's data for semantic search and RAG functionality. |
| **Bring Your Own AI Model** | Enterprise customers can connect their own AI model (e.g., a fine-tuned GPT, Claude, or open-source model) to Baseout's AI pipeline. |

---

## 12. Capability 7: Analytics

The Analytics capability provides reporting, dashboards, and data visualization capabilities. **Requires Dynamic backup mode for most features — not available on static file backups only.**

### 12.1 Feature Matrix

> \* Not available when using static file backups only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Basic Usage Metrics** | ✓ (backup stats only) | ✓ (backup stats only) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Record Trend Charts** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Storage Growth Charts** | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* | ✓* |
| **Custom Reports** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* (5 reports) | ✓* (unlimited) |
| **Custom Dashboards** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* (3 dashboards) | ✓* (unlimited) |
| **Data Flow Visualization** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Scheduled Report Delivery** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Report Export (PDF/CSV)** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |

---

## 13. Capability 8: Governance

The Governance capability provides data governance, compliance, and lifecycle management capabilities. **Requires Business or Enterprise tier.**

### 13.1 Feature Matrix

> \* Not available when using static file backups only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Data Quality Rules** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Classification** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Lineage** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Retention Policies** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Access Controls** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Compliance Reporting** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **Data Cataloging** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Audit Trail** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **PII / Sensitive Data Scanning** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Data Sharing Rules** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **SOC 2 / GDPR Tools** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **Data Lifecycle Management** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |

### 13.2 Governance Rule Categories

- **Data Quality** — Validation rules, completeness checks, consistency rules
- **Data Classification** — Label data as Public, Internal, Confidential, Restricted
- **Data Lineage** — Track where data originates, how it flows, and what depends on it
- **Data Retention** — Define how long data should be kept and when it should be purged
- **Data Access** — Define who can access what data and under what conditions
- **Data Monitoring** — Track usage and access patterns
- **Compliance** — Map data handling to regulatory frameworks (GDPR, CCPA, SOC 2)

---

## 14. Capability 9: Integrations

The Integrations capability provides connectivity to external services and direct data access. **Availability varies by tier.**

### 14.1 Feature Matrix

> \* Not available when using static file backups only.

| Feature | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Airtable REST API** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Baseout Inbound API** | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* | ✓* |
| **SQL REST API (PG REST)** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **Direct SQL Access** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Webhook Integrations (inbound)** | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| **Zapier Connector** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **Make.com Connector** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* |
| **HyperDB Integration** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **Airtable Writeback** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |
| **Custom API Connectors** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* |

### 14.2 API Access Details

| API | Authentication | Rate Limits | Min Tier |
|---|---|---|---|
| **Baseout Inbound API** | Bearer token (per-Space) | 10,000 calls/mo (Growth), 50,000 (Pro), 200,000 (Business), Unlimited (Enterprise) | Growth |
| **SQL REST API (PG REST)** | Bearer token (per-Space) | 10,000 queries/mo (Pro), 50,000 (Business), Unlimited (Enterprise) | Pro |
| **Direct SQL Access** | Connection string (read-only by default) | N/A (database-level limits apply) | Business |

### 14.3 Integration Dependency Note

> **WARNING:** All Integration capability features beyond Airtable REST API connectivity **require Dynamic backup mode with a full D1 or PostgreSQL database.** Customers using static file backups only, or Trial/Starter with D1 schema-only, cannot use API access, SQL access, or third-party connectors because there is no Baseout-managed full data layer to query.

---

## 15. Data Intake Methods

Baseout collects data from Airtable through multiple intake channels. Availability varies by tier.

| Intake Method | Description | Tiers |
|---|---|---|
| **Airtable REST API** | Primary data collection. Schema discovery, record export, metadata retrieval. | All |
| **Airtable Webhooks** | Real-time change notifications for records and schema. Enables instant backup. | Business+ |
| **Baseout Inbound API** | Public API for submitting data that the Airtable REST API does not expose (Automations, Interfaces, Synced Tables, custom metadata). | Growth+ |
| **Manual Forms** | Web-based forms within Baseout for manually entering documentation, annotations, and metadata about Bases, Tables, Fields, Automations, and Interfaces. | Starter+ |
| **Airtable Scripts** | Baseout-provided scripts that run inside Airtable's Scripting Extension to extract data not available via REST API. | Launch+ |
| **Airtable Automations** | Baseout-provided automation templates that send data to the Baseout Inbound API on a schedule. | Launch+ |
| **Custom Interface Extensions** | Baseout-provided Airtable custom extensions that extract and submit data from within the Airtable interface. | Pro+ |
| **Airtable Enterprise API** | Additional data extraction available only to Airtable Enterprise accounts (org-level metadata, user management). | Enterprise |

---

## 16. Notifications & Alerting

### 16.1 Notification Channels by Tier

| Channel | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Email** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **In-App (Dashboard)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Slack** | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Microsoft Teams** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Webhook (outbound)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **PagerDuty** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

### 16.2 Notification Types

| Notification | Description | Tiers |
|---|---|---|
| **Backup Success** | Confirmation when a Backup Run completes successfully | All |
| **Backup Failure** | Alert when a Backup Run fails | All |
| **Backup Warning** | Alert when a Backup Run completes with warnings (partial data, skipped tables) | All |
| **Credit Warning** | Alert at 50%, 75%, 90%, 100% of monthly credit allotment | All |
| **Credit Pause** | Alert when Trial credits are exhausted and activity has been paused | Trial |
| **Overage Alert** | Alert when overage charges are being incurred | Starter+ |
| **Schema Change** | Notification when a schema change is detected | Starter+ |
| **Data Alert** | Notification when a user-configured data alert triggers | Pro+ |
| **Health Score Change** | Notification when a Base's Health Score changes significantly | Starter+ |
| **Restore Complete** | Confirmation when a Restore operation finishes | All |
| **Monthly Audit** | Monthly summary of backup health, storage usage, and schema changes | All |

---

## 17. Open Questions

The following questions need to be resolved before this specification can be finalized.

### Naming & Hierarchy

| # | Question | Impact | Suggested Answer |
|---|---|---|---|
| 1 | **"Space" confirmed as the top-level container name.** Chosen over "Project" (implies temporality) and "Workspace" (conflicts with Airtable's own term). | All naming, UI, documentation, API | **Resolved: "Space"** |
| 2 | **Platform hierarchy resolved.** Each Space is bound to a single Platform (no mixing). Platform sits at the Organization level above Spaces. Multi-Platform Spaces (V2+) will aggregate across Single-Platform Spaces rather than mix platforms within one Space. Capabilities are platform-specific and will vary per Platform as new ones are added. | Data model, multi-platform architecture | **Resolved.** See §2 for full hierarchy. |
| 3 | **Brand spelling: "Baseout" vs "Base Out" vs "BaseOut"?** | All branding, code, documentation | Need final decision. This document uses "Baseout" as single word. |

### Pricing & Tiers

| # | Question | Impact | Suggested Answer |
|---|---|---|---|
| 4 | **Tier names confirmed: Trial / Starter / Launch / Growth / Pro / Business / Enterprise.** Progressive naming chosen. Dynamic DB is a capability within tiers, not a tier differentiator. | All pricing pages, marketing, UI | **Resolved.** |
| 5 | **Legacy migration: how do existing On2Air static-backup users map to new tiers?** Existing users need a migration path that locks out dynamic features until they upgrade. | Billing migration, feature flags, UX | Recommend mapping by usage tier (record count, bases) with `dynamic_locked: true` flag on the Organization. Dynamic features show as upgrade CTAs, not hidden. See Pricing_Credit_System.md §5–6 for full migration strategy. |
| 6 | **Price points resolved: Trial $0 / Starter $29 / Launch $59 / Growth $99 / Pro $199 / Business $399 / Enterprise Custom.** Annual billing: $23 / $47 / $79 / $159 / $319 / Custom. | Revenue model | **Resolved.** See §3. |
| 7 | **Record and attachment limits removed. Credits are the natural limiter.** No hard caps on records or attachments. Monthly credit allotment determines how much data can be transferred per billing period. | Tier sizing, overage revenue | **Resolved.** See §4.1 and §5.2. |
| 8 | **Starter manual backup runs: 0/month.** Manual on-demand runs begin at Launch (2/mo). Additional runs beyond included count consume 10 credits each. | Starter feature value | **Resolved.** |
| 9 | **Overage model resolved: credit-based.** Overages are priced per credit at $0.008–$0.004/credit depending on tier. No per-record or per-attachment overage rates. Storage overage is billed separately per GB. | Revenue, customer perception | **Resolved.** See §5.1–5.3. |

### Capabilities & Features

| # | Question | Impact | Suggested Answer |
|---|---|---|---|
| 10 | **Should Automation and Interface backup include the execution history / run logs, or just the configuration?** | Scope of backup, storage requirements | Recommend **configuration only** for V1. Run logs are high-volume and complex. |
| 11 | **AI Capability: Are MCP Server and RAG Service V1 features or V2?** The PRD marks MCP as V2, but the raw input describes it as a capability. | Engineering scope, timeline | Recommend **V2**. Include AI-assisted documentation in V1 only. |
| 12 | **Governance Capability: Is this V1 or V2?** It's a large capability with significant engineering effort. | Engineering scope, timeline | Recommend **V2**. PII Detection in the Data capability could be V1 as a preview. |
| 13 | **Integration Capability: Which third-party connectors are V1?** Zapier, Make.com, HyperDB? | Partnership requirements, engineering scope | Recommend **V2** for all third-party connectors. SQL REST API and Inbound API are V1. |
| 14 | **Should we offer monthly-only pricing or require annual commitment for discounts?** | Cash flow, churn | Recommend **offering both** with ~20% discount for annual. |

### Technical

| # | Question | Impact | Suggested Answer |
|---|---|---|---|
| 15 | **What is the API rate limit for the Baseout Inbound API per tier?** | Infrastructure sizing, pricing | Proposed: 10K/mo (Growth), 50K/mo (Pro), 200K/mo (Business), Unlimited (Enterprise). |
| 16 | **Should Direct SQL Access be read-only or read-write?** Write access could be dangerous. | Data integrity, liability | Recommend **read-only by default**. Write access as opt-in for Enterprise only. |
| 17 | **What vector database provider for the AI capability?** Options: Pinecone, Weaviate, pgvector (within existing PG), Cloudflare Vectorize. | Infrastructure, cost | Recommend **pgvector** to keep within existing PostgreSQL infrastructure. Only for Dedicated PG and BYODB tiers. |

---

## Appendix A: Capability Availability Summary

| Capability | Trial | Starter | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| **Backup** | ✓ (core) | ✓ (core) | ✓ (core) | ✓ (core) | ✓ (core) | ✓ (core) | ✓ (core) |
| **Schema** | ✓ (basic) | ✓ (basic) | ✓ | ✓ | ✓ (full) | ✓ (full) | ✓ (full) |
| **Data** | ✗ | ✗ | ✓ (basic) | ✓ | ✓ | ✓ (full) | ✓ (full) |
| **Automations** | ✗ | ✗ | ✓ (basic) | ✓ | ✓ | ✓ (full) | ✓ (full) |
| **Interfaces** | ✗ | ✗ | ✓ (basic) | ✓ | ✓ | ✓ (full) | ✓ (full) |
| **AI** | ✗ | ✗ | ✗ | ✗ | ✓ (docs only) | ✓ | ✓ (full) |
| **Analytics** | ✓ (basic) | ✓ (basic) | ✓ | ✓ | ✓ | ✓ (full) | ✓ (full) |
| **Governance** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ (full) |
| **Integrations** | ✗ | ✗ | ✗ | ✓ (API only) | ✓ (API + SQL REST) | ✓ (full) | ✓ (full) |
| **Smart Cleanup** | ✓ (basic) | ✓ (basic) | ✓ | ✓ | ✓ | ✓ (full) | ✓ (full) |

## Appendix B: Implementation Priority (V1 vs V2)

| Feature / Capability | V1 | V2 | Notes |
|---|---|---|---|
| Backup (all modes) | ✓ | | Launch product |
| Restore (table-level, point-in-time) | ✓ | | Launch product |
| Smart Rolling Cleanup | ✓ | | Launch product |
| Schema Visualization | ✓ | | Key differentiator |
| Schema Changelog | ✓ | | Key differentiator |
| Schema Health Score | ✓ | | Key differentiator |
| Schema Management Actions | | ✓ | Write-back to Airtable |
| Data Capability (basic metrics, changelog) | ✓ | | Requires Dynamic |
| Data Alerts & PII Detection | | ✓ | Complex, lower priority |
| Automations Backup + Changelog | ✓ | | Via Inbound API |
| Automations Visualization | | ✓ | Complex |
| Interfaces Backup + Changelog | ✓ | | Via Inbound API |
| Interfaces Visualization | | ✓ | Complex |
| AI-Assisted Documentation | ✓ | | In Schema & Automation capabilitys |
| AI MCP Server | | ✓ | Per PRD |
| AI RAG / Chatbot / Vector DB | | ✓ | Significant infrastructure |
| Analytics (basic) | ✓ | | From backup metadata |
| Analytics (custom dashboards, reports) | | ✓ | Complex UI |
| Governance Capability | | ✓ | Entire capability is V2 |
| SQL REST API (PG REST) | ✓ | | For DB-tier plans |
| Direct SQL Access | ✓ | | For Dedicated PG + BYODB |
| Baseout Inbound API | ✓ | | Documented, authorized |
| Third-Party Connectors (Zapier, Make) | | ✓ | Partnership required |
| HyperDB Integration | | ✓ | Specialized |
| Airtable Writeback | | ✓ | Risky, needs safeguards |

---

*Version 1.1 — Updated April 23, 2026. Pricing, credit system, and tier limits updated to reflect final design decisions. Trial tier added throughout. See Pricing_Credit_System.md for full credit system database architecture and On2Air migration strategy.*
