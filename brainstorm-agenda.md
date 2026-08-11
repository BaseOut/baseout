# Base Out — Brainstorming Session Agenda

> **Product:** Base Out — An Airtable backup, restore, and data intelligence platform.
> **Goal:** Whiteboard the full architecture, technology stack, and feature set so we can produce a comprehensive PRD afterward.
> **Duration:** 90–120 minutes
> **Output:** Enough documented decisions and open questions to draft a working Product Requirements Document within 48 hours.

---

## Pre-Session: Context Setting (5 min)

Ground the team on what already exists and what Base Out is evolving from.

- **Existing system:** The On2Air Backups server already handles scheduled Airtable backups including base discovery, table/record export, attachment handling, and storage to Google Drive, Dropbox, Box, and OneDrive. It has a full restore pipeline (tables → records → linked records → attachments) and backup history/audit tracking.
- **Prototype:** The diagram builder POC (`/baseout/diagrams`) demonstrates architecture visualization using React Flow and Excalidraw — one feature within the larger Base Out vision.
- **Base Out vision:** A unified product that combines bulletproof Airtable backups with tools that help users deeply understand, document, audit, and act on their data.

---

## Part 1 — Vision, Positioning & Scope (15 min)

### Key Questions

1. **One-sentence pitch:** What is Base Out? *(e.g., "The backup and data intelligence layer for Airtable")*
2. **How does Base Out relate to the existing On2Air Backups product?** Is it a rebrand, a next-gen replacement, or a new product that wraps around it?
3. **Who is the primary user?** Airtable admins? IT managers? Solo power-users? Consultants managing client bases?
4. **What are the top 3 pain points we solve?**
   - Fear of data loss / accidental deletion?
   - No visibility into schema complexity and dependencies?
   - Difficulty restoring or migrating data between bases?
   - Something else entirely?
5. **What does "do more with your data" mean concretely?** List specific outcomes a user gets beyond backups.
6. **Is this a standalone SaaS product, an extension of On2Air, or both?**
7. **What's the competitive landscape?** (Airtable native snapshots, Coefficient, Sync Inc, Whalesync, custom scripts) — where do we win?
8. **What's the monetization model?** Free tier → Pro → Enterprise? Per-base pricing? Bundled with On2Air?

---

## Part 2 — Backup & Restore Core (20 min)

This is the foundation of Base Out. The existing system already handles much of this — decide what carries over, what gets rebuilt, and what's new.

### Current Capabilities to Evaluate

| Capability | Exists Today | Questions |
| --- | --- | --- |
| Scheduled backups | ✅ Interval-based scheduling | Do we keep this model or move to event-driven / webhook-triggered? |
| Multi-base projects | ✅ A "project" groups multiple bases | Is the project abstraction right, or do we move to workspace-level? |
| Dynamic base discovery | ✅ Auto-adds new bases via OAuth meta scan | How do we surface this to users? Auto-add with notification? |
| Table & record export | ✅ CSV format to cloud storage | Do we add JSON, Parquet, or database-native formats? |
| Attachment backup | ✅ With deduplication and retry logic | Do we offer full-fidelity vs. metadata-only attachment modes? |
| Cloud storage destinations | ✅ Google Drive, Dropbox, Box, OneDrive | Do we add S3, R2, local download, or our own managed storage? |
| Restore to Airtable | ✅ Full pipeline: tables → records → links → attachments | How do we handle schema conflicts? Merge vs. overwrite vs. new base? |
| Backup history & metrics | ✅ Per-run tracking of counts, sizes, errors | Do we build a dashboard around this? Trend analysis? |

### New Backup Features to Discuss

