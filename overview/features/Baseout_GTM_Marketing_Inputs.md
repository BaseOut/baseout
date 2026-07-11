# Baseout — GTM & Product Marketing Inputs

**Prepared for:** GTM / product-marketing strategist
**Date:** July 2026
**Status:** Positioning, messaging, and ICP are **undecided — that's the output we're hiring for.** This document is the input pack: what the product is and does, every feature with its "why it matters" seed, differentiation raw material, audience facts and hypotheses, and the guardrails (what's shipped vs. roadmap, claims we can and can't make). Where we state internal beliefs, they're labeled as beliefs — challenge them.

**Note on pricing:** pricing and packaging are under a separate, parallel engagement and are also undecided. Nothing in this document implies tiers or price points, and feature-to-tier assignments in internal specs should be treated as provisional. Messaging work should avoid hard-coding price or plan names for now.

---

## 1. What Baseout Is

### 1.1 In one paragraph

Baseout is the **backup, restore, and data intelligence layer for Airtable**. It automatically backs up everything in a customer's Airtable estate — schema, records, attachments, and (via guided submission) automations and interfaces — to storage the *customer* controls or to Baseout-managed storage. It can restore any of it, point-in-time, without ever overwriting live data. And on top of the backup pipeline it builds things Airtable itself doesn't offer: an auto-generated visual map of your schema, a change history of everything, a health score for every base, documentation tooling, and a live SQL copy of your data you can query directly.

### 1.2 The elevator pitch on file (a starting point, not a mandate)

> "Baseout is the backup, restore, and data intelligence layer for Airtable — giving platform admins real-time protection, schema visibility, and direct SQL access to their own data."

V1 positions as a best-in-class Airtable backup and admin utility. V2 grows into a multi-platform data-management layer (Notion, HubSpot, Salesforce are the named next platforms) — the positioning you choose should have room for that arc without leaning on it at launch.

### 1.3 Business context — an established player relaunching, not a cold start

Baseout is the full rebrand and next-generation replacement of **On2Air Backups**, a known name in the Airtable ecosystem with **~200 paying customers** who will migrate to Baseout. This matters for GTM three ways:

1. **There is existing brand equity and trust in the Airtable community** to transfer, and an existing customer base to re-onboard with care (their experience must feel like an upgrade, not a rug-pull).
2. **There is real usage history** — we know what actual Airtable admins back up, how often, and how big their estates are (data available on request for ICP work).
3. **The category is proven but thin** — customers already pay for Airtable backup; the closest competitor went out of business; Airtable's own snapshots are the "do nothing" default.

### 1.4 Where it's going (V2 trajectory)

Multi-platform Spaces (back up and analyze Notion + Airtable + HubSpot under one roof), an MCP server and RAG pipeline that expose the customer's data layer to AI assistants, a governance/compliance suite, and third-party connectors (Zapier, Make). Useful for vision-level messaging; none of it is launch-claimable (see §5.3).

---

## 2. The Problems It Solves (Benefit Raw Material)

Four distinct jobs-to-be-done, each with its own emotional register. Any messaging hierarchy will likely lead with one and support with the others — which one leads is an ICP decision.

| Job | The pain, in the customer's words | Emotional register | Benefit seed |
|---|---|---|---|
| **Insurance** | "One wrong click — by me or anyone on the team — and years of work is gone. Airtable's undo only goes so far." | Fear, responsibility | *Sleep at night. Every base, backed up on schedule, restorable in minutes.* |
| **Governance / ownership** | "Best practice (and our auditors) say a backup that lives inside the vendor isn't a backup. Airtable snapshots don't count." | Duty, professionalism | *A true external copy — in YOUR storage if you want. Your data finally lives somewhere you control.* |
| **Visibility** | "Our Airtable grew organically for 4 years. Nobody knows what's connected to what, what's dead, or what changed last week." | Overwhelm → mastery | *See your whole schema as a living diagram. Know what changed, when, and how healthy every base is.* |
| **Data liberation** | "Our data is trapped in Airtable's format. I want to query it with SQL, connect BI tools, build on it." | Frustration → empowerment | *A live SQL database of your own data. Query it, connect it, build on it.* |

**A structural note for messaging:** the first two jobs are served by *static* backup (files to storage), the last two require *dynamic* backup (a hosted database copy). These modes carry opposite privacy stories — static/BYOS is "we never store your data"; dynamic is "trust us to host it and we'll make it superpowered." Both are true and both are marketed, but they should never collide in the same sentence. See §4.2.

---

## 3. Complete Feature Inventory

