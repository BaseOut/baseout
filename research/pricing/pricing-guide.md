# Baseout Pricing Guide

**Version:** 2026-08-03. Clean reference for the current pricing model — tiers, allowances, gates, and line-item definitions. Decision history and rationale live in [`final-pricing-matrix.md`](final-pricing-matrix.md). Reconcile into `shared/Baseout_Features.md` (naming dictionary, tier matrix, Stripe metadata) before implementation.

---

## 1. Tiers

Four public tiers, named as a capacity ladder (size of estate, not company stage), plus a sales-led Enterprise tier:

| | **Lite** | **Core** | **Plus** | **Max** | **Enterprise** |
|---|---|---|---|---|---|
| Monthly | $49 | $99 | $199 | $399 | Custom |
| Annual — **~2 months free** | $499/yr | $999/yr | $1,999/yr | $3,999/yr | Custom |
| Annual effective per month | $41.58 | $83.25 | $166.58 | $333.25 | — |

- Annual framing is **"~2 months free"** — displayed as the monthly price plus the annual price (e.g. *$49/mo · $499/yr — ~2 months free*), not as a separate discounted monthly price. Annual prices end in 9 and sit just under the $500 / $1,000 / $2,000 / $4,000 thresholds.

- Each tier's pricing-page subtitle shows its estate allowance (e.g. **Core** — up to 750K records · 250 GB files · weekly backups).
- Billing and capability gating key on stable internal tier slugs; the names above are display copy.
- No tier shows "Unlimited" on any lever — every cap is a number, with top-tier caps set above any realistic customer.

## 2. Trial

**14 days of Lite.** Full Lite allowances and features, with a **one-time backup** (single snapshot). Trial data is deleted 14 days after the backup runs unless the account upgrades; escalating "your backup will be deleted on {date}" notifications lead up to the deadline. On the pricing page the trial is a single line under the tier cards — *"Free 14-day trial — full Lite access, one snapshot"* — not a fifth column.

## 3. Tier matrix

| Lever | **Lite** | **Core** | **Plus** | **Max** | **Enterprise** |
|---|---|---|---|---|---|
| Records under management | 250K | 750K | 1.5M | 5M | Custom |
| File storage under management (GB) | 50 | 250 | 500 | 1,500 | Custom |
| AI credits /mo | 200 | 1,000 | 5,000 | 15,000 | Custom |
| Bring your own AI key | — | — | ✓ | ✓ | ✓ |
| Bases under management | 15 | 50 | 150 | 500 | Custom |
| Backup frequency (max cadence) | Monthly | Weekly | Daily | Instant | Instant |
| Manual (on-demand) backups /mo | 1 | 5 | 10 | 25 | Custom |
| Spaces | 3 | 10 | 25 | 100 | Custom |
| Database | SQLite (D1) | SQLite (D1) or dedicated Postgres database in a shared cluster | Dedicated Postgres database in a dedicated cluster | Dedicated cluster or bring your own database | Custom |
| Database size (org-wide, record data) | 5 GB | 10 GB | 25 GB | 50 GB | Custom |
| Seats | 1 | 5 | 10 | 25 | Custom |
| Restores /mo | 3 | 10 | 30 | Fair use | Fair use |
| Schema history retention | 90 days | 180 days | 1 year | 3 years | 5 years / Custom |
| Record history retention | 90 days | 180 days | 1 year | 3 years | 5 years / Custom |
| Internal snapshots (usage applies to file storage under management) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Snapshot destinations (external) | 1 | 2 | 3 | 5 | Custom |
| Snapshot destination types | Cloud drives | Cloud drives | Cloud drives + S3 | Cloud drives + S3 | Custom |
| MCP access | ✓ | ✓ | ✓ | ✓ | ✓ |
| Automations & interfaces backup | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comments backup | ✓ | ✓ | ✓ | ✓ | ✓ |
| API access | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monthly call allowance (API + MCP + Direct SQL) | 10K | 50K | 250K | 1M | Custom |
| Active reports | 5 | 25 | 50 | 100 | Custom |
| Documents | 10 | 25 | 50 | 100 | Custom |
| SSO / SAML | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit logs | — | — | — | ✓ | ✓ |
| PII detection | ✓ | ✓ | ✓ | ✓ | ✓ |
| Direct SQL access | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support | Email | Priority email | Priority email | Priority + chat | Dedicated CSM + SLA |

## 4. Line-item definitions

**Records under management** — total Airtable records Baseout is backing up and managing for the organization, org-wide across all Spaces. The primary self-selection meter. Snapshot version history does **not** multiply the count (30 daily snapshots ≠ 30× records — history depth is priced by retention, not by this meter).

**File storage under management (GB)** — gigabytes of files Baseout stores or manages: attachment files, plus any snapshots kept in Baseout-managed storage. Org-wide. Snapshots delivered to **external** destinations do not count — external bytes live in the customer's own storage; the external-delivery service is priced by the destination slots, not by volume.