9. **Point-in-time restore:** Can users roll back a single table or specific records to a previous snapshot?
10. **Incremental / differential backups:** Do we only capture changes since the last run, or full snapshots every time?
11. **Real-time backup / CDC:** Should we explore change data capture via Airtable webhooks for near-real-time protection?
12. **Cross-base restore:** Can a user restore Table A from Base X into Base Y?
13. **Selective restore:** Can the user pick specific tables, specific records, or specific fields to restore?
14. **Restore preview / dry run:** Can the user see what the restore will do before executing?
15. **Backup verification:** Do we validate data integrity after a backup completes? Checksums? Record counts?
16. **Failure alerting:** How do we notify users when a backup fails? Email? Slack? In-app?
17. **Storage management:** Smart cleanup exists today — do we expose it as user-facing configuration?
18. **Backup encryption:** Do we encrypt data at rest and in transit? Who holds the keys?

---

## Part 3 — Data Intelligence Features (20 min)

This is the "do more with your data" layer that differentiates Base Out from a simple backup tool.

### A. Schema Visualization & Architecture Diagrams
*(The diagram builder POC lives here)*

19. **What's the scope of diagramming?** Just table relationships, or full workspace topology including automations, interfaces, synced tables, and managed components?
20. **Do diagrams auto-generate from backup metadata, or does the user import separately?**
21. **Can users annotate and document their schema within the tool?**
22. **Export formats for diagrams:** PNG, SVG, PDF, interactive HTML, embeddable widget?

### B. Schema Audit & Health Checks

23. **Can we analyze a schema and surface problems?** (Orphaned tables, unused fields, circular lookups, missing descriptions, overly complex formulas)
24. **Do we score base "health" and offer recommendations?**
25. **Can we detect schema drift between backup snapshots?** ("Field X was deleted", "Table Y was renamed")
26. **Change log / audit trail:** Do we auto-generate a human-readable history of schema changes over time?

### C. Data Analytics & Insights

27. **Can we provide analytics on top of backup data?** (Record growth trends, attachment storage trends, table size over time)
28. **Usage patterns:** Which tables are growing fastest? Which automations fire most?
29. **Cost estimation:** Can we help users understand their Airtable tier usage and predict when they'll hit limits?
30. **Data quality reports:** Duplicate records, empty required fields, orphaned linked records?

### D. Documentation Generation

31. **Can we auto-generate a data dictionary from schema metadata?** (Table descriptions, field types, relationships, formulas)
32. **Output formats:** Markdown, PDF, Confluence wiki, Notion page, static HTML site?
33. **Can users add business-context annotations** (field descriptions, ownership, SLA info) that persist across backup runs?

### E. Migration & Cloning

34. **Can users clone a base structure (schema-only, no data) to a new base?**
35. **Can we generate migration scripts between two schema versions?**
36. **Cross-workspace migration:** Move a base from one workspace to another with full fidelity?
37. **Template generation:** Can users save a base schema as a reusable template?

---

## Part 4 — Architecture & Technology Stack (20 min)

### Platform Decisions

| Decision | Options to Discuss | Current State |
| --- | --- | --- |
| **Backend runtime** | Node.js (current), Cloudflare Workers, Deno, Bun | Existing backup server is Node.js + PostgreSQL |
| **Database** | PostgreSQL (current), Cloudflare D1, PlanetScale, Supabase | Existing system uses `pg` (Knex-style) |
| **Job queue** | Current custom state machine, BullMQ, Temporal, Cloudflare Queues | Current: state-based process pipeline |
| **Frontend framework** | Astro (diagram POC), Next.js, SvelteKit, Vite+React | Diagram POC uses Astro + React |
| **CSS / UI** | Tailwind + DaisyUI (POC), shadcn/ui, custom design system | POC uses Tailwind + DaisyUI beta |
| **Hosting** | Cloudflare Workers/Pages, Vercel, Railway, Fly.io, AWS | Target: Cloudflare |
| **Auth** | Existing On2Air auth, Clerk, Auth.js, Airtable OAuth | Existing: custom OAuth + Airtable OAuth |
| **File storage** | Google Drive / Dropbox / Box / OneDrive (current), S3, R2, managed | Current: user's own cloud storage |
| **Diagram engine** | React Flow, Excalidraw, D3.js, custom canvas | POC supports React Flow + Excalidraw |

### Key Architecture Questions