Organized by capability area. **Status** flags what marketing can promise at launch: ✅ shipped · ◐ partial/in-progress · 🔜 committed V1 (in build) · 🗺 V2 roadmap. Feature-to-plan assignment is provisional everywhere (pricing engagement in flight).

### 3.1 Backup (the core)

| Feature | What it does | Why it matters (benefit seed) | Status |
|---|---|---|---|
| Scheduled backups | Automatic runs — monthly, weekly, daily; "instant" (webhook-driven, near-real-time) is the top of the range | Set-and-forget protection; cadence = how little you can afford to lose | ✅ (instant 🔜) |
| Manual on-demand runs | One-click "back up now" | Pre-flight ritual before big changes: back up, then break things safely | ✅ |
| Full-fidelity capture | Schema (tables, fields, views), all records, all attachments; deduped attachment handling | Not just rows — the *structure* and files too. A complete copy, not a CSV shadow | ✅ |
| Automations & interfaces backup | Airtable's API doesn't expose these; Baseout provides guided intake (forms, scripts, inbound API) to capture and version them | The parts of your base you *can't* rebuild from memory are exactly the parts Airtable won't export | 🔜 |
| Multi-base, auto-discovery | Connect once, select bases, optionally auto-add future bases | Coverage doesn't rot as the estate grows | ✅ |
| Storage destinations | Google Drive, Dropbox, Box, OneDrive, Baseout-managed storage (Cloudflare R2); S3, Frame.io, fully custom BYOS coming | Your backups land where *you* live. Only vendor with OneDrive. | ✅ (S3/Frame.io 🔜) |
| BYOS privacy posture | On static backups to customer-owned storage, record data streams through memory and is **never stored on Baseout servers** | "We back up your data without ever keeping it." A genuine trust differentiator | ✅ |
| Backup audit trail | Per-run report: what was captured, skipped, errored; per-entity verification; run history dashboard | Trust but verify — proof the backup actually worked, every time | ◐ |
| Retention & smart cleanup | Keep snapshots per policy (e.g., daily for 30 days, then weekly); automated pruning | History without hoarding; governance-grade retention windows | 🔜 |
| Real-time progress | Live backup progress on the dashboard (WebSocket-driven) | Watching it work builds trust in an insurance product | 🔜 |

### 3.2 Restore

| Feature | What it does | Why it matters | Status |
|---|---|---|---|
| Point-in-time restore | Restore from any retained snapshot | "Get me back to Tuesday" | 🔜 |
| Base-level & table-level restore | Whole base or a single table | Surgical recovery, not all-or-nothing | 🔜 |
| Never overwrites | Restores always create a *new* base or table | Zero-risk recovery — you can't make the incident worse | 🔜 |
| Post-restore verification | Record-count validation and error audit after restore | Confidence the recovery is complete | 🔜 |
| AI-assisted restore guidance | For entities that can't be auto-restored (automations, interfaces), curated AI prompts walk the customer through reconstruction | Even the "unrestorable" parts have a path back | 🗺 |

### 3.3 Schema intelligence

| Feature | What it does | Why it matters | Status |
|---|---|---|---|
| Schema visualization | Auto-generated, always-current ERD/node graph of every base — tables, fields, relationships | The "whoa" demo moment. Nobody has ever *seen* their Airtable before | ◐ |
| Pre-signup schema visualization | OAuth in and see your schema diagram **before creating an account** | The top-of-funnel hook: instant value, zero commitment | 🔜 |
| Schema changelog | Human-readable history: "Field X was deleted on March 12" | Answers "what changed?" — the first question after anything breaks | 🔜 |
| Base health score | 0–100 audit grade per base: orphaned fields, missing descriptions, circular lookups, formula errors; configurable rules | Turns "our base is a mess" into a number you can improve — and a consultant deliverable | 🔜 |
| Schema documentation | Rich-text docs with tags pinned to tables/fields/views, external links, embedded mini-diagrams | The missing wiki for your Airtable architecture | ◐ |
| AI-generated documentation | AI writes field/table descriptions and schema summaries from structure and usage | Documentation that writes itself | 🔜 |
| Diagram export | PNG/SVG/PDF export, embeddable widget | Diagrams that travel — into decks, docs, client reports | 🗺 |

### 3.4 Data intelligence (requires the hosted database copy)