**AI credits /mo** — dedicated monthly allowance for AI features (schema chat, AI docs, annotations, and AI consumed through MCP — one pool regardless of access path). Resets each billing cycle; top-up packs available. **1 credit = 1¢ of value**; consumption is Cloudflare's model price + 25% markup (`credits = provider cost × 125`). Three model levels — **Fast** (llama-3.1-8b-fast), **Balanced** (gpt-oss-120b, default), **Advanced** (kimi-k2.5) — a Balanced chat turn ≈ 0.2 credits, so Lite's 200 credits ≈ 1,000 chat turns/mo. Full rate matrix: [`ai-credit-model.md`](ai-credit-model.md).

**Bring your own AI key** — from Plus: enter your own AI provider key and Baseout uses it instead of the credit pool for AI features.

**Bases under management** — total Airtable bases across all Spaces that Baseout backs up. Caps the per-base overhead (each base runs its own backup job, schema discovery, and webhook subscription) independently of record volume.

**Backup frequency** — the *maximum* scheduled cadence for the tier; any slower cadence is always available (a Max customer may back up monthly). Instant = webhook-driven capture as changes occur.

**Manual (on-demand) backups /mo** — user-triggered backups outside the schedule. Their snapshots and history consume file storage and retention like any scheduled run.

**Spaces** — number of Spaces (containers binding a Platform, its Connections, backup configuration, and a database) the organization can create.

**Database** — every paid tier includes a live, queryable database of backed-up data ("dynamic database"), provisioned per Space. Tiers buy the isolation class:

- **Lite** — SQLite (D1).
- **Core** — SQLite (D1), or a dedicated Postgres database in a shared cluster.
- **Plus** — a dedicated Postgres database in a dedicated cluster (the whole cluster serves one account).
- **Max** — dedicated cluster, or **bring your own database**: any Postgres we can reach with a connection string. Approved (tested) vendors at launch: Supabase, Neon, DigitalOcean; the list grows over time, and any other Postgres works via connection string on a your-database-your-ops basis.
- **Enterprise** — custom, including private-network/on-prem BYODB arrangements.

Hosting-provider names stay out of pricing copy (documentation detail only); Supabase/Neon are not managed-hosting options.

**Database size (org-wide)** — total record-data volume across all Space databases; attachments don't count here (they ride the file-storage meter). Extendable via the +2 GB/mo add-on, or upgrade for a bigger jump. Technical footnote: one database per Space; on D1 a single database cannot exceed 10 GB (platform limit).

**Seats** — team members on the organization. Additional seats purchasable as an add-on (pricing TBD).

**Restores /mo** — included restore operations per month. Fair use at Max and Enterprise.

**Schema history retention** — how far back schema versions, changelog, and structural history are kept.

**Record history retention** — how far back record-level history/snapshots reach ("how far back can I go?"). Shares the schema-history ladder for now.

**Internal snapshots** — each backup run produces CSV snapshots of the data; keeping them in Baseout-managed storage is included at every tier and doesn't consume a destination slot. Their storage usage applies to file storage under management.

**Snapshot destinations (external)** — how many destinations outside Baseout the snapshots can also be delivered to, alongside internal snapshots. Types: cloud drives (Google Drive, Dropbox, Box, OneDrive) at every paid tier; S3 from Plus.

**MCP access** — Model Context Protocol server access to the organization's backed-up data. Included at every tier (usage drives usage). AI consumed through MCP draws from the AI credit pool (no double-metering); calls count against the API + MCP monthly call limit.

**Automations & interfaces backup / Comments backup** — coverage: Airtable automations, interfaces, and comments are captured at every tier alongside schema, records, and attachments.

**API access** — programmatic access to Baseout, included at every tier. A standard burst rate limit applies everywhere (over-usage protection); the monthly call allowance is tiered (values TBD).

**Monthly call allowance (API + MCP + Direct SQL)** — one combined monthly allowance covering API calls, MCP calls, and Direct SQL queries. The standard rate limit governs burst behavior; this governs monthly volume.

**Active reports** — number of concurrently active analytics reports.

**Documents** — user-authored schema documentation (the Docs tab), org-wide total. Document content storage counts against file storage under management (target architecture: a database entry per document with the content body as an R2 file; see decision log — bodies currently reside in the per-Space DB).

**Governance** — broken out as individual levers, each with its own tier placement:

- **SSO / SAML** — single sign-on; included at every tier.
- **Audit logs** — organization audit trail; available from Max (retention ladder TBD).
- **PII detection** — scanning/flagging of personally identifiable information; included at every tier.
- **Direct SQL access** — read-only SQL against the backed-up database; included at every tier. Queries count against the monthly call allowance.

**Support** — support channel and priority ladder.

Product constants (not pricing lines): 2 Connections per Space; platform Connections are bounded by the Space cap.

## 5. Pricing-page layout

**Tier cards (top of page).** One card per public tier + Enterprise: name, price (monthly, with "$X/yr — ~2 months free" as the annual line), **"Most popular" badge on Core**, CTA, and six spec lines:

1. Records under management
2. File storage (GB)
3. Bases
4. Backup frequency
5. Spaces
6. AI credits /mo

Enterprise card: "Everything in Max, plus…" (custom everything, private BYODB, SSO/SAML, custom retention, CSM/SLA) with a "Talk to us" CTA. Trial appears as one line under the cards.

**Full comparison table (below the fold)**, grouped:

| Group | Rows |
|---|---|
| **Backup** | frequency · bases · coverage (records, attachments, schema, views, automations & interfaces, comments) · internal snapshots · snapshot destinations (external) · destination types |
| **Restore & retention** | restores/mo · record history retention · schema history retention |
| **Data access** | database · database size · SQL access · API access · MCP access |
| **AI & intelligence** | AI credits · AI features by tier · active reports |
| **Collaboration** | seats · Spaces |
| **Governance & security** | SSO/SAML · audit logs · PII detection · Direct SQL |
| **Support** | support ladder |

Presentation rules: meters always show the number (never a bare ✓); gates show the ceiling value; feature gates show ✓/—. Footnote: *"One database per Space — sizes shown are organization-wide totals for record data; files and attachments count against file storage under management."*

## 6. Add-on library

One flat price per item, identical at every tier. Customers extend a limit by buying more, or upgrade to the next tier. **Recurring** add-ons cover limits that persist month to month; **one-time packs** cover allowances that reset each billing cycle.

**Recurring (monthly):**

| Add-on | Unit | Price |
|---|---|---|
| Records | +100K records | $10/mo |
| File storage | +50 GB | $10/mo |
| Database size | +2 GB | $10/mo |
| Bases | +3 bases | $10/mo |
| Spaces | +1 Space | $10/mo |
| Seats | +2 seats | $10/mo |
| Snapshot destinations (external) | +1 destination (up to the 5 max) | $10/mo |
| Active reports | +5 reports | $10/mo |
| Documents | +10 documents | $10/mo |
| AI credits | +1,000 credits/mo | $10/mo |
| API / MCP / SQL calls | +50K calls/mo | $10/mo |
| Restores | +3 restores/mo | $10/mo |

**One-time packs** (this cycle only; 20% markup over the monthly version — if you need it every month, the recurring add-on is the better buy):

| Add-on | Unit | Price |
|---|---|---|
| AI credits | +1,000 credits | $12 |
| API / MCP / SQL calls | +50K calls | $12 |
| Restores | +3 restores | $12 |

*Prices are proposed pending the margin re-run; item list and structure are final.*

**Not purchasable — upgrade only:** backup frequency, database isolation class, retention (schema + record history), S3 destination type, audit logs, bring-your-own-AI-key, support level. These are the tier ladder itself; extending them means moving up a tier.

## 7. Limit-hit behavior

One rule set, identical at every tier: a **warning threshold at 90%** of each limit (notifications begin; the matching add-on/upgrade is offered; repeated at 100%), and **enforcement at the limit itself**. Governing rules: **never fail mid-job** — an in-flight backup always finishes even if it crosses the line (internal engineering tolerance, not a published grace) — existing data is never deleted on overage, and restore always works.

| Lever class | Levers | Warning | At the limit |
|---|---|---|---|
| **Background meters** | records, file storage, database size | at 90% and 100% | new backup runs pause at the next job boundary; in-flight runs always complete |
| **Interactive meters** | AI credits, API/MCP/SQL calls | at 90% and 100% | clean stop at the point of use (AI prompt / 429) with top-up offer, until top-up or cycle reset |
| **Creation caps** | Spaces, bases, seats, destinations, reports, manual backups, restores | at the cap | next creation/action blocked with add-on/upgrade offer; existing items unaffected |

No published overage percentages — the limit is the limit, and the 90% warning window is where the customer decides (add-on, upgrade, or clean up).

## 8. Legacy migration (On2Air)

| On2Air plan | → Baseout tier |
|---|---|
| Starter | Lite |
| Essentials | Core |
| Professional | Plus |
| Premium | Max |

Migrating On2Air customers receive a **20% lifetime discount** on any Baseout tier at or above their mapped tier — a thank-you for being an On2Air customer and the incentive to move. The discount **floats against list price**: list prices may change over time, but the 20% off holds for as long as they remain a customer.

## 9. Status

**Pricing model complete — all items locked 2026-08-03.** The AI model menu is confirmed (Fast: llama-3.1-8b-fast · Balanced: gpt-oss-120b · Advanced: kimi-k2.5 · embeddings: bge-m3; rates in [`ai-credit-model.md`](ai-credit-model.md)).

**Pre-launch engineering requirements carried out of the pricing work:**

1. Validate Baseout engine efficiency ≥2× vs. the legacy engine — the Plus p90 margin depends on it (`final-pricing-matrix.md` §2.1).
2. Dedicated clusters provision lean ($15-class) and scale with use.
3. Reconcile this guide into `shared/Baseout_Features.md` (naming dictionary, tier matrix, Stripe metadata slugs) before implementation.