38. **Monolith vs. microservices?** Does the backup engine stay as a separate service, or do we unify into one application?
39. **Do we keep the existing state-machine process pipeline** (start → cleanup → bases → tables → attachments → finish), or redesign it?
40. **How do we handle the Airtable API rate limit (5 req/sec)?** Current approach vs. improvements.
41. **Multi-tenancy model:** Shared infrastructure or isolated per-customer?
42. **Do we need WebSockets / SSE** for real-time backup progress and diagram collaboration?
43. **CI/CD pipeline:** GitHub Actions, Cloudflare Pages auto-deploy, or something else?
44. **Testing strategy:** Unit / integration / E2E / visual regression — what's the minimum for v1?
45. **Monitoring & observability:** What do we instrument? (Backup success rates, restore times, API latency)

---

## Part 5 — Data Model & Storage Architecture (10 min)

### Key Questions

46. **Do we store backup data ourselves or continue using the user's own cloud storage?** Pros/cons of managed vs. BYOS (Bring Your Own Storage).
47. **What's the internal schema for representing an Airtable base?** Do we mirror Airtable's metadata API response exactly or create our own normalized model?
48. **How do we store schema snapshots for diffing?** Full JSON blobs per run, or normalized tables with versioning?
49. **User customization storage:** Annotations, diagram layouts, documentation — where does this live relative to backup data?
50. **Data retention policy:** How long do we keep backups? User-configurable? Smart cleanup tiers?
51. **How large can a single backup get?** Bases with 100+ tables, millions of records, TB of attachments — what are our limits?
52. **Offline / local mode:** Is there a use case for running Base Out locally without cloud dependency?

---

## Part 6 — User Experience & Design (10 min)

### Key Questions

53. **What's the user journey?** Sign up → Connect Airtable → Configure first backup → Explore data → Generate diagrams?
54. **Navigation model:** Dashboard → Projects → Bases → [Backups / Diagrams / Audit / Docs]?
55. **Do we need a "workspace" concept on our side** that maps to Airtable workspaces?
56. **Dashboard priorities:** What does the user see first? Backup status? Schema overview? Action items?
57. **Mobile experience:** Desktop-only for v1, or do we need responsive backup status views?
58. **Notifications center:** Where do backup successes, failures, and schema changes surface?
59. **Onboarding flow:** How many steps from sign-up to first successful backup?
60. **Do we follow Airtable's visual language** (colors, field type icons) or establish a distinct brand?

---

## Part 7 — Integrations & Extensibility (10 min)

### Key Questions

61. **Airtable integration depth:** Beyond the metadata API and records API — do we use webhooks, scripts API, or extensions API?
62. **Notification integrations:** Slack, email, Microsoft Teams, PagerDuty — which are v1?
63. **Do we expose a Base Out API?** Can power users programmatically trigger backups, pull schema data, or generate diagrams?
64. **CLI tool:** Is there value in a command-line tool for headless backup management or CI/CD integration?
65. **Embedding SDK:** Can customers embed backup status or diagrams in their own apps or Airtable interfaces?
66. **Webhook / event system:** Can external systems subscribe to "backup completed" or "schema changed" events?
67. **Import from other tools:** Can we ingest from draw.io, Lucidchart, or ERD tools to cross-reference with live schemas?
68. **Plugin architecture:** Do we want community-built extensions (custom diagram layouts, audit rules, export formats)?

---

## Part 8 — Business, Operations & Launch (10 min)

### Key Questions

69. **Pricing structure:**
    | Tier | What's Included? |
    | --- | --- |
    | Free | 1 base, manual backups only, PNG export |
    | Pro | Unlimited bases, scheduled backups, diagrams, restore, audit |
    | Enterprise | SSO, audit logs, managed storage, SLA, white-label |
70. **How do we migrate existing On2Air Backup customers?** Automatic upgrade path or parallel products?
71. **Launch strategy:** Private beta → public beta → GA? Airtable Marketplace listing? Product Hunt?
72. **Legal / compliance:** Do we handle customer data (PII in Airtable records)? SOC2 implications? GDPR?
73. **Support model:** Self-serve docs, community forum, chat support, dedicated CSM?
74. **Success metrics:** What KPIs define whether Base Out is working?
    - Backup success rate > 99.5%?
    - Time-to-value (sign-up → first backup) < 5 min?
    - Monthly active users generating diagrams?
    - NPS score?