| Feature | What it does | Why it matters | Status |
|---|---|---|---|
| Record metrics & growth trends | Record counts per table/base over time, storage growth | See the estate growing before it becomes a problem | 🔜 |
| Data changelog | History of record-level changes | Forensics: who-changed-what, over months | 🔜 |
| Data alerts | Rules like "alert me if this table drops below N records" or a field matches a pattern | The smoke alarm, not just the insurance policy | 🗺 |
| PII detection | Scans for personally identifiable information | Compliance radar for data sprawl | 🗺 |
| Analytics & reports | Dashboards, scheduled reports, exports | Estate reporting for stakeholders | 🗺 |

### 3.5 Access & integration (requires the hosted database copy)

| Feature | What it does | Why it matters | Status |
|---|---|---|---|
| Live SQL database of your data | Your Airtable data continuously synced into a real database (SQLite → PostgreSQL ladder; enterprise can bring their own DB) | The unlock: query with SQL, connect BI tools, build apps — on *your* data, outside Airtable's limits | 🔜 |
| SQL REST API | Query the database over HTTPS with a token — no SQL client needed | Scripts and tools hit your data in one line | 🔜 |
| Direct SQL access | A real connection string | Plug in psql, Metabase, Grafana, anything | 🔜 |
| Inbound API | Documented public API to push data Airtable's API doesn't expose (automations, interfaces, custom metadata); agent/AI-friendly | The estate's missing pieces get a front door | 🔜 |
| MCP server / RAG / chatbot | Expose the data layer to AI assistants; hosted chatbot grounded in the customer's data | "Ask your Airtable questions" — the AI-era story | 🗺 |
| Zapier / Make connectors, outbound webhooks | Event-driven integrations | Backup events join the automation fabric | 🗺 |

### 3.6 Governance (V2 — vision material only)

Data quality rules, classification, lineage, retention policies, access controls, audit trail, PII scanning, SOC 2/GDPR tooling. Entirely roadmap; useful for enterprise-vision slides, not launch claims.

### 3.7 Experience & trust surface

| Feature | Notes | Status |
|---|---|---|
| Passwordless sign-in (magic link), no card required to start | Friction-free trial entry | ✅ |
| 7-day free trial with a real backup run | Try-before-buy on the customer's actual data (trial shape may change with pricing work) | ✅ |
| Mobile-responsive web app | Status checks from anywhere | ✅ |
| Runs embedded inside Airtable | Baseout can run as an Airtable interface extension, context-aware to the base you're viewing | 🔜 |
| Guided tours & tooltips | Onboarding wizard, first-backup tour | 🔜 |
| Notifications | Email + in-app on all; Slack, outbound webhooks, Teams, PagerDuty up the range | ◐ (email ✅) |
| Encryption | AES-256-GCM for all stored credentials; encryption at rest everywhere Baseout hosts data | ✅ |
| SOC 2 | **In progress** (audit runway started ~April 2026) — "SOC 2 in progress" is claimable; "SOC 2 certified" is NOT yet | ◐ |
| GDPR / DPAs | Required before hosted-data plans launch; planned from day one | ◐ |
| SSO (SAML), 2FA | Enterprise auth | 🔜 |

---

## 4. Differentiation Raw Material

### 4.1 The competitive frame

| Alternative | Reality | Angle available to us |
|---|---|---|
| **Airtable native snapshots** | Free, built-in, and the default "we're covered" belief | The core objection to beat: snapshots live *inside* Airtable, restore whole-base only, expire, and satisfy no external-copy governance requirement. "A backup your vendor holds for you is a promise, not a backup." |
| **Sync Inc** | Out of business | Category cautionary tale — "your backup vendor shouldn't be a startup experiment" cuts both ways; our 200-customer, multi-year history is the counter |
| **Whalesync** | Pivoting to a marketing-sync niche | We stay general-purpose |
| **Coefficient** | Spreadsheet-sync focus | Not a backup, not schema intelligence |
| **DIY scripts** | Common among exactly our most technical buyers | "You could build it. You shouldn't have to maintain it." Fidelity (attachments, rate limits, retries) is where DIY quietly fails |

### 4.2 Claims inventory (with guardrails)

Claims the team believes are true and defensible — **verify before external use**, especially the "only"s:

- **Only backup solution focused exclusively on Airtable** — depth story: field types, rate limits, attachment expiry quirks handled natively.
- **Most storage destinations of any vendor; the only one supporting OneDrive.**
- **Only vendor offering both bring-your-own-storage AND bring-your-own-database.** Competitors are consolidating onto their own hosted storage.
- **On static/BYOS plans, customer record data is never stored on Baseout servers** — streams through memory to the customer's own storage. Strong privacy/trust claim; must always be scoped to static/BYOS mode ("never stores your data" as a blanket claim would be false for dynamic customers).
- **Only solution turning Airtable into a live SQL layer** (post-Sync Inc). Scope carefully against Whalesync/Coefficient sync products.
- **Restore never overwrites live data.** Safety claim, uncontested.

