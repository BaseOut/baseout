# Product Requirements Document: Baseout
**Version:** 1.1 (V1 Scope)
**Date:** March 25, 2026
**Status:** Draft — Scope Largely Locked; Remaining Open Questions Noted
**Source:** Meeting transcript (Mar 24, 2026) + Brainstorming Agenda + Stakeholder Q&A (Mar 25, 2026)

> **Legend:**
> - ✅ Answered / decided
> - ⚠️ Partially answered — needs elaboration
> - ❓ Still open — requires follow-up
> - 🚫 Out of scope / explicitly deferred

---

## Table of Contents

1. [Vision & Positioning](#1-vision--positioning)
2. [Backup & Restore Core](#2-backup--restore-core)
3. [Data Intelligence Features](#3-data-intelligence-features)
4. [Architecture & Technology Stack](#4-architecture--technology-stack)
5. [Data Model & Storage Architecture](#5-data-model--storage-architecture)
6. [User Experience & Design](#6-user-experience--design)
7. [Integrations & Extensibility](#7-integrations--extensibility)
8. [Business, Operations & Launch](#8-business-operations--launch)
9. [MoSCoW Prioritization](#9-moscow-prioritization)
10. [Feature Capability Scope — V1](#10-feature-capability-scope--v1)
11. [Open Questions Master List](#11-open-questions-master-list)
12. [Action Items](#12-action-items)
13. [Authentication](#13-authentication-)
14. [Testing Strategy](#14-testing-strategy-)
15. [In-App Help & Documentation](#15-in-app-help--documentation-)
16. [Admin & Observability System](#16-admin--observability-system-)
17. [Third-Party Services & Integrations](#17-third-party-services--integrations-)
18. [Git Branching, Environments & CI/CD](#18-git-branching-environments--cicd-)
19. [Email Templates](#19-email-templates-)
20. [Security, Secrets & Encryption](#20-security-secrets--encryption-)
21. [Database Schema, ORM & Conventions](#21-database-schema-orm--conventions-)

---

## 1. Vision & Positioning

### 1.1 One-Sentence Pitch ✅

> **"Baseout is the backup, restore, and data intelligence layer for Airtable — giving platform admins real-time protection, schema visibility, and direct SQL access to their own data."**

V1 positions as a best-in-class Airtable backup and admin utility. V2 grows into a full multi-platform data management solution.

### 1.2 Relationship to On2Air Backups ✅

Baseout is a **full rebrand and next-generation replacement** of the On2Air backup product — not a parallel product. The On2Air brand is retired; Baseout becomes the single unified product.

- Non-backup On2Air products deprecated effective **April 1, 2026**
- ~200 paying backup customers mapped to equivalent new tiers (Starter/Launch/Growth) based on usage
- Legacy users receive a `dynamic_locked: true` flag — dynamic features shown as upgrade CTAs, preserving static backup without disruption
- Customers grandfathered at equivalent pricing for a defined transition period

### 1.3 Primary User ✅

Baseout is a **utility admin tool** targeting **Airtable platform admins** — the people responsible for building, managing, and protecting their organization's Airtable infrastructure. This includes internal IT managers, RevOps/BizOps owners, and Airtable consultants managing multiple client accounts.

**Primary persona: The Airtable Platform Admin**
- Manages one or more Airtable workspaces on behalf of an organization or clients
- Needs reliable, auditable, low-maintenance backup infrastructure
- Cares about data integrity, schema visibility, and fast recovery when something breaks
- Technically capable — comfortable with OAuth, storage config, and SQL access
- As Baseout expands to other platforms (V2+), this persona extends to admins of Notion, HubSpot, Salesforce, etc.

**Secondary personas (V2 expansion):**
- Developer building on top of the SQL database layer (Business / BYODB tier)
- Enterprise IT/compliance officer requiring SOC 2, SSO, and data sovereignty controls

> **Design implication:** The UI should feel like a professional admin utility — functional, information-dense, trustworthy. Think operations console, not lifestyle product.

### 1.4 Top Pain Points Solved ✅

1. **Fear of data loss / accidental deletion** — Scheduled backups with full restore pipeline
2. **No external, governed copy of data** — Best practice is to store data *outside* Airtable; Airtable's own native snapshots do not satisfy data governance requirements
3. **No visibility into schema complexity and health** — Schema visualization, history tracking, and health scoring give admins a live picture of their Airtable architecture
4. **Data locked in Airtable's proprietary format** — Dedicated SQL database per Space gives users direct, portable access to query and act on their own data

### 1.5 Competitive Landscape ✅

| Competitor | Status | Where Baseout Wins |
|---|---|---|
| **Airtable native snapshots** | Active | Native snapshots do not satisfy external data governance / best-practice backup requirements. Baseout stores data *outside* Airtable. |
| **Sync Inc** | ⚠️ Out of business | No longer a factor. |
| **Whalesync** | Active but narrowing | Pivoting to a specific marketing niche; losing general-purpose positioning. Baseout remains general-purpose. |
| **Coefficient** | Active | Focused on spreadsheet sync, not deep Airtable backup or schema intelligence. |
| **Custom scripts** | DIY | Baseout is far more convenient, maintained, and feature-rich than homebuilt solutions. |

**Static backup differentiation:**
- Only backup solution focused exclusively on Airtable — deepest product understanding
- Most storage destinations in the market, including the **only solution supporting OneDrive**
- Competitively priced for the static backup segment
- On static plans, customer record data is **never stored on Baseout servers** — data streams directly to the customer's own storage destination, a key privacy differentiator vs. competitors who store all data in their own databases

**Dynamic differentiation:**
- Only solution going deep into **unlocking data stored in Airtable** as a live SQL layer
- Supports multiple storage backends *and* multiple database backends
- **Bring Your Own Storage (BYOS) and Bring Your Own Database (BYODB)** — unique in the market; competitors are moving away from this
- On dynamic plans, Baseout **does store customer record data** in a provisioned database — this is the explicit value exchange for SQL access, real-time sync, and data intelligence features. Customers on these plans are opting in to hosted storage in exchange for a live, queryable data layer. BYODB tier gives enterprise customers full control by hosting in their own environment.

### 1.6 Monetization Model ✅ *(See §8 for full tier table)*

Tiered SaaS. **No free tier** — free trial only. Trial is:
- **Run-limited:** One successful backup run included
- **Time-limited:** 7 days from sign-up; subscription ends at day 7 with upgrade prompt
- **Data-capped:** Max 1,000 records, 5 tables, 100 attachments. Backup completes successfully at the cap and notifies the user it was a limited trial preview
- **No credit card required** for trial. Stripe subscription created automatically at $0 on sign-up
- On upgrade: credit card collected, existing Stripe subscription price is swapped to the selected paid plan

Schema visualization available before full registration as a pre-conversion hook.

---

## 2. Backup & Restore Core

### 2.1 Existing Capabilities — Carry-Forward Decisions

| Capability | Status | Decision |
|---|---|---|
| Scheduled backups (interval-based) | ✅ Exists | **Keep + extend** with event-driven/webhook model |
| Multi-base Spaces | ✅ Exists | **Keep** — Space abstraction is valid |
| Dynamic base discovery (OAuth meta scan) | ✅ Exists | **Keep** — surface auto-add events to user via notification |
| Table & record export (CSV) | ✅ Exists | **Keep CSV**; JSON optional; Parquet/DB-native are V2 |
| Attachment backup (dedup + retry) | ✅ Exists | **Keep** — full-fidelity default |
| Cloud storage destinations | ✅ Exists | **Keep all** + launch S3 (dev-complete) + add Cloudflare R2 |
| Full restore pipeline | ✅ Exists | **Keep**: tables → records → linked records → attachments |
| Backup history & metrics | ✅ Exists | **Keep + expand** into user-facing dashboard |

### 2.2 Backup Schedules ✅

- **Monthly** — all tiers (Starter+)
- **Weekly** — Launch and above
- **Daily** — Pro and above
- **Instant (Webhook-driven)** — Pro and above

> **Note:** The "Continuous" backup schedule offered in On2Air is **not carried forward** into Baseout. Webhook-based incremental backup on dynamic plans replaces the need for continuous polling-style runs.

Higher-tier plans with webhooks receive **instant updates**; lower plans use **polling-based** updates.

### 2.3 Restore — V1 Scope ✅

Restore in V1 is intentionally simple. Airtable's own API limitations constrain what is feasible.

**What V1 restore supports:**
- **Base-level restore** — restore an entire Base from any snapshot (all tiers)
- **Point-in-time restore at the table level** — any backup snapshot in history can be used as the restore point (all tiers)
- **Restore always creates new data** — never overwrites live data; restores into a new base, or as a new table in an existing base
- **Basic post-restore verification** — record count validation and error audit at completion (Growth+)
- **Audit error notifications** during the restore process
- **Community Restore Tooling** (Pro+) — for entities that cannot be automatically restored (Automations, Interfaces), Baseout provides curated prompts and instructions for using AI coding assistants to reconstruct configurations via the Airtable API
- **AI-Assisted Restore Prompts** (Pro+) — AI-generated step-by-step instructions for manual restoration of complex entities

**What V1 restore does NOT support:**
- Restore preview / dry run — not needed given the new-data-only approach
- Record-level restore — deferred; revisit if user demand warrants it
- Cross-base restore (Table A from Base X into Base Y) — deferred to V1.1 or V2

### 2.4 Backup Encryption ✅

| Storage Location | Encryption Status |
|---|---|
| Baseout managed database (internal tiers) | ✅ Encrypted at rest — always |
| Baseout managed file storage (Cloudflare R2) | ✅ Encrypted at rest — always |
| External customer storage (Google Drive, Dropbox, Box, OneDrive, S3) | ⚠️ Dependent on the storage provider — Baseout does not control this |

Key ownership: platform-managed encryption for Baseout hosted tiers. Enterprise/BYODB Organizations host their own environment and manage their own keys.

### 2.5 Real-Time Failure Alerting ✅

- **Email** — V1 for all plans (monthly audit + per-failure alerts)
- **Slack / other channels** — V1 for higher-tier plans
- **In-app notifications** — surfaced on dashboard as top-of-mind items

### 2.6 Backup Verification ✅

Basic verification is included in V1:
- Record count validation at end of restore
- Audit error log generated during restore
- Backup run health status surfaced in history dashboard (good / warning / failure)

### 2.7 New Backup Feature — Webhook-Based Incremental ✅

- Ingest Airtable webhooks for record create, update, and delete events
- Store change events in per-client change log table
- Scheduled job syncs change log to determine what needs updating
- Fall back to full-table re-read if webhook gap is detected
- Instant updates on higher plans; polling on lower plans

### 2.8 Attachment Handling ✅

- Composite unique ID per attachment: `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`
- Deduplication check before processing
- Proxy streaming for destinations that require it (Box, Dropbox)
- Airtable URL expiry (~1–2 hrs) handled by refresh process
- Attachment data → primary **storage** destination; relational data → **database** tier

### 2.9 What Gets Backed Up ✅

> **†** Automations, Interfaces, and Custom Documentation are **not available via the Airtable REST API** and cannot be automatically backed up. They must be submitted by the user through a Baseout intake method (Inbound API, Airtable Scripts, Airtable Automations, or Manual Forms).

| Entity | Collection Method | Min Tier |
|---|---|---|
| **Schema** (Tables, Fields, Views) | Automatic (REST API) | Starter |
| **Records** | Automatic (REST API) | Starter |
| **Attachments** | Automatic (REST API) | Starter |
| **Automations** † | Manual (user-submitted via intake) | Growth |
| **Interfaces** † | Manual (user-submitted via intake) | Growth |
| **Custom Documentation** † | Manual (user-submitted via intake) | Pro |

### 2.10 Backup Auditing ✅

| Feature | All Tiers | Launch+ |
|---|---|---|
| **Backup Audit Report** | ✓ | ✓ |
| **Per-Entity Verification** | ✓ | ✓ |
| **Issue Notifications** | ✓ | ✓ |
| **Monthly Backup Summary** | ✓ | ✓ |
| **Detailed Audit Logs** | — | ✓ |
| **Audit History Retention** | — | 90 days (Launch) → 6 mo (Growth) → 12 mo (Pro) → 24 mo (Business) → Custom (Enterprise) |

---

## 3. Data Intelligence Features

### 3.1 Schema Visualization ✅

V1 includes **schema visualization** — not a schema builder. The scope is read-only visualization of existing schema, auto-generated from backup/schema metadata.

- Diagrams auto-generate from schema data collected during backup runs and via API submissions
- No manual import required
- V2 consideration: allow admins to experiment with proposed schema changes and simulate the result

> ❓ **Open Question #1:** Diagram export formats — PNG, SVG, PDF, interactive HTML, embeddable widget? TBD for V1 scope lock.

### 3.2 Schema History & Change Log ✅

- Track all schema changes at the **field and table level** — names, types, additions, deletions
- Human-readable change log: e.g. "Field X was deleted on March 12" — **V1**
- Powered by webhook integration for instant schema change detection
- Schema history stored without requiring record-level data (available on schema-only plans)
- Foundation for V2 AI-driven schema monitoring and cleanup suggestions

### 3.3 Base Health Scoring ✅

V1 includes base-level and table-level health evaluation:
- **Audit score / grade** for base cleanliness — surfaces orphaned tables, unused fields, circular lookups, missing descriptions, formula errors
- **Configurable rules** — admins can define what matters to them and set custom evaluation criteria
- Score displayed on dashboard per base/Space

### 3.4 Baseout Inbound API ✅

Baseout exposes a **documented public API for data submission** — V1.

**Purpose:** Airtable's REST API does not expose everything (automations, interfaces, synced tables, etc.). Admins or agents can submit this data to Baseout via the inbound API, and Baseout will store and track history for it.

- Secure, authorized API access
- Designed to be agent/AI-accessible: browsers, scripts, or AI agents can inspect and post data
- Enables schema history for elements not covered by the Airtable REST API
- Lays the groundwork for MCP integration (V2)

### 3.5 SQL REST API ✅

For plans that include a hosted database, Baseout exposes a **SQL REST API** (via PG REST) allowing admins to query their database directly without a SQL client.

- Available on plans that include database access
- Not available on static-only plans

### 3.6 Analytics ✅

- **V1:** Basic usage metrics from backup metadata — record count trends, storage growth, table size over time, backup run history
- **V2:** Richer reporting — AI-assisted analysis, cross-base comparisons, anomaly detection

### 3.7 Data Dictionary / Documentation 🚫 V2

Auto-generated data dictionaries and documentation exports (Markdown, PDF, Confluence, Notion) are deferred to V2.

### 3.8 Migration & Cloning 🚫 V2

Schema-only cloning, cross-workspace migration, and template generation are V2.

---

## 4. Architecture & Technology Stack

### 4.1 Confirmed Technology Stack ✅

| Layer | Decision |
|---|---|
| **Frontend framework** | Astro.js |
| **CSS / UI** | Tailwind + DaisyUI |
| **Backend / API** | Cloudflare Workers (microservices) |
| **Real-time / stateful** | Cloudflare Durable Objects |
| **Job queue / workflows** | Trigger.dev |
| **Authentication** | better-auth (open source) |
| **CI/CD** | GitHub + Cloudflare Pages auto-deploy |
| **Hosting** | Cloudflare (Workers + Pages) |
| **Master database** | PostgreSQL on Digital Ocean |
| **Client DB — entry** | Cloudflare D1 (SQLite) |
| **Client DB — mid** | Shared PostgreSQL on Digital Ocean |
| **Client DB — dedicated** | Neon / Prisma / Supabase (per-Space) |
| **Client DB — enterprise** | Amazon RDS or any Postgres (BYODB) |
| **File storage (internal)** | Cloudflare R2 |
| **Monitoring** | Cloudflare built-in; additional tooling TBD post-build |

### 4.2 Service Architecture ✅

Baseout is a **microservices architecture**:

- **Web application** — Astro.js + Cloudflare Workers (frontend + API layer)
- **Backup engine** — separate service; Durable Objects + Trigger.dev workflows
- **Durable Object per connection** — each Airtable (or future platform) connection gets its own Durable Object; supports multiple connections per Organization
- **Durable Object per Space** — manages backup state, acts as rate-limit gateway for Airtable API calls
- Multiple connections supported: users can connect to multiple Airtable Organizations or storage locations

### 4.3 Architecture Diagram ✅

```
[Airtable REST API + Webhooks]
        |
[Cloudflare Durable Object — per Connection]
        |   Rate-limit gateway; queues API calls
        |
[Cloudflare Durable Object — per Space]
        |   Backup state; cron-like controller
        |
[Trigger.dev Workflows] ← One per base backup; unlimited simultaneous; no time limits
        |
[Astro.js / Cloudflare Workers — Web + API Layer]
        |
[Master Organization DB — Digital Ocean PostgreSQL]
        |   Maps Organizations → Durable Object IDs
        |
        ├── [Cloudflare R2] ← Attachment / file storage
        ├── [Cloudflare D1] ← SQLite (entry tier)
        ├── [Shared PostgreSQL] ← Digital Ocean (mid tier)
        ├── [Dedicated PostgreSQL] ← Neon / Prisma / Supabase (dedicated tier)
        └── [Customer DB + Storage] ← BYODB (enterprise tier)
```

### 4.4 Real-Time Progress ✅

- WebSockets implemented via Cloudflare Durable Objects — V1
- Client connects to Durable Object directly for live backup status and progress
- Enables real-time dashboard updates without polling

### 4.5 CI/CD & Testing ✅

- **CI/CD:** GitHub + Cloudflare Pages auto-deploy
- **Testing:** Unit tests required for every pipeline release; testing environment to be set up
- Integration / E2E testing: scoped post-V1 based on coverage needs

### 4.6 Monitoring & Observability ✅

- **V1:** Cloudflare built-in observability (Workers Analytics, Durable Object metrics)
- **Post-launch:** Additional tooling evaluated after application is built and usage patterns are understood

---

## 5. Data Model & Storage Architecture

### 5.1 Plan-Based Data Storage Model ✅

A core distinction across plan types is **whether Baseout stores customer record data** on its own infrastructure:

| Plan Type | Baseout Stores Record Data? | Where Data Lives |
|---|---|---|
| **Starter** (Static only) | ❌ No — never when using BYOS | Streams directly to customer's own storage (Google Drive, Dropbox, Box, OneDrive, S3); Baseout holds only metadata and IDs. If using managed R2, files are stored on Baseout servers subject to storage limits. |
| **Launch** (Static + Schema DB) | ❌ No record data | Baseout stores schema only (field names, types, table structure) in D1 — no record-level content |
| **Growth / Pro / Business** (Static + Full Dynamic) | ✅ Yes — opt-in | Customer record data stored in Baseout-provisioned database (D1, Shared PG, or Dedicated PG); explicit value exchange for SQL access and real-time sync |
| **Enterprise / BYODB** | ✅ Yes — customer-controlled | Record data stored in the customer's own database; Baseout is granted write access only — data never passes through Baseout infrastructure |

**On2Air legacy behavior is preserved on static plans:** No record data ever written to disk on Baseout servers — read into memory, converted to CSV, streamed to destination. This remains a privacy differentiator for static-tier customers.

**Dynamic plans represent an intentional pivot:** Customers opting into dynamic plans accept that Baseout stores their record data in exchange for a live, queryable SQL layer, real-time sync, and data intelligence features. This must be clearly disclosed in pricing pages and terms of service.

### 5.2 Per-Space Database Contents ✅

Each provisioned Space database contains normalized tables for:
- Bases
- Tables
- Fields
- Views
- Automations
- Interfaces
- Synced tables
- Change log (webhook events)
- Schema snapshots / diffs

All entities linked back to the parent base and Space.

### 5.3 Database Tier Progression ✅

| Tier | Plan(s) | Database | Notes |
|---|---|---|---|
| Schema-only D1 | Launch | Cloudflare D1 (SQLite) | Schema data only; no record data |
| Full D1 | Growth | Cloudflare D1 (SQLite) | Full data; cheap; SQL-accessible |
| Shared PostgreSQL | Pro | Shared PG on DigitalOcean | Multiple Spaces per server; schema-level isolation |
| Dedicated PostgreSQL | Business | Neon / Supabase / DigitalOcean | One DB per Space; provisioned on demand |
| Enterprise / BYODB | Enterprise | Amazon RDS or any PostgreSQL | Customer-provided; Baseout writes to it |

**Migration between tiers must be supported** — when a customer upgrades, their data must migrate from D1 (SQLite) to PostgreSQL cleanly. A migration process and tooling is a V1 engineering requirement.

### 5.4 Database Admin Area ✅

An **internal admin panel** is required to:
- Track all provisioned databases across all customers and tiers
- Monitor utilization and storage per database
- Identify which databases belong to which Organizations
- Support operational management (migrations, health checks, decommissioning)

### 5.5 Storage Architecture ✅

| Storage Type | Used For | Encryption |
|---|---|---|
| Cloudflare R2 (internal) | Attachments, CSV file backups on managed plans | ✅ At rest |
| Customer external storage (Google Drive, Dropbox, Box, OneDrive, S3) | CSV file backups on static plans | ⚠️ Provider-dependent |
| Per-Space database (D1 / PostgreSQL) | Relational data on dynamic plans | ✅ At rest |

### 5.6 Data Retention ✅

- Retain all backups for the tier's changelog retention period (30 days on Starter, up to 24 months on Business, Custom on Enterprise)
- Beyond the retention period: prune every 6th interval (plan-dependent)
- Smart cleanup exposed as user-configurable settings in V1 dashboard

### 5.7 Plan Limits ✅ (defined in Features spec)

Each plan enforces limits on:
- Storage (GB cap with paid overage)
- Number of Bases per Space
- Backup frequency
- Database size
- Number of Spaces per Organization

> ✅ **Resolved:** Specific per-tier limits, record caps, and overage rates are defined in the Baseout Features spec §3–§5. See that document for the authoritative tier limit tables.

### 5.8 Offline / Local Mode 🚫

Not applicable. Backend runs on Cloudflare servers. A front-end offline mode for the web app is technically feasible but not in scope for V1.

---

## 6. User Experience & Design

### 6.0 Design Direction ✅

Baseout is a **utility admin tool**. UX principles:
- **Functional over decorative** — information density, clear status indicators, fast access to controls
- **Trust signals first** — backup status, last run time, success/failure state, and storage health immediately visible
- **Power over simplicity** — expose configuration rather than hide it; this audience can handle it
- **Airtable-aware but distinct** — use Airtable field type iconography and terminology where it aids recognition; establish a distinct Baseout visual brand identity rather than mimicking Airtable's consumer aesthetic
- **Platform-agnostic foundation** — even though V1 is Airtable-only, the UI framework must be built to support multiple platforms (Notion, HubSpot, etc.) so switching context is built into the architecture from day one

### 6.1 User Journey ✅

```
Pre-auth: OAuth → instant schema visualization → CTA to sign up
                           ↓
Sign up → Free trial (one backup run, limited data to explore)
                           ↓
Onboarding wizard → Connect Airtable → Configure storage/DB → First full backup
                           ↓
Dashboard → Space view → [Backups | Schema | Data | Automations | Interfaces | AI | Analytics | Governance | Integrations | Settings]
                           ↓
Upgrade prompt when trial limits hit
```

**Key principle:** Users should be able to visualize their Airtable schema *before* completing full registration — give value immediately, use it as the conversion hook.

### 6.2 Dashboard ✅

The dashboard is the entry point for every session:

- **Space selector** in sidebar or top menu — defaults to last viewed Space per user (persisted per-user)
- Most users will have one Space; multi-Space users can switch seamlessly
- **Current backup status** — live progress if running, last run time and result if idle
- **Backup history** — quick access to recent run logs
- **Storage summary** — where data is stored (storage destination + database tier), current usage
- **Notifications / action items** — failures, schema changes, health alerts surfaced prominently
- **Entry points** to: Schema visualizer, Health scoring, Database access, Settings

### 6.3 Navigation Model ✅

```
[Space Selector — sidebar or top nav]
Dashboard
  ├── Backups (history, status, run now, restore, auditing)
  ├── Schema (visualization, history, change log, health score)
  ├── Data (record metrics, alerts, insights)
  ├── Automations (backup, changelog, insights)
  ├── Interfaces (backup, changelog, insights)
  ├── AI (documentation, MCP, RAG — higher tiers)
  ├── Analytics (usage metrics, reports, dashboards)
  ├── Governance (rules, compliance — Business+)
  ├── Integrations (API access, SQL, connectors)
  └── Settings (schedule, storage, connections, notifications, team)
```

### 6.4 Organization & Space Hierarchy ✅

- **Organizations** sit at the top level (maps to a company or client — the billing entity)
- **Spaces** belong to an Organization; each Space is bound to a single Platform (Airtable in V1) and has its own backup configuration, database, and storage settings
- **Space Type** defines whether a Space is Single-Platform (V1) or Multi-Platform (V2+)
- **Bases** live within a Space; a Space maps to one or more Airtable Bases
- **Users** can be associated with multiple Organizations (e.g., a consultant managing multiple client orgs)
- Last viewed Space is remembered per user on login
- "Workspace" is intentionally not used — it collides with Airtable's own terminology

> ✅ **Resolved:** "Space" confirmed as the top-level container name. No "Workspace" layer. See Baseout Features spec §1–§2 for full naming conventions and hierarchy diagrams.

### 6.5 Mobile ✅

- Full mobile support required — responsive web app
- V1 is web-only (no native iOS/Android app)
- Backup status, notifications, and dashboard views must be fully functional on mobile

### 6.6 Onboarding ✅

- Schema visualization accessible via OAuth **before full registration** — no payment required
- Full registration triggered by CTA after schema visualization ("Start backing up your data")
- Post-registration: guided wizard to connect Airtable, configure storage/DB destination, run first backup
- Free trial: one backup run with enough data to explore features (visualize, schema history, health score)
- No free tier — trial converts to paid plan

### 6.7 Airtable Extension Embedding ✅

Baseout must support being embedded as an **Airtable interface/extension**:
- Web app detects when it is running in an embedded context
- Implements a **window messaging framework** to communicate with a thin wrapper running in the Airtable extension
- The wrapper embeds the Baseout URL and passes context (current base, table, view) to Baseout
- Baseout responds to context and surfaces relevant information for the current location
- Embedded mode behaves differently from standalone mode (compact layout, context-aware)

---

## 7. Integrations & Extensibility

### 7.1 Airtable Integration Depth ✅

| API | Usage |
|---|---|
| **REST API (Metadata + Records)** | ✅ Primary — schema discovery, record export |
| **Webhooks** | ✅ V1 — instant schema and record change notifications |
| **Enterprise API features** | ✅ V1 — detect Enterprise users and extract additional data available only to Enterprise accounts |
| **Scripts API / Extensions API** | 🚫 Not used — Baseout relies exclusively on the external REST API |

### 7.2 Storage Destination Connectors ✅

| Destination | V1 Status |
|---|---|
| Google Drive | ✅ V1 (existing) |
| Dropbox | ✅ V1 (existing; proxy stream required) |
| Box | ✅ V1 (existing; proxy stream required) |
| OneDrive | ✅ V1 (existing) |
| Amazon S3 | ✅ V1 (dev-complete; launching in V1) |
| Cloudflare R2 | ✅ V1 (new — internal managed storage) |
| Frame.io (Adobe) | ✅ V1 — Growth+ |

### 7.3 Baseout Inbound API ✅

A **documented public API** for data submission — V1. Allows admins and agents to POST data to Baseout that cannot be retrieved via Airtable's REST API (automations, interfaces, etc.).

- Secure, token-authorized access
- Baseout stores and versions all submitted data
- Enables AI agents and browser-based automation to feed data into Baseout's schema history

### 7.4 SQL REST API ✅

- Available on plans with a hosted database
- Powered by PG REST — allows direct database queries without a SQL client
- Not available on static-only plans

### 7.5 Notification Channels ✅

| Channel | V1 Status |
|---|---|
| Email | ✅ All plans |
| In-app (dashboard) | ✅ All plans |
| Slack | ✅ Higher-tier plans |
| Other (Teams, PagerDuty) | ❓ TBD |

### 7.6 WebSockets ✅

Implemented via Cloudflare Durable Objects — V1. Used for live backup progress and real-time status on dashboard.

### 7.7 MCP Integration 🚫 V2

Connecting the Baseout database to AI clients via MCP (Model Context Protocol) is a V2 feature. The inbound API (§7.3) lays the groundwork.

### 7.8 CLI Tool 🚫 Deferred

No CLI tool for V1. Potentially added in future based on demand.

### 7.9 Plugin Architecture 🚫 Out of Scope

No third-party plugin system. May reconsider in future.

### 7.10 Outbound Webhook / Event System 🚫 V2

External subscriptions to "backup completed" or "schema changed" events deferred to V2.

### 7.11 Data Intake Methods ✅

Baseout collects data from Airtable through multiple intake channels. This is required because Airtable's REST API does not expose all data types (notably Automations, Interfaces, and Synced Tables).

| Intake Method | Description | Min Tier |
|---|---|---|
| **Airtable REST API** | Primary data collection — schema discovery, record export, metadata retrieval | Starter |
| **Airtable Webhooks** | Real-time change notifications for records and schema. Enables instant backup. | Pro |
| **Baseout Inbound API** | Public API for submitting data not available via Airtable REST API (Automations, Interfaces, Synced Tables, custom metadata) | Growth |
| **Manual Forms** | Web-based forms within Baseout for entering documentation, annotations, and metadata | Launch |
| **Airtable Scripts** | Baseout-provided scripts that run inside Airtable's Scripting Extension to extract data not available via REST API | Growth |
| **Airtable Automations** | Baseout-provided automation templates that send data to the Baseout Inbound API on a schedule | Growth |
| **Custom Interface Extensions** | Baseout-provided Airtable extensions that extract and submit data from within the Airtable interface | Pro |
| **Airtable Enterprise API** | Additional extraction available only to Airtable Enterprise accounts (org-level metadata, user management) | Enterprise |

---

## 8. Business, Operations & Launch

### 8.1 Pricing Tier Structure ✅

All tiers include **Static backup** (CSV/JSON to storage destination). Dynamic database backup is an upgrade layer available from Launch onward. Tiers use progressive marketing names — static/dynamic terminology is an implementation detail, not the tier name.

| Tier | Price | Backup Mode | Database | Key Capabilities |
|---|---|---|---|---|
| **Starter** | $15/mo | Static | None (BYOS) | Backup + restore; managed R2 or BYOS; monthly backup |
| **Launch** | $29/mo | Static + Dynamic (Schema DB) | D1 (schema only) | + Schema visualization, changelog, health score; weekly backup |
| **Growth** | $49/mo | Static + Dynamic (Full DB) | D1 (full) | + Automations & Interface backup; Data capability; weekly backup |
| **Pro** | $99/mo | Static + Dynamic | Shared PostgreSQL | + Instant backup; SQL REST API; Slack alerts; daily backup |
| **Business** | $249/mo | Static + Dynamic | Dedicated PostgreSQL | + Dedicated DB; Governance; AI; Analytics; daily backup |
| **Enterprise** | Custom | Static + Dynamic | BYODB | + BYODB; SOC 2; SSO; SLA; dedicated CSM |

Annual pricing offers approximately 20% discount (billed annually). See Baseout Features spec §3 for full limit tables and §5.5 for Stripe billing architecture.

> ✅ **Resolved:** Tier names finalized as Starter / Launch / Growth / Pro / Business / Enterprise. Static/dynamic is a capability within tiers, not a tier category.

### 8.2 On2Air Customer Migration ✅

**Backend migration (pre-launch, run once):**
- One-time scripted process maps existing On2Air customers to appropriate new tiers (Starter/Launch/Growth) based on current usage (record count, bases)
- Must complete before public launch — individual user UI steps can happen after launch
- Legacy users receive a `dynamic_locked: true` flag on their Organization — dynamic features shown as upgrade CTAs, not hidden

**User-facing migration flow (post-launch):**
- When a migrated user logs into Baseout for the first time, they are shown a **"Complete Your Migration"** screen
- `has_migrated` flag stored on the Organization record; screen shown until flag is set to true
- The screen guides them through re-authenticating their Airtable OAuth connection and storage destinations under the Baseout brand
- Until migration is complete, backup cannot run (connection is not yet established under Baseout)
- **Migration incentive:** Grandfathered pricing at their equivalent tier for a defined transition period

### 8.3 Support Model ✅

| Tier | Support |
|---|---|
| All plans | Knowledge base (self-serve docs) + AI-driven support chatbot |
| Higher plans | Email support |
| Business / Enterprise | Slack support + dedicated CSM |

> **Note:** AI-driven support chatbot will be a home-built solution integrated as a plug-and-play module when ready. Not in initial V1 build scope — KB only at launch.

### 8.4 Launch Strategy ✅

1. **Private beta** — internal testing
2. **Backend database migration** — one-time scripted migration of On2Air customers must complete before step 3
3. **Public launch** — open to new customers; On2Air users complete their UI migration steps post-launch at their own pace
4. **Airtable Marketplace listing** — get Baseout listed to capture organic discovery

> 🚫 **Deferred:** Product Hunt launch timing and all go-to-market planning is handled in a separate Marketing & Rollout PRD.

### 8.5 SOC 2 & GDPR Compliance ✅

- **SOC 2 vendor research begins:** April 2026. Vendor selection and requirements review first — audit clock does not start until vendor is engaged and scope is set
- **Target SOC 2 certification:** ~6 months after audit period begins (date TBD pending vendor selection)
- **During certification period:** Disclose "SOC 2 in progress" on dynamic tiers
- **GDPR:** Compliance from day one — data processing agreements (DPAs) in place before dynamic plans launch
- SOC 2 is required before Business/Enterprise tier can be broadly marketed; static plans and lower dynamic tiers can launch while it is in progress

### 8.6 Billing Architecture & Stripe Integration ✅

*Full specification in Baseout Features spec §5.5. Summary:*

- **Stripe subscription created at sign-up** — $0 free trial subscription, no credit card required. On upgrade, credit card collected and subscription price swapped to paid plan on the existing subscription object
- **One Stripe subscription per Organization** — created at sign-up, modified as platforms/tiers change; never replaced
- **One subscription item per Platform** — each active platform occupies one item within the Organization's subscription
- **Stripe product naming:** `Baseout — [Platform] — [Tier]` (e.g., `Baseout — Airtable — Pro`)
- **Capability resolution** — always read from Stripe product metadata (`platform` + `tier`), never from product name strings
- **Per-platform trials** — 7 days + 1 backup run limit; one trial per platform per Organization, ever
- **Multi-platform discount** — rate TBD when second platform launches
- **Legacy migration** — `dynamic_locked: true` flag on the Organization; dynamic features shown as CTAs, not hidden

---

## 9. MoSCoW Prioritization

| Priority | Feature |
|---|---|
| **Must Have** | OAuth reauthentication flow + On2Air customer migration (`dynamic_locked` flag) |
| **Must Have** | Scheduled backups — Monthly (all tiers), Weekly (Launch+), Daily (Pro+), Instant (Pro+) |
| **Must Have** | Full restore pipeline — base-level + table-level, point-in-time, restores to new base/table only |
| **Must Have** | Post-restore verification (record count + audit log) — Growth+ |
| **Must Have** | Backup auditing — audit report, per-entity verification, issue notifications, monthly summary (all tiers); detailed audit logs (Launch+) |
| **Must Have** | Webhook-based incremental backup + change log |
| **Must Have** | All existing storage destinations + S3 (Growth+) + Cloudflare R2 (all) + Frame.io (Growth+) |
| **Must Have** | better-auth for all auth flows |
| **Must Have** | Schema history tracking (field + table level, V1) — Launch+ |
| **Must Have** | Schema visualization (auto-generated, read-only) — Launch+ |
| **Must Have** | Base health scoring + configurable audit rules — Launch+ |
| **Must Have** | Backup history dashboard with per-run metrics |
| **Must Have** | Monthly audit email + per-failure alerts (email) |
| **Must Have** | Retention / smart cleanup (user-configurable) |
| **Must Have** | Database provisioning per tier (D1 schema → D1 full → Shared PG → Dedicated PG → BYODB) |
| **Must Have** | Database tier migration tooling |
| **Must Have** | Internal admin panel for database tracking |
| **Must Have** | Baseout Inbound API (documented, authorized) — Growth+ |
| **Must Have** | Data intake: Manual form UI within Baseout for Automations/Interfaces — Growth+ |
| **Should Have** | Data intake: Inbound REST API endpoint for programmatic submission (Airtable Scripts, agents) — quick follow after launch |
| **Must Have** | Airtable extension embedding (window messaging framework) |
| **Must Have** | Pre-registration schema visualization (conversion hook) |
| **Must Have** | Mobile-responsive web app |
| **Must Have** | WebSockets for real-time backup progress |
| **Must Have** | Stripe billing integration — per-platform subscription items, metadata-driven capability resolution |
| **Should Have** | SQL REST API (PG REST) for database-tier plans — Pro+ |
| **Should Have** | Slack notification integration — Pro+ |
| **Should Have** | Basic analytics (record count trends, storage growth) |
| **Should Have** | Human-readable schema change log |
| **Should Have** | Storage management UI (user-facing cleanup config) |
| **Should Have** | Community Restore Tooling (AI prompt guides for Automations/Interfaces restore) — Pro+ |
| **Could Have** | Diagram export formats (PNG on Growth, SVG on Pro, PDF on Business, embed widget on Enterprise) |
| **Could Have** | Record-level restore (if user demand warrants) |
| **Could Have** | Airtable Enterprise API feature detection and extraction |
| **Won't Have (yet)** | AI MCP Server and RAG/Chatbot/Vector DB |
| **Won't Have (yet)** | Governance Capability (entire capability is V2) |
| **Won't Have (yet)** | Third-party connectors (Zapier, Make.com) |
| **Won't Have (yet)** | Richer AI-driven analytics, custom dashboards |
| **Won't Have (yet)** | Cross-Space migration and cloning tools |
| **Won't Have (yet)** | Multi-platform Spaces (V2+) |
| **Won't Have (yet)** | Multi-platform integrations (Notion, Coda, HubSpot, Salesforce) |
| **Won't Have (yet)** | Outbound webhook / event system |
| **Won't Have (yet)** | CLI tool |
| **Won't Have (yet)** | Plugin / extension architecture |
| **Won't Have (yet)** | White-label |

---

## 10. Feature Capability Scope — V1

| Capability | V1 Status | Notes |
|---|---|---|
| **Backup** — Scheduled (monthly/weekly/daily/instant) | ✅ In V1 | Full rebuild on Durable Objects + Trigger.dev |
| **Backup** — Auditing (audit report, verification, notifications) | ✅ In V1 | All tiers; detailed logs on Launch+ |
| **Backup** — Cloud Storage Destinations | ✅ In V1 | All existing + S3 (Growth+) + R2 (all) + Frame.io (Growth+) |
| **Backup** — Restore Pipeline (base + table level, point-in-time) | ✅ In V1 | Always restores to new data; community restore tooling Pro+ |
| **Backup** — Backup History & Dashboard | ✅ In V1 | Expanded metrics with real-time WebSocket updates |
| **Schema** — History & Change Log | ✅ In V1 | Field + table level; webhook-powered; Launch+ |
| **Schema** — Visualization | ✅ In V1 | Auto-generated, read-only; diagram export varies by tier |
| **Schema** — Health Scoring | ✅ In V1 | Audit grade; configurable rules on Pro+ |
| **Schema** — Management Actions (rename, describe) | ❌ V2 | Write-back to Airtable |
| **Data** — Record Metrics, Changelog, Growth Trends | ✅ In V1 | Growth+; requires dynamic backup |
| **Data** — Alerts, Insights, PII Detection, Reports | ❌ V2 | Complex; lower priority |
| **Automations** — Backup + Changelog | ✅ In V1 | Growth+; via Inbound API / intake methods |
| **Automations** — Visualization, Alerts | ❌ V2 | Complex |
| **Interfaces** — Backup + Changelog | ✅ In V1 | Growth+; via Inbound API / intake methods |
| **Interfaces** — Visualization, Alerts | ❌ V2 | Complex |
| **AI** — AI-Assisted Documentation | ✅ In V1 | Pro+; analyzes schema → generates summary, field/table descriptions. Powered by Cloudflare AI (open source model) |
| **AI** — MCP Server, RAG, Chatbot, Vector DB | ❌ V2 | Significant infrastructure; per PRD |
| **Analytics** — Basic (usage, record trends, storage growth) | ✅ In V1 | Placeholder "coming soon" UI for V1; metrics collected from day one for future rendering |
| **Analytics** — Custom Dashboards, Scheduled Reports | ❌ V2 | Complex UI |
| **Governance** — Entire capability | ❌ V2 | Business+ only; large engineering effort |
| **Integrations** — Baseout Inbound API | ✅ In V1 | Documented, authorized; agent-friendly; Growth+ |
| **Integrations** — SQL REST API | ✅ In V1 | Pro+ only; custom Cloudflare Worker (not PostgREST) — bearer token auth, parameterized queries, read-only |
| **Integrations** — Direct SQL Access | ✅ In V1 | Business+ only; connection string exposed in Space settings UI; read-only by default |
| **Integrations** — Third-Party (Zapier, Make.com) | ❌ V2 | Partnership required |
| Data Intake — Manual Forms (Automations/Interfaces) | ✅ In V1 | Growth+; form UI within Baseout to submit automation/interface data |
| Data Intake — Inbound REST API | ✅ V1 (quick follow) | Growth+; programmatic submission for scripts and agents; versioned per entity ID |
| Database Provisioning & Migration | ✅ In V1 | D1 schema → D1 full → Shared PG → Dedicated → BYODB |
| Alerts & Notifications (Email + Slack + Teams + PagerDuty) | ✅ In V1 | Email/in-app: all; Slack: Pro+; Teams/PagerDuty: Enterprise |
| Airtable Extension Embedding | ✅ In V1 | Window messaging framework |
| Pre-registration Schema Visualization | ✅ In V1 | Conversion hook before sign-up |
| Internal Admin Panel (DB management) | ✅ In V1 | Operational tooling for the Baseout team |
| Multi-Platform Spaces | ❌ V2 | Requires multiple active platform subscriptions |
| Multi-Platform Integrations (Notion, HubSpot, Salesforce) | ❌ V2 | After Airtable V1 launch |
| Outbound Webhooks / Event System | ❌ V2 | |
| CLI Tool | 🚫 Deferred | |
| Plugin Architecture | 🚫 Out of scope | |

---

## 11. Open Questions Master List

| # | Question | Status | Owner |
|---|---|---|---|
| 1 | Diagram export formats for schema visualization — PNG, SVG, PDF, interactive HTML, embeddable widget? Which are V1? | ✅ Resolved: PNG on Growth, SVG on Pro, PDF on Business, embed widget on Enterprise | Dan Fellars |
| 2 | Specific per-tier storage caps, record limits, and overage pricing rates | ✅ Resolved: Defined in Features spec §3–§5 | Dan Fellars |
| 3 | Workspace / project tier limits — how many workspaces per plan? Naming conventions for all tiers? | ✅ Resolved: "Space" confirmed; no Workspace layer; Space limits in Features spec §4.1 | Dan Fellars |
| 4 | Finalize tier names and full pricing structure across all six plan types | ✅ Resolved: Starter ($15) / Launch ($29) / Growth ($49) / Pro ($99) / Business ($249) / Enterprise (Custom) | Dan Fellars |
| 5 | OAuth dead connection notification cadence | ✅ Resolved: Send → wait 2 days → Send → wait 3 days → Send → wait 5 days → Final send (4 total). Then stop and mark connection invalidated. | Dan Fellars |
| 6 | Product Hunt launch — timing and preparation plan? | 🚫 Deferred to separate Marketing & Rollout PRD | Dan Fellars |
| 7 | Additional notification channels beyond email and Slack — Teams, PagerDuty? | ✅ Resolved: Teams on Enterprise, PagerDuty on Enterprise, Outbound Webhook on Business+ | Dan Fellars |
| 8 | Trial duration per platform | ✅ Resolved: 7-day time limit AND 1 backup run limit. Subscription ends at day 7 with upgrade prompt. | Dan Fellars |
| 9 | Multi-platform discount percentage | ✅ Resolved: TBD when second platform is added. Deferred. | Dan Fellars |
| 10 | Brand spelling | ✅ Resolved: **Baseout** (capital B, rest lowercase) in all written text. Logo/brand mark: **baseout** (all lowercase). | Dan Fellars |

---

## 12. Action Items

| # | Action Item | Owner | Due |
|---|---|---|---|
| 1 | Finalize Baseout brand spelling (BaseOut / Base Out / Baseout) | Dan Fellars | ASAP |
| 2 | Share and select final logo candidate | Dan Fellars | ASAP |
| 3 | ~~Finalize pricing tier names, storage caps, limits, overage rates~~ **DONE** — See Features spec §3–§5 | Dan Fellars | ✅ |
| 4 | Define OAuth reauthentication notification cadence and cutover timeline | Dan Fellars | +1 wk |
| 5 | Architecture decision record (ADR): confirm Durable Object-per-connection model and microservices split | Engineering | +1 wk |
| 6 | better-auth integration spike — Airtable OAuth + platform auth flows | Engineering | +1 wk |
| 7 | Database migration tooling design — D1 (SQLite) → PostgreSQL migration process | Engineering | +1 wk |
| 8 | Internal admin panel spec — database tracking, utilization monitoring, Organization mapping | Engineering | +1 wk |
| 9 | Begin AI-assisted frontend exploration — 2–3 design variations with fake data | Dan Fellars | +1 wk |
| 10 | Wireframes for core flows: pre-auth schema viz, onboarding wizard, dashboard, restore, embedding | Design | +1 wk |
| 11 | Airtable API capability audit — webhooks, Enterprise API features, rate limits, attachment URL behavior | Engineering | +1 wk |
| 12 | Set up Baseout project repo and CI/CD (GitHub + Cloudflare Pages) | Engineering | +1 wk |
| 13 | On2Air customer migration plan — notification strategy, `dynamic_locked` flag implementation, reauthentication flow | Dan Fellars | +2 wks |
| 14 | Stripe billing integration spec — per-platform subscription items, metadata schema, trial logic, multi-platform discount | Engineering | +2 wks |
| 15 | Initiate SOC 2 process — target start April / May 2026 | Dan Fellars | +2 wks |
| 16 | GDPR compliance review — DPAs drafted before dynamic plans launch | Legal / Dan Fellars | +2 wks |
| 17 | Airtable Marketplace listing — submission requirements and timeline | Dan Fellars | +2 wks |
| 18 | ~~Schema visualization diagram export formats decision~~ **DONE** — PNG: Growth, SVG: Pro, PDF: Business, Embed: Enterprise | Dan Fellars | ✅ |
| 19 | Inbound API documentation spec — endpoints, auth model, schema for submissions | Engineering | +2 wks |
| 20 | Window messaging framework spec for Airtable extension embedding | Engineering | +2 wks |
| 21 | ~~Define trial duration~~ **DONE** — 7 days + 1 backup run; caps: 1,000 records, 5 tables, 100 attachments | Dan Fellars | ✅ |
| 22 | ~~Finalize multi-platform discount~~ **DEFERRED** — to be defined when second platform launches | Dan Fellars | ✅ |
| 23 | Background service spec — webhook renewal (6-day threshold), OAuth token refresh, dead connection notifications (4-touch cadence), connection lock management | Engineering | +2 wks |
| 24 | On2Air migration script spec — tier mapping logic, `dynamic_locked` flag, `has_migrated` flag, "Complete Your Migration" UI flow | Engineering | +2 wks |
| 25 | Health score algorithm design — weighted 0–100 scale, rule weights, Green/Yellow/Red thresholds | Dan Fellars + Engineering | +2 wks |
| 26 | Schema visualization library selection — React-based node graph + ERD hybrid (e.g., React Flow, Cytoscape.js) | Engineering | +1 wk |

---

---

## 13. Authentication ✅

Baseout uses **better-auth** for all authentication flows.

### 13.1 Launch Authentication (V1)

| Method | Status | Notes |
|---|---|---|
| **Magic Link** | ✅ V1 launch | Passwordless — user enters email, receives a one-time login link. Simplest onboarding path. |
| **Email + Password** | ✅ V1 (pre-launch addition) | Added before V1 public launch. better-auth handles hashing. |
| **SSO (SAML)** | ✅ V1 (Enterprise tier only) | better-auth SSO plugin. Required before Enterprise can be sold. |
| **2FA (TOTP)** | ✅ V1 (pre-launch addition) | Added before V1 public launch. Authenticator app support via better-auth 2FA plugin. |
| **Airtable OAuth** | 🚫 Not used for login | Airtable OAuth is exclusively for connecting a Space to Airtable data — never for Baseout account authentication. |
| **Google OAuth** | ❓ Evaluate pre-launch | Nice to have; better-auth supports it natively. Decision before public launch. |

### 13.2 Session Management

- Sessions managed by better-auth — JWT or database-backed sessions (to be confirmed during better-auth integration spike)
- Pre-registration schema visualization uses a **temporary session** with a client-side session ID. Discarded on tab close. On registration, the session is claimed and linked to the new Organization.
- All auth flows go through the main web app repo

---

## 14. Testing Strategy ✅

All repos follow the same testing philosophy: **test as you build**, not after. Every PR requires passing tests before merge. Testing covers both frontend UI and all backend logic — Workers, jobs, services, and API handlers are all unit and integration tested.

### 14.1 Testing Tools

| Layer | Tool | Purpose |
|---|---|---|
| **Unit + integration (all repos)** | [Vitest](https://vitest.dev) | Single test runner used across all repos — frontend components, backend Workers, API handlers, Trigger.dev jobs, and background services. Vite-native; fast watch mode. |
| **Cloudflare Workers runtime** | [Miniflare](https://miniflare.dev) via `@cloudflare/vitest-pool-workers` | Simulates the full Cloudflare runtime locally inside Vitest. Required for testing Durable Objects, KV, R2, D1, and cron triggers without deploying. All Worker tests run through this pool. |
| **Database (Drizzle + PostgreSQL)** | Local PostgreSQL via Docker + Drizzle test client | Integration tests run against a real local PG instance (not mocked). D1 tests use Miniflare's in-process D1. DB state is reset between test runs via Drizzle migrations on a test schema. |
| **API handler testing** | Vitest + `Request`/`Response` mocks | Each Cloudflare Worker API handler is tested in isolation: given a `Request` object, assert on the `Response`. No HTTP server needed — Workers are just functions. |
| **Trigger.dev job testing** | Vitest + Trigger.dev test utilities | Jobs are unit tested with mocked Airtable API responses and mocked storage clients. Integration tests run against the Trigger.dev dev server locally. |
| **UI component testing** | Vitest + [@testing-library/dom](https://testing-library.com) | Astro/UI components tested in isolation. Tests assert on rendered HTML and user interactions. |
| **E2E testing** | [Playwright](https://playwright.dev) | Full browser automation against the staging environment. Tests critical end-to-end user flows. Lives in `baseout-web`. |

### 14.2 What Gets Unit Tested (Backend)

Backend unit testing covers the logic layer — not the Cloudflare runtime plumbing. Each of the following is tested independently with mocked dependencies:

| Backend Area | What Is Tested |
|---|---|
| **Backup engine — backup logic** | File path construction, CSV generation, attachment dedup ID generation, trial cap enforcement, per-entity status tracking |
| **Backup engine — restore logic** | Snapshot selection, table write ordering (tables → records → linked records → attachments), error handling |
| **Backup engine — Airtable API client** | Rate limit handling, retry logic, pagination, error responses, Enterprise vs standard scope differences |
| **Backup engine — storage clients** | R2 write, Google Drive write, Dropbox proxy stream, Box proxy stream, OneDrive write, S3 write — each tested with mocked provider responses |
| **Backup engine — Durable Object state** | Backup state transitions (`idle → running → success/failed`), lock acquisition and release, cron scheduling logic |
| **Background services — webhook renewal** | Threshold detection (6-day), renewal API call, state update — tested with mocked Airtable webhook API |
| **Background services — OAuth refresh** | Expiry detection, refresh token exchange, encrypted token update — tested with mocked provider OAuth endpoints |
| **Background services — dead connection notifier** | Notification cadence logic (send → 2d → send → 3d → send → 5d → final), sent count tracking, invalidation trigger |
| **Background services — connection lock** | Lock acquisition, lock timeout (5s retry), concurrent access prevention |
| **Web API — all route handlers** | Given a `Request`, assert correct `Response` status + body. Auth middleware tested separately. |
| **Web API — Stripe webhook handler** | Each Stripe event type (`invoice.paid`, `customer.subscription.updated`, etc.) tested with fixture payloads |
| **Web API — capability resolver** | Given Stripe metadata (`platform` + `tier`), assert correct capability set returned |
| **Web API — trial enforcement** | Trial cap logic, trial expiry detection, upgrade gate |
| **Drizzle queries** | Critical queries tested against local PG — not mocked. Ensures schema + query correctness together. |

### 14.3 What Gets Integration Tested

Integration tests run multiple real components together. Database is real (local Docker PG or Miniflare D1); external APIs are mocked at the HTTP boundary using [msw](https://mswjs.io) (Mock Service Worker for Node).

| Integration Test | Components Involved |
|---|---|
| Full backup run (static) | Backup engine + Airtable mock API + R2 mock + master DB |
| Full backup run (dynamic) | Backup engine + Airtable mock API + D1 (Miniflare) + master DB |
| Restore to new base | Restore engine + Airtable write mock + snapshot from DB |
| Webhook renewal cycle | Background service + Airtable webhook mock + DB state |
| OAuth refresh cycle | Background service + provider OAuth mock + encrypted token DB update |
| Stripe upgrade flow | Web API + Stripe mock + DB subscription update + capability resolution |
| On2Air migration script | Migration script + source data fixtures + master DB |

### 14.4 Test Coverage Requirements

| Repo | Unit Coverage Target | Integration | E2E |
|---|---|---|---|
| `baseout-backup-engine` | 80% | Required for all backup/restore paths | Via Playwright staging |
| `baseout-background-services` | 80% | Required for all service loops | Via Playwright staging |
| `baseout-web` (API handlers) | 75% | Required for Stripe webhook, auth, capability resolution | Via Playwright |
| `baseout-web` (UI components) | 60% | — | Via Playwright |
| `baseout-admin` | 60% | — | Manual |

### 14.5 E2E Test Scenarios (Playwright — minimum V1)

All run against the staging environment:

- Full signup → magic link → onboarding wizard → first backup run (trial capped)
- Trial cap hit → upgrade prompt → credit card entry → plan upgrade → full backup runs
- Backup run → restore to new base (workspace ID input flow)
- On2Air migration → "Complete Your Migration" screen → re-auth Airtable → backup resumes
- Dead connection → notification email sent → user re-authenticates → connection restored
- Schema visualization loads + node graph renders for a multi-base Space

### 14.6 Test Environments

| Environment | Used For | DB |
|---|---|---|
| Local (developer machine) | Unit + integration tests | Docker PG + Miniflare D1 |
| CI (GitHub Actions) | All unit + integration on every PR | Docker PG + Miniflare D1 spun up in CI |
| Staging (separate Cloudflare account) | E2E Playwright tests; full system validation | Staging DB (real PG instance) |
| Production | No test runs | Production DB |

---

## 15. In-App Help & Documentation ✅

### 15.1 Tooltips & Guided Tours (V1)

| Feature | Tool | Notes |
|---|---|---|
| **Tooltips** | [Floating UI](https://floating-ui.com) | Lightweight, accessible positioning library. Used for contextual tooltip overlays on individual UI elements. |
| **Guided Tours** | [Shepherd.js](https://shepherdjs.dev) | Step-by-step tour overlays triggered on first use of a feature or from a "Take a tour" button. Tours defined per page/capability. |

**V1 guided tours to implement:**
- Onboarding wizard (first-time setup)
- First backup run
- Schema visualization
- Restore flow
- Space settings

### 15.2 In-App Support Chatbot (Deferred)

- Placeholder chat button visible in V1 UI (bottom-right corner)
- V1: placeholder only — clicking opens a "Coming soon / contact us via email" fallback
- Full chatbot implementation deferred — will connect to the documentation site via a separate project
- Chatbot will be home-built; plug-and-play integration when ready

### 15.3 Documentation Site

- Separate project (not in this repo)
- Connected to the in-app chatbot when built
- URL: `docs.baseout.com` (planned)

---

## 16. Admin & Observability System ✅

### 16.1 Super-Admin Application

A **separate Astro application** with its own repo. Accessible only to super-admin logins — not reachable by regular Baseout users. Deployed to a separate Cloudflare Pages project.

**Capabilities:**
- View all Organizations, Spaces, subscriptions, and backup run status
- Database provisioning tracker — all D1/PG instances, utilization, health
- Connection health dashboard — OAuth connections, webhook status, renewal state
- Background service monitor — last run time, success/failure for each background process
- On2Air migration status — how many users have completed migration vs pending
- Trigger manual admin actions: force backup, invalidate connection, reset trial, adjust plan
- View and search error logs and audit trail

**Shared UI library:** Uses the same component library being built for the main Baseout app. Both apps consume from a shared internal package.

### 16.2 Observability Stack

| Layer | Tool | Notes |
|---|---|---|
| **Workers + Durable Objects** | Cloudflare built-in observability | Workers Analytics, DO metrics, tail workers for log streaming |
| **Error tracking** | Cloudflare Logpush + tail Workers | Errors streamed to a log destination (R2 or external). Evaluated for Sentry if Cloudflare built-in proves insufficient post-launch |
| **Backup engine jobs** | Trigger.dev dashboard | Job run history, retry status, error details per Trigger.dev run |
| **Database metrics** | DigitalOcean / Neon / Supabase built-in | Per-instance metrics for Shared PG and Dedicated PG |
| **Uptime monitoring** | Cloudflare Health Checks | Per-endpoint uptime alerting |

### 16.3 Error Notification

- Critical errors (backup engine failure, DB provisioning failure, background service failure) → email alert to engineering on-call
- Super-admin dashboard surfaces all errors in real time
- Error rate thresholds trigger alerts before users notice

---

## 17. Third-Party Services & Integrations ✅

| Category | Service | Notes |
|---|---|---|
| **Transactional email** | [Mailgun](https://mailgun.com) | All system emails: magic links, audit reports, error notifications, trial expiry, upgrade prompts. React Email templates compiled and sent via Mailgun API. |
| **Email list / marketing** | Mailgun | Same account — separate sending domain for marketing vs transactional |
| **Error monitoring** | Cloudflare built-in | Tail Workers + Logpush. Re-evaluate post-launch. |
| **Web analytics / product analytics** | [PostHog](https://posthog.com) | Replaces GA4. Covers: web analytics, product analytics (funnels, retention, user paths), session replay, and feature flags. Single SDK installed in `baseout-web`. Self-hosted on PostHog Cloud (EU region for GDPR). |
| **Referral tracking** | [dub.co](https://dub.co) | Replacing Rewardful. Migration path: export Rewardful affiliate data → import to dub.co. Need to support existing Rewardful affiliate links during transition period (redirect or alias). |
| **Customer support (V1)** | Email-based ticketing | Simple email-to-ticket for V1. Custom chatbot added when ready (see §15.2). |
| **Payments** | Stripe | See §8.6 |
| **Background jobs** | Trigger.dev V3 (cloud) | See §4 |

---

## 18. Git Branching, Environments & CI/CD ✅

### 18.1 Branch Strategy

| Branch | Environment | Cloudflare Account | Database |
|---|---|---|---|
| `main` | Production | Production Cloudflare account | Production DB |
| `staging` | Staging | Separate staging Cloudflare account | Staging DB (separate instance) |
| `feature/*` | Preview | Production Cloudflare account (preview URLs) | Staging DB (shared across previews) |

- **`main`** — protected branch. Merges only via PR. Triggers automatic production deploy via Cloudflare Pages.
- **`staging`** — integration branch. All feature branches merge here before `main`. Triggers auto-deploy to staging environment.
- **`feature/*`** — per-ticket branches. Cloudflare Pages generates a unique preview URL per branch automatically.
- **Hotfixes** — `hotfix/*` branches cut from `main`, merged back to both `main` and `staging`.

### 18.2 Environment Separation

- Staging and production use **separate Cloudflare accounts** — no risk of API key crossover
- Each environment has its own: Cloudflare Workers, D1 instances, R2 buckets, KV namespaces, Durable Objects, Secrets
- Switching between accounts is handled at the CI/CD level via environment-specific GitHub secrets

### 18.3 CI/CD Pipeline (GitHub Actions)

| Trigger | Action |
|---|---|
| PR opened against `staging` or `main` | Run Vitest + Playwright; block merge if failing |
| Merge to `staging` | Deploy all repos to staging Cloudflare account |
| Merge to `main` | Deploy all repos to production Cloudflare account |
| New feature branch pushed | Cloudflare Pages generates preview URL automatically |

### 18.4 Repo List

| Repo | Description | Primary Deploy Target |
|---|---|---|
| `baseout-web` | Astro SSR app — frontend + web API layer | Cloudflare Pages + Workers |
| `baseout-backup-engine` | Backup/restore engine — Durable Objects + Trigger.dev | Cloudflare Workers |
| `baseout-background-services` | Webhook renewal, OAuth refresh, connection locks, notification dispatch | Cloudflare Workers (cron) |
| `baseout-admin` | Super-admin Astro app | Cloudflare Pages + Workers (separate project) |
| `baseout-ui` | Shared component library consumed by `baseout-web` and `baseout-admin` | npm package (internal) |

---

## 19. Email Templates ✅

All email templates built with **[React Email](https://react.email)** and sent via **Mailgun**.

### 19.1 Template Inventory (V1)

| Template | Trigger | Notes |
|---|---|---|
| **Magic Link** | User requests login | Contains one-time link with expiry (15 min) |
| **Trial Welcome** | User completes sign-up | Introduces Baseout, links to onboarding |
| **Trial Expiry Warning** | Day 5 of 7-day trial | Prompts upgrade before trial ends |
| **Trial Expired** | Day 7 — backup run blocked | Upgrade CTA |
| **Backup Audit Report** | Per audit run (configurable frequency) | Space-level summary; see §2.10 |
| **Monthly Backup Summary** | Monthly, all tiers | Space-level health and storage digest |
| **Backup Failure Alert** | Backup run fails | Immediate; links to run log |
| **Backup Warning Alert** | Backup run completes with warnings | Immediate |
| **Dead Connection Warning (×4)** | Connection auth fails | Cadence: send → 2d → send → 3d → send → 5d → final. See §7.11 |
| **Quota Warning** | 75%, 90%, 100% of any tier limit hit | Overage alert |
| **Upgrade Confirmation** | User upgrades plan | Receipt + what's now unlocked |
| **Migration Welcome** | Legacy On2Air user first login | Directs to "Complete Your Migration" flow |
| **Password Reset** | User requests password reset (once email+password auth is added) | |

### 19.2 Sending Infrastructure

- **Transactional domain:** `mail.baseout.com` (or similar) — separate from marketing domain for deliverability
- **Mailgun region:** US or EU depending on GDPR requirements
- All emails sent from the web API layer via Mailgun SDK; no direct Mailgun calls from Workers outside the web API

---

## 20. Security, Secrets & Encryption ✅

### 20.1 Secrets Management

- **All secrets stored in Cloudflare Secrets** — never hardcoded, never in environment variable files committed to git
- Each repo maintains its own Cloudflare Secrets namespace
- Secrets rotated via Cloudflare dashboard; rotation does not require redeployment for KV-stored secrets

| Secret | Where Stored | Notes |
|---|---|---|
| Stripe API keys | Cloudflare Secrets | Separate keys per environment |
| Mailgun API key | Cloudflare Secrets | |
| Master encryption key | Cloudflare Secrets | Used for encrypting OAuth tokens + API keys at rest in master DB |
| Airtable OAuth client secret | Cloudflare Secrets | |
| Storage provider OAuth secrets | Cloudflare Secrets | Google, Dropbox, Box, OneDrive |
| Database connection strings | Cloudflare Secrets | Per-environment; never in code |
| Trigger.dev API key | Cloudflare Secrets | |
| better-auth secret | Cloudflare Secrets | Session signing key |

### 20.2 Encryption Strategy

| Data | Method | Notes |
|---|---|---|
| OAuth tokens (Airtable, storage destinations) | AES-256-GCM | Encrypted before writing to master DB; decrypted at runtime via Cloudflare Secrets key |
| API keys (Inbound API, SQL REST) | AES-256-GCM | Same approach as OAuth tokens |
| Backup files (R2 managed) | Cloudflare R2 server-side encryption | At-rest encryption, platform-managed |
| Customer databases (D1, Shared PG, Dedicated PG) | Provider-managed at-rest encryption | DigitalOcean, Neon, Supabase all encrypt at rest |
| Passwords (once email+password auth is added) | bcrypt (via better-auth) | better-auth handles this natively |

### 20.3 On2Air Encryption Compatibility

- On2Air uses **bcrypt** for password hashing (exact library version TBD — inspect On2Air codebase before migration)
- For **backup data encryption**: On2Air encryption keys are available and will be used to decrypt any legacy backup metadata during migration
- Baseout does **not** need to match On2Air's encryption scheme going forward — new data uses AES-256-GCM
- Migration script must: (1) decrypt On2Air data using legacy keys, (2) re-encrypt under new AES-256-GCM scheme, (3) store new key reference

---

## 21. Database Schema, ORM & Conventions ✅

### 21.1 ORM: Drizzle

- **[Drizzle ORM](https://orm.drizzle.team)** for all database interactions
- Schema defined in TypeScript — single source of truth
- Migrations generated via `drizzle-kit generate` and applied via `drizzle-kit migrate`
- Migration files committed to the repo alongside schema changes — never auto-applied in production without review
- Separate Drizzle configs per environment (master DB, client DBs)

### 21.2 Naming Conventions

| Convention | Rule | Example |
|---|---|---|
| **Table names** | Plural, snake_case | `organizations`, `spaces`, `backup_runs` |
| **Column names** | Singular, lowercase, snake_case | `organization_id`, `created_at`, `is_active` |
| **Primary keys** | `id`, UUID format | `id uuid primary key default gen_random_uuid()` |
| **Foreign keys** | `{referenced_table_singular}_id` | `organization_id`, `space_id`, `backup_run_id` |
| **Timestamps** | `created_at`, `modified_at` — auto-managed | Set on insert; `modified_at` updated on every row change via trigger or ORM hook |
| **Boolean fields** | `is_` or `has_` prefix | `is_active`, `has_migrated`, `is_trial` |
| **Enum-like status fields** | snake_case string values | `status: 'pending' | 'running' | 'success' | 'failed'` |

### 21.3 Core Master DB Tables (indicative — full schema in separate schema spec)

| Table | Key Fields | Notes |
|---|---|---|
| `organizations` | `id`, `name`, `has_migrated`, `dynamic_locked`, `stripe_customer_id`, `created_at`, `modified_at` | Top-level billing entity |
| `users` | `id`, `organization_id`, `email`, `role`, `created_at`, `modified_at` | `role`: `owner`, `admin`, `member` |
| `spaces` | `id`, `organization_id`, `name`, `platform`, `space_type`, `status`, `created_at`, `modified_at` | One per Airtable connection group |
| `connections` | `id`, `organization_id`, `platform`, `access_token_enc`, `refresh_token_enc`, `token_expires_at`, `status`, `created_at`, `modified_at` | Encrypted tokens |
| `backup_runs` | `id`, `space_id`, `status`, `started_at`, `completed_at`, `is_trial`, `record_count`, `table_count`, `attachment_count` | Master record; metrics in client DB |
| `subscriptions` | `id`, `organization_id`, `stripe_subscription_id`, `platform`, `tier`, `status`, `trial_ends_at`, `created_at`, `modified_at` | One row per platform per org |
| `api_tokens` | `id`, `space_id`, `user_id`, `token_hash`, `last_used_at`, `created_at` | Inbound API tokens; store hash not plaintext |
| `notification_log` | `id`, `organization_id`, `connection_id`, `notification_type`, `sent_count`, `last_sent_at` | Tracks dead-connection notification cadence |

### 21.4 Migration Workflow

```
1. Edit schema in Drizzle schema file
2. Run: drizzle-kit generate  →  creates migration SQL file
3. Review migration file in PR
4. On merge to staging: drizzle-kit migrate (staging DB)
5. On merge to main: drizzle-kit migrate (production DB) — manual approval step
```

- Breaking migrations (column drops, renames) require a two-phase approach: add new → backfill → remove old
- All migrations are versioned and never deleted from the repo

*Version 1.4 — Updated March 31, 2026. Added §13 Authentication, §14 Testing Strategy, §15 In-App Help, §16 Admin & Observability, §17 Third-Party Services, §18 Git Branching & CI/CD, §19 Email Templates, §20 Security & Encryption, §21 Database Schema & Conventions. PRD is now feature-complete for V1 build. See separate Implementation Plan document for phased build order and repo sequencing.*