75. **Naming / branding:** Is "Base Out" the final name? Domain availability? Trademark?

---

## Wrap-Up: Prioritization Exercise (10 min)

### MoSCoW Framework

Sort every discussed feature into priority buckets:

| Priority | Definition | Examples (to fill in) |
| --- | --- | --- |
| **Must Have** | v1 is broken without it | Scheduled backups, restore, Airtable OAuth, backup history |
| **Should Have** | Important but launchable without — target v1.1 | Schema diagrams, audit trail, selective restore |
| **Could Have** | Nice-to-have — backlog | Data analytics, migration tools, CLI, plugin system |
| **Won't Have (yet)** | Explicitly out of scope for now | Real-time CDC, multi-source (non-Airtable), white-label |

### Feature Modules Summary

Before leaving, confirm which modules are in-scope for v1:

| Module | In v1? | Notes |
| --- | --- | --- |
| Backup Engine (scheduled, multi-base) | | |
| Cloud Storage Destinations | | |
| Full Restore Pipeline | | |
| Backup History & Dashboard | | |
| Schema Visualization / Diagrams | | |
| Schema Audit & Diffing | | |
| Data Dictionary / Documentation | | |
| Analytics & Insights | | |
| Migration & Cloning Tools | | |
| API / CLI | | |
| Alerts & Notifications | | |

### Action Items

| # | Action Item | Owner | Due |
| --- | --- | --- | --- |
| 1 | Draft the PRD from brainstorm notes | | +48hrs |
| 2 | Finalize v1 module scope (MoSCoW output) | | +24hrs |
| 3 | Architecture decision record (ADR) for tech stack | | +1wk |
| 4 | Wireframes for core user flows | | +1wk |
| 5 | Airtable API capability audit (webhooks, rate limits, permissions) | | +1wk |
| 6 | Migration plan for existing On2Air Backup customers | | +2wk |
| 7 | Design internal data model / schema | | +1wk |
| 8 | Set up Base Out project repo and CI/CD | | +1wk |

---

## Appendix A: Existing Backup Pipeline Reference

The current On2Air Backups server processes backups through this state machine:

```
start → cleanup → bases → tables → attachments → finish
```

**Restore pipeline:**
```
restore-project → base → tables → records → links → attachments → finish
```

**Storage destinations supported:** Google Drive, Dropbox, Box, OneDrive

**Key data types tracked:**
- `Backup` — Project-level config (schedule, storage, source connection)
- `BackupsHistory` — Per-run metrics (base count, table count, record count, attachment count/size, errors)
- `BackupBase` — Individual base within a project
- `BackupTable` — Individual table within a base

---

## Appendix B: Airtable Elements Reference

These are the Airtable primitives Base Out needs to understand (cataloged in the diagram POC):

| Category | Elements |
| --- | --- |
| **Hierarchy** | Workspaces, Bases, Managed Components |
| **Data Modeling** | Tables, Fields (30+ types), Relationships (Linked Records, Lookups, Rollups), Views |
| **Data Mapping** | Synced Tables (uni-directional, bi-directional, field-level mappings) |
| **Orchestration** | Automations (Triggers → Conditions → Actions), Webhooks |
| **Front-End** | Interfaces (Pages → Element bindings → Field/Table references) |

### Field Types to Support

Single Line Text, Long Text, Rich Text, Number, Currency, Percent, Duration, Single Select, Multiple Select, Checkbox, Rating, Date, Date & Time, Created Time, Last Modified Time, Email, Phone, URL, Linked Record, Lookup, Rollup, Count, Formula, Attachment, Barcode, Button, Auto Number, Created By, Last Modified By, Collaborator, Sync Source

---

> **Next Step:** Designated writer drafts the full PRD from these notes within 48 hours, circulates for async review, and we schedule a 30-minute follow-up to lock scope and assign engineering tracks.