The static-vs-dynamic tension deserves deliberate handling: the privacy claim (static) and the hosted-SQL claim (dynamic) are both flagship differentiators but describe opposite data postures. Precedent for handling: frame as *customer choice* — "your data, your rules: keep it fully external, or let us host a copy and make it queryable."

### 4.3 Trust assets and liabilities

**Assets:** ~200 paying customers and years of On2Air operating history; encryption everywhere; the BYOS posture; per-run audit reports (provable backups); Cloudflare + PostgreSQL infrastructure story.
**Liabilities to manage:** the rebrand itself (continuity messaging needed so On2Air customers and community don't read "shutdown"); SOC 2 not yet certified; several headline features (restore! ) still in build at time of writing — see §5.3.

---

## 5. Audience Raw Material (for the ICP Decision)

### 5.1 The persona on file

**The Airtable Platform Admin** — the person responsible for building, managing, and protecting an organization's Airtable infrastructure:

- Internal IT managers, RevOps/BizOps owners, and **independent Airtable consultants managing multiple client accounts**
- Manages one or more Airtable workspaces on behalf of an organization or clients
- Needs reliable, auditable, low-maintenance backup infrastructure
- Cares about data integrity, schema visibility, fast recovery
- **Technically capable** — comfortable with OAuth, storage configuration, SQL
- Extends naturally to admins of Notion/HubSpot/Salesforce as platforms are added (V2)

Secondary personas (V2): developers building on the SQL layer; enterprise IT/compliance officers (SOC 2, SSO, data sovereignty).

### 5.2 Segment sketches (hypotheses to validate, not conclusions)

| Segment | Shape | Leading job (§2) | Notes |
|---|---|---|---|
| Solo / small-team ops admin | 1 org, a few bases | Insurance | Bulk of the legacy base; price-sensitive; wants simple |
| Airtable consultant / agency | Many client orgs | Visibility + Insurance | High-leverage: one convinced consultant deploys us across every client; health scores and diagrams are *their* client deliverables; potential channel/referral motion |
| RevOps / BizOps at a scale-up | Airtable is business-critical | Data liberation + Insurance | Wants frequency, retention, SQL for BI, Slack alerts |
| Enterprise IT / compliance | Governance mandates | Governance | Needs SOC 2 (pending), SSO, BYODB; not marketable at scale until certification lands |

### 5.3 What the existing ~200 customers tell us

They bought a **static backup product** (the current feature set they use is scheduled file backups to their own cloud storage), skewing toward the smaller/simpler end. Their plan mix, base counts, and volumes are available on request — that dataset is the single best empirical input for the ICP decision. Two cautions: (a) the legacy base may over-represent the "insurance" job simply because that's all On2Air sold — don't let it cap the ambition; (b) their migration experience is itself a GTM moment (see §6.4).

### 5.4 Buying-trigger hypotheses

Moments that likely open the wallet (validate in customer interviews):

1. A deletion incident or near-miss ("someone deleted a table last week").
2. A compliance/security review, SOC 2 audit of *their* company, or enterprise customer questionnaire asking "how is this data backed up?"
3. A new admin inherits a sprawling, undocumented estate (visibility need spikes).
4. A consultant standardizing their client stack.
5. A BI/reporting project hits Airtable's API and format limits (SQL need).
6. Airtable pricing/packaging changes prompt "how portable is our data?" audits.

### 5.5 Where to find them (hypotheses)

The Airtable Community forum, r/airtable, the BuiltOnAir ecosystem (podcast/community), Airtable consultant directories and agency networks, no-code communities, and the planned **Airtable Marketplace listing** (organic discovery). The team's existing On2Air footprint in these spaces is an asset to inherit deliberately rather than let lapse in the rebrand.

---

## 6. Messaging Ingredients & Practical Tips

### 6.1 Funnel mechanics already in the product

- **Pre-signup schema visualization** is the designed hook: OAuth in, see your schema diagram, *then* hit "Start backing up your data." Messaging can promise value in 60 seconds with zero commitment.
- **Passwordless magic-link signup, no credit card** for trial — friction claims are legitimate.
- **The trial includes a real backup run on the customer's own data** — "see your actual data protected" beats a demo. (Trial shape may change with the pricing engagement; keep copy flexible.)
- The product can **run embedded inside Airtable** as an extension (in build) — meet users where they already are.

### 6.2 Tone & design direction (already decided product-side; messaging should match)

The product is deliberately a **professional operations console**: functional over decorative, information-dense, trust signals first (backup status, last run, success/failure always visible), power over simplicity. The audience is technical and accountable. Messaging that reads like a consumer lifestyle product will clash with the product experience. Think: calm, competent, specific, slightly dry humor at most; numbers and receipts over adjectives.

### 6.3 Vocabulary guardrails (canonical naming — used in product, docs, and API)

All copy must use the canonical dictionary; these choices were deliberate:

- **Organization** = the customer/billing entity (not "account", "company", "org" in formal copy).
- **Space** = the container where backup config lives — chosen specifically to avoid colliding with Airtable's own "Workspace" term. **Never say "Workspace"** for our container.
- **Platform** = Airtable (later Notion, etc.). **Connection** = an authenticated link to a platform.
- **Base / Table / Field / Record / Attachment** = Airtable's own terms, mirrored exactly.
- **Backup Run** (an execution) vs. **Backup Snapshot** (the stored result). **Restore** always creates new data.
- **Static backup** (files to a Storage Destination) vs. **Dynamic backup** (into a database) — these are mode names, useful in technical copy; whether they surface in marketing copy is your call, but the *concepts* must not blur.
- **BYOS / BYODB** = bring your own storage / database. **Storage Destination** = where files land.
- Brand: **"Baseout"** in prose (capital B, one word); the logo mark is lowercase **"baseout"**.

### 6.4 The legacy-migration narrative (a launch-critical audience of ~200)

On2Air customers will be moved to Baseout with a guided re-auth flow. The internal draft messaging emphasizes: *static backups work exactly the same — same destinations, same process*; *no more artificial limits*; *a wave of new capabilities awaits when you're ready*. Pricing commitments for this cohort are part of the pricing engagement — coordinate the two workstreams so the migration email says one coherent thing. The rebrand announcement is also a community moment (ecosystem podcasts, forums) — "On2Air grew up" is a story, not just a notice.

### 6.5 Claim hygiene (legal/accuracy guardrails)

- **Never claim SOC 2 certified** until it is; "SOC 2 in progress" is the approved formulation.
- **Scope the privacy claim** ("never stores your data") to static/BYOS mode explicitly.
- **Restore, retention, instant backup, the SQL layer, and all intelligence features beyond schema browsing are still in build** at time of writing — launch copy must track the shipped list (§3 status flags) or clearly mark "coming soon."
- **V2 items (MCP/RAG, governance, connectors, multi-platform) are vision-tier only** — roadmap slides yes, feature pages no.
- Verify every "only vendor that…" claim against the current market before print.

### 6.6 Analytics & attribution already planned

PostHog (product analytics, funnels, session replay) and dub.co (referral/affiliate tracking, migrating from Rewardful — existing affiliate links must keep working) are the planned stack, so campaign measurement and a referral program have plumbing on the roadmap.

---

## 7. What We're Asking You to Determine

1. **ICP** — which segment(s) from §5 lead; firmographic + role definition; the wedge vs. the expansion audiences.
2. **Positioning** — category framing ("Airtable backup" vs. "Airtable data platform" vs. something else), and the primary job (§2) the brand leads with.
3. **Messaging hierarchy** — headline value prop, supporting pillars, proof points; how the static-privacy and dynamic-SQL stories coexist without collision (§4.2).
4. **Feature → benefit packaging** — turn §3 into benefit-led marketing architecture (site sections, one-liners per capability).
5. **Launch narrative** — the rebrand/relaunch story arc: legacy-customer communication, community announcement, new-customer campaign, Marketplace listing copy.
6. **Objection handling** — especially "Airtable already has snapshots" and "we have a script for that."
7. **Channel hypotheses to test** — from §5.5 plus your own; role of consultants as a channel.

**Constraints to work within:** claim hygiene per §6.5; canonical vocabulary per §6.3; pricing/tiers unavailable until the pricing engagement lands; SOC 2 timing gates enterprise-facing campaigns.

---

## 8. Materials Available on Request

- On2Air customer roster and usage data (plans, tenure, estate sizes) — best empirical ICP input we have.
- Full product spec set: PRD (vision, personas, UX direction), Features spec (capability matrices, naming dictionary), implementation plan.
- Brand assets and guidelines (`brand/` directory), including the existing marketing-site draft.
- Access to the working product (dev environment) for first-hand experience of the shipped surface.
- The parallel pricing-engagement inputs pack (`overview/pricing/`) — shares the segment and cost analyses; coordinate ICP and pricing assumptions.
