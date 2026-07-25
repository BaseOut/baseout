# Pricing Workshop 1 — Customer Segments

**Prepared for:** Pricing consultant engagement, Workshop 1 of 4 (customer segments)
**Prepared:** July 13, 2026
**Sources:** State of Airtable DevOps desk research (`research/customers/research-notes.md`), report draft, PRD §1.3–1.5, On2Air Backups customer base (~330 active subscriptions — corrected 2026-07-25 from "~200"; see `research/pricing/legacy-subscription-analysis.md`), survey instruments (designed; survey not yet live — launching in the coming months).

> **Evidence status:** Desk research findings below are verified (sources in `research-notes.md`). The State of Airtable DevOps *survey* is **not yet live — it launches in the coming months** (corrected 2026-07-24; earlier drafts said "in field") — where a claim depends on survey data it is marked **[SURVEY-PENDING]**. Real-customer examples should be pulled from the On2Air billing list now, and from the survey's interview opt-in (question G3) once the survey runs; suggested selection criteria are given per segment.

> **Positioning note (owner decision, July 2026):** Data *recovery* is deliberately **not** the lead value proposition. Airtable's API limits mean no third party can restore a base fully — automations and interfaces aren't exportable via the API, and third-party restores don't preserve record IDs — so a recovery-led pitch over-claims. The problems below are framed accordingly, around the two things Baseout genuinely does best: **(1) external backups as a best-practice / governance need** (the external copy Airtable itself tells customers to keep), and **(2) schema intelligence and data browsing/reporting as the real, daily pain of administering Airtable.** Check all pricing and packaging language against this framing.

---

## The four customer profiles, ranked by relevance

| Rank | Segment | One-liner | Revenue role |
|---|---|---|---|
| 1 | **The Internal Airtable Admin** ("the Airtable person") | Ops/RevOps/admin at a 10–200 person company whose business-critical operations run on Airtable | Core ICP — volume + mission-critical urgency |
| 2 | **The Airtable Consultant / Agency** | Builds and maintains Airtable systems for many clients; their practice standard propagates to every client | Multiplier — one subscription per client Organization, referral engine, resell potential |
| 3 | **The Compliance-Driven Mid-Market / Enterprise Team** | IT, engineering, or data lead who must pass security reviews and needs data outside Airtable (SQL/BI/governance) | Highest ACV — Business/Enterprise/BYODB tiers |
| 4 | **The Solo Operator / Micro-Business** | Founder or freelancer running their whole business on one or a few bases | Long tail — price-sensitive, low-touch, Starter/Bridge tiers |

**Why this ranking.** Segment 1 is the PRD's primary persona and the largest population with both the pain and a budget owner close to the pain. Segment 2 is smaller in headcount but each consultant represents many end-client Organizations — each a separate subscription — and the ecosystem's highest-leverage word-of-mouth channel — our research explicitly identifies consultants as the population whose practices propagate across the ecosystem. Segment 3 has the highest willingness to pay and the strongest external forcing function (security reviews, client contracts, compliance), but is a smaller, slower, sales-led motion. Segment 4 is high-volume/low-ACV; it matters for funnel and community presence but should not drive pricing architecture.

These segments map cleanly onto the survey's role question (B1), so the merged survey dataset will quantify segment sizes and willingness-to-pay bands per segment when it closes. **[SURVEY-PENDING: B1 distribution × F2/F3 budget bands]**

---

## Segment 1 — The Internal Airtable Admin ("the Airtable person")

### 1. Who are they?

- **Business/consumer:** Business (B2B). The individual is an employee; the buyer is their company.
- **Role:** Operations / RevOps / BizOps manager, office manager, or an informally-appointed "Airtable person." Usually **not** formal IT — Gartner projects that by 2026, 80%+ of low-code users sit outside formal IT, and that is exactly this person. Technically capable (comfortable with OAuth, formulas, automations) but not an engineer.
- **Org size:** ~10–200 employees; sweet spot 11–50. Airtable plan: Team or Business.
- **Industry:** Horizontal — agencies, e-commerce/inventory, media & content production, nonprofits, professional services, real estate, education. What they share is not an industry but a shape: operations too complex for spreadsheets, too small or too fast-moving for enterprise software.
- **Location:** Predominantly US/UK/EU/AU, English-speaking, remote-friendly companies (mirrors Airtable's install base).
- **Budget:** Holds or can easily obtain a tool budget in the $25–200/mo band; purchases go on a company card without procurement.
- **Communication preferences:** Email first; in-app messages; help-doc self-serve. Active in the Airtable Community forum, BuiltOnAir podcast/community, Reddit r/Airtable, and **LinkedIn** (where their job title and "Airtable" skill make them findable). Not reachable by cold calls; face-to-face irrelevant. Webinars and practical content (templates, checklists) perform well.
- **Real examples:** The core of the ~330 On2Air Backups subscriptions. *Action before workshop: pull 3–5 named accounts from the On2Air billing list matching "Team/Business plan, 4–25 bases, ops-title contact" and any survey G3 interview volunteers in this role.*

### 2. What is their problem?

- **Time:** The daily **archaeology tax**: figuring out how a base works, what a field is for, what depends on what, and why something broke. Airtable has no schema changelog visible to builders — "what changed, when, and who changed it" has no native answer below Enterprise Scale — and documentation, where it exists at all, is hand-maintained and stale. Reporting is manual too: getting data in front of leadership means repeated per-view CSV exports or brittle Zapier syncs. **[SURVEY-PENDING: D6 archaeology hours]**
- **Expertise:** They know they *should* keep an external copy — Airtable's own security docs tell customers to — but DIY paths quietly fail: attachment URLs expire in ~2 hours, API monthly caps throttle exports on Team plans, CSV loses linked records and comments. They lack the engineering time to build and maintain reliable scripts, so the best practice stays unmet.
- **Cost:** Silent breakage — a renamed or deleted field breaks formulas, automations, Zaps, and interfaces with no trail to diagnose from. Plus a governance gap: the company's operational memory (CRM, orders, projects, inventory) lives in one SaaS with plan-gated retention and no external, governed copy — contrary to the platform's own guidance.

### 3. How serious is their problem?

**Two pains at different points on the spectrum.** The schema/visibility pain is **chronic and felt daily** — hours a week of archaeology, silent breakage, stale docs — and it compounds with every base, automation, and (increasingly) every AI agent writing into bases. The backup gap is **latent**: an unmet best practice rather than a felt emergency, which turns acute the moment leadership, a client, a security review, or a near-miss scare asks "where is our external copy?" **Pricing implication:** the daily schema/data pain is what earns habitual use and justifies the subscription month after month; the best-practice backup requirement is what makes the purchase defensible to whoever approves the spend. Package for both jobs — an admin console they live in, not disaster insurance they hope to never use.

### 4. How do they currently solve their problem?

- Majority rely on **Airtable's built-in snapshots and revision history only** — which cannot leave the platform, restore whole-base-only into a new base, and satisfy no external-copy requirement. **[SURVEY-PENDING: C1 distribution]**
- Minority do manual CSV exports (per-view, lossy, unscheduled) or Zapier/Make syncs to Sheets.
- Schema knowledge lives "in my head"; risky changes are tested "carefully, in the live base."
- Competitor tools they might find: ProBackup (~$25–88/mo), AirBackups (per-base flat). Category awareness is low — most don't know third-party Airtable backup exists.

### 5. What repeat potential is there?

- **High retention:** backup is a subscribe-and-forget utility; churn is low once configured (On2Air's multi-year customer tenures bear this out). Data volume — and therefore plan tier — grows with the business.
- **Expansion path:** static backup → dynamic (SQL layer) → schema intelligence → more Spaces/bases as the org's Airtable footprint grows. Credit/overage model monetizes growing usage without a sales touch.
- **Negative churn risk is low** but note: the product's value is insurance-shaped; visible value moments (backup-run reports, restore drills, change alerts) are what sustain renewal.

### 6. What key benefits/value does Baseout bring them?

- **Schema visibility they've never had:** changelog ("Field X was deleted March 12"), dependency alerts, visual diagrams, health scores, auto-maintained documentation — the category's one dedicated tool (On2Air Schemas) shut down, leaving this vacant. This is the daily-use surface that makes Baseout an admin console rather than an insurance policy.
- **Browse, query, and report on their own data:** a live, queryable copy of their Airtable data means leadership questions and reporting get answered without per-view CSV gymnastics or brittle sync chains.
- **Backups as fulfilled best practice:** scheduled external copies to storage *they* control (Google Drive, Dropbox, Box, OneDrive — the only tool with OneDrive), satisfying Airtable's own keep-your-own-copy recommendation and any leadership/client ask — with per-run audit reports as standing proof the practice is followed.
- **Privacy posture that's easy to say yes to:** on static plans, record data streams through memory and is never stored on Baseout servers.

### 7. Best way to reach them (sales channel)

- **Self-serve, product-led:** SEO on admin-intent queries ("Airtable schema documentation", "Airtable changelog", "Airtable backup best practices", "report on Airtable data"), free schema-visualization hook (PRD: available pre-registration), 7-day trial with one real backup run.
- **The State of Airtable DevOps report** is the designed top-of-funnel for exactly this person: benchmark → maturity self-diagnosis → uplift checklist → tool.
- Airtable Community forum + BuiltOnAir presence, template/checklist content, email nurture from the mailing list.
- **LinkedIn:** this persona is findable by title ("Airtable" in profiles, ops/RevOps titles at 11–200 person companies) — useful both for organic content (best-practice posts, report findings) and targeted outreach/ads around the report launch.
- No sales team required; support-assisted conversion at most.

---

## Segment 2 — The Airtable Consultant / Agency

### 1. Who are they?

- **Business/consumer:** Business — micro-businesses themselves (solo consultants to ~15-person agencies), buying on behalf of or reselling to their client roster.
- **Role/industry:** Professional Airtable builders — Airtable Services Partner Program members (dozens of accredited partners incl. 40+ Gold, plus a longer tail of independents), and unaccredited freelancers on Upwork/communities. Each manages 5–50+ client bases across many workspaces and plans.
- **Location:** Global, concentrated US/UK/EU; fully remote.
- **Budget:** Two modes — (a) tool cost absorbed as practice overhead, (b) **billed through or resold to clients** ("depends entirely on client billing" is a survey answer option for exactly this reason). Per-client economics matter more than absolute price.
- **Communication preferences:** Deeply community-native: BuiltOnAir, Airtable Community forum, TableForums, each other. Partnerships and podcasts beat ads. Email fine; they'll take a video call if there's partner upside. Publicly visible practitioners (e.g. ScottWorld's oft-repeated "snapshot before & after every important change" advice) are the archetype.
- **Real examples:** On2Air's customer list contains multi-workspace accounts that are almost certainly consultants; the survey's B1 "consultant/agency" respondents + G3 interview volunteers will name them. The State of Airtable DevOps survey is co-sponsored with **BuiltOnAir** — that channel is already warm.

### 2. What is their problem?

- **Time:** Manual safety and documentation work multiplied by every client: snapshot-before-and-after every risky change, duplicate-base staging, hand-maintained schema docs and diagrams per client that rot the week after they're written. One consultant's summary of tracking which automations use each field: "the bit that's much harder to deal with." Understanding what changed in a client's base since their last engagement is pure archaeology.
- **Expertise:** They *have* the expertise — the problem is it doesn't scale. Their documentation and protection practice is artisanal, per-client, and largely unbillable.
- **Cost:** Reputation risk. A consultancy guide opens with: *"Every Airtable consultant has had the uncomfortable conversation… someone deleted something important… 'Can we restore it?' … If they're unlucky… the answer is no."* Ecosystem-wide, that answer often **is** no — which is exactly why the sellable practice is *prevention*: external backups in place, schema documented, changes tracked, so the uncomfortable conversation never happens. Meanwhile client security reviews increasingly ask "how is this backed up?" and a manual answer looks bad.

### 3. How serious is their problem?

**Serious and professional-reputation-shaped, trending toward table stakes.** Not business-survival day-to-day, but a single unrecoverable client incident can end a client relationship or become a liability question. The Salesforce precedent is explicit: backup/change-management became standard consultant practice there, and our own report tells consultants "your maturity is a product you can sell… table stakes in this ecosystem within a few years." Early movers gain a differentiator; laggards will inherit the requirement.

### 4. How do they currently solve their problem?

- Defensive manual practice: manual snapshots around changes, duplicate-base testing, per-client CSV exports, hand-rolled daily API scripts that log schema to tracking tables and diff them.
- Some resell/deploy On2Air or ProBackup per client today; many stitch Make/Zapier syncs.
- Documentation via Whimsical/Notion, maintained by hand, perpetually stale.

### 5. What repeat potential is there?

- **The highest in the model — and it compounds as subscriptions, not seats.** Each client requires its **own Organization** (the top-level billing entity, holding that client's Spaces), so every new client the consultant onboards is a *new subscription* at whatever tier fits that client. One consultant with 15 clients is 15 Organizations of recurring revenue, not one expanding account. The consultant user simply belongs to all of them (the data model supports users across multiple Organizations).
- **Resell/white-label potential:** per-client Organizations make pass-through billing natural — "every client base backed up externally, schema documented, changes tracked" as a productized service line they charge for, with each client org invoiced separately (to the consultant or directly to the client). Baseout becomes embedded infrastructure in their offer.
- **Referral engine:** consultants are the ecosystem's trusted advisors; one convinced consultant seeds dozens of Segment-1 companies. Their churn also multiplies — losing one consultant can lose every client org they manage — so partner-grade support matters.

### 6. What key benefits/value does Baseout bring them?

- **One login across all clients:** the consultant belongs to every client Organization and switches between them — per-client backup configs, clean per-client billing separation, and audit reports they can forward to clients as proof of duty of care.
- **A billable deliverable:** auto-generated schema docs, diagrams, health scores, and change logs turn invisible hygiene into client-visible artifacts.
- **Change alerts across the portfolio:** know a client broke something before the client does — a "hero moment" machine.
- **Client-safe data posture:** static-plan streaming (no data at rest on Baseout) simplifies their own data-processing story with clients.

### 7. Best way to reach them (sales channel)

- **Partner/community motion:** BuiltOnAir co-marketing (already in motion via the survey), Airtable Services Partner directory outreach, podcast appearances, community show-and-tell.
- **A formal partner/reseller program** — margin or per-client pricing, partner badge, co-branded client reports. This is a workshop question: consultant-specific pricing (per-client packs? agency tier?) deserves its own discussion.
- Direct, personal outreach works here (small, identifiable population); this is the one segment where 1:1 relationship-building scales. **LinkedIn makes the population enumerable** — consultants advertise "Airtable consultant/partner" in their headline, so building the outreach list is straightforward.

---

## Segment 3 — The Compliance-Driven Mid-Market / Enterprise Team

### 1. Who are they?

- **Business/consumer:** Business — 200–1,000+ employees, or smaller companies selling into regulated/enterprise markets.
- **Role:** IT manager, data/analytics engineer, security/compliance owner, or a platform team that inherited Airtable after the business adopted it bottom-up. The economic buyer holds a real software budget; procurement and security review are part of the purchase.
- **Industry:** Anywhere Airtable reached the enterprise (80% of the Fortune 100 touch it) — media, healthcare-adjacent ops, financial services ops, agencies serving regulated clients, SaaS companies using Airtable as internal ops backbone.
- **Budget:** $300–1,000+/mo is unremarkable; they compare against enterprise SaaS-backup pricing (Own Company sold to Salesforce for $1.9B serving this exact need) and against $249+/mo sync tools.
- **Communication preferences:** Email + scheduled video calls; they expect security documentation (SOC 2 status, DPA, architecture docs), a sales contact, and references. Face-to-face/webinar acceptable; no community-forum buying behavior.
- **Real examples:** Identify from On2Air list by domain (Enterprise-plan Airtable orgs) and from survey C6 "formal requirement" respondents. **[SURVEY-PENDING: C6 formal-requirement share + B2 201+ orgs]**

### 2. What is their problem?

- **Time/expertise:** They must answer auditors, clients, and security reviews: "how is this data backed up, what's your RTO/RPO, where does it live?" Airtable gives them nothing to say — no customer-facing RTO/RPO commitment, audit logs only on Enterprise Scale (180 days, no record-level changes), snapshots that can't leave the platform. Getting Airtable data into their warehouse/BI stack got harder when Sequin shut down (Oct 2025, all customer data deleted at closure); remaining options start at $249/mo or sales-led.
- **Cost:** Failing a security review blocks revenue (their client contracts); a compliance gap is a finding; engineering time to hand-roll ELT + backup + audit for a "no-code" tool erases the tool's ROI.
- **The AI accelerant:** Airtable's MCP server, Omni, and Field Agents create new low-friction write paths into production bases that existing audit tooling doesn't see — governance anxiety is rising, not falling.

### 3. How serious is their problem?

**The most externally-forced of the four — up to deal-blocking.** Not "the business dies tomorrow," but a formal requirement (client contract, security review, insurance, compliance) has a deadline and an owner. When present, it converts "nice to have" into "must purchase this quarter." Where no formal requirement exists yet, seriousness is moderate but ratcheting — every enterprise Airtable expansion and every AI-agent write path raises it.

### 4. How do they currently solve their problem?

- Engineering-built API export scripts (fighting 5 rps limits, pagination, expiring attachment URLs) feeding S3/warehouse; often half-maintained.
- ELT tools (Fivetran/Airbyte) for the data-access half — expensive or self-hosted, and covering analytics, not recovery.
- Enterprise Scale audit logs + retention policies for the governance half — partial by design.
- Some simply accept the risk and document it — an open audit finding waiting for budget.

### 5. What repeat potential is there?

- **Highest ACV, stickiest deployments.** BYODB/dedicated-database plans embed Baseout into their data infrastructure; switching cost is high.
- Expansion: more bases/workspaces under governance, seats, retention add-ons, credit volume, eventually multi-platform (V2) as the same team asks "what about our Notion/HubSpot?"
- Multi-year contracts and annual prepay are natural here.

### 6. What key benefits/value does Baseout bring them?

- **A defensible answer for auditors:** scheduled external backups with per-run audit reports, documented retention, and customer-controlled storage (own bucket/drive) or **BYODB** — data never leaving their environment, unique in the market. Backup here is a governance artifact, not a recovery promise.
- **SQL access to their own data** — continuously synced Postgres, filling the post-Sequin gap below/beside $249+ sales-led tools; BI and internal apps get a real database instead of API duct tape.
- **Change intelligence as governance:** schema changelog, dependency alerts, and data-change history provide the record-level audit trail Airtable doesn't, including changes made by AI agents.
- **SOC 2 (in progress) + encryption architecture** to pass their vendor review.

### 7. Best way to reach them (sales channel)

- **Sales-assisted:** demo call, security-documentation pack, pilot on one workspace → org rollout. Pricing page needs a credible Enterprise "talk to us" lane.
- **Inbound via the compliance question itself:** content targeting "Airtable SOC 2 backup requirements," "Airtable data retention policy," "Airtable governance" — low-volume, extremely high-intent queries.
- **LinkedIn is the primary social channel for this buyer:** IT/data/compliance titles are precisely targetable; thought-leadership posts on Airtable governance and the annual report land here, and outbound to named accounts (Enterprise-plan Airtable orgs) is acceptable practice in this segment.
- The DevOps report's governance chapter + annual benchmark builds the category credibility this buyer needs to shortlist a small vendor.
- Consultant referrals (Segment 2) frequently open these doors — another reason the partner motion matters.

---

## Segment 4 — The Solo Operator / Micro-Business

### 1. Who are they?

- **Business/consumer:** Prosumer — solo founders, freelancers, creators, tiny nonprofits (1–10 people) whose entire operation runs in a handful of bases.
- **Industry:** Creators/content, e-commerce side businesses, coaching, community management, event production, small nonprofits.
- **Location:** Global, more price-diverse markets than the other segments.
- **Budget:** $0–29/mo tolerance; every subscription is scrutinized. Often on Airtable Free/Team where native protection is weakest (2-week snapshot retention on Free, 1,000 API calls/month).
- **Communication preferences:** Fully self-serve; YouTube tutorials, Reddit, templates, community threads. Will never take a call. In-product guidance and docs carry the whole relationship.
- **Real examples:** On2Air's legacy Basic/$9.99 customers (the On2Air Bridge plan exists precisely for them).

### 2. What is their problem?

- **Time:** None to spare — they are the business. Manual CSV exports get skipped; there is no "IT" to notice.
- **Expertise:** Lowest of the four segments; API scripts are out of reach; they often don't know snapshots can't be exported or that trash is 7 days.
- **Cost:** Ironically the highest *relative* exposure: the base **is** the business (client list, orders, content pipeline), and they sit on the plans with the shortest native retention. One bad automation or accidental delete is existential — but the perceived probability is low, so willingness to pay stays low until it happens.

### 3. How serious is their problem?

**Objectively can be business-survival; subjectively "nice to have."** This is the segment where the gap between criticality and preparedness is widest and least funded. Conversion is almost always incident- or scare-triggered.

### 4. How do they currently solve their problem?

- Mostly nothing, or trust in Airtable's built-ins; occasional manual CSV; a Zapier free-tier sync to Google Sheets if they're savvy.
- Free tools (Export My Base) for one-shot exports.

### 5. What repeat potential is there?

- **Modest per-account, real in aggregate.** Low ACV, but very sticky once configured (set-and-forget), near-zero service cost, and a graduation path: solo operators become Segment 1 admins or Segment 2 consultants as they grow. Also the community mass that makes the category feel real.

### 6. What key benefits/value does Baseout bring them?

- **The best practice, done for them:** scheduled backups to the Google Drive/Dropbox they already pay for — their data in readable files they own, no API mechanics required — at a price under their scrutiny threshold (Starter $29 / Bridge $9.99 — unlisted, deliberately).
- **A picture of their own base:** the free schema visualization and health score give them an understanding of their setup they've never had — value before any payment.

### 7. Best way to reach them (sales channel)

- **Pure self-serve, zero-touch:** SEO + YouTube ("how to back up Airtable"), templates, Reddit/community answers, the free schema tool as the hook.
- Deliberately **not** featured on the pricing page (per the Features spec, Starter/Bridge are discoverable, not marketed) — serve them without letting their price points anchor the main segments.
- Product-led upgrade prompts as their record counts and base counts grow.

---

## Summary matrix (for the workshop wall)

| | 1 · Internal Admin | 2 · Consultant/Agency | 3 · Compliance/Mid-Market+ | 4 · Solo Operator |
|---|---|---|---|---|
| **Problem framing** | Daily schema archaeology + reporting friction; backup best practice unmet | Unscalable per-client documentation & safety work; reputation risk | External requirement: audits, security reviews, SQL/BI access | No time, no expertise, best practice out of reach |
| **Seriousness** | Chronic daily (schema/reporting); backup gap latent until asked | Serious; reputation/table-stakes trajectory | Deal-/audit-blocking when requirement exists | Real exposure, "nice to have" in perception |
| **Current solution** | Open the base and look; native snapshots only; CSV/Zapier for reporting | Manual snapshots, duplicate-base staging, hand-maintained docs, hand-rolled scripts | Engineering scripts, ELT tools, accepted risk | Nothing / trust in built-ins |
| **Repeat potential** | High retention, tier growth with data volume | Highest — one new subscription (client Org) per new client; resell | Highest ACV; BYODB lock-in; multi-year | Modest; sticky; graduation path |
| **Core value** | Schema visibility + data browsing/reporting + best-practice backups | Portfolio-wide docs/changelogs as billable deliverables + change alerts | Audit-ready posture, BYOS/BYODB, SQL layer, AI-era change intel | Best practice done for them, set-and-forget |
| **Channel** | PLG: SEO, report, community, LinkedIn, trial | Partner program, BuiltOnAir, LinkedIn list-building, 1:1 relationships | Sales-assisted inbound; security-doc pack; LinkedIn outbound; consultant referrals | Zero-touch self-serve; hidden tiers |
| **Likely tier fit** | Launch $49 / Growth $99 | Per client Org — many at Launch $49/Growth $99, tier set by each client's size | Business $399 / Enterprise | Starter $29 / Bridge $9.99 (unlisted) |
| **WTP evidence** | [SURVEY-PENDING F2/F3] | [SURVEY-PENDING F3 "client billing" share] | [SURVEY-PENDING C6 × F3] | [SURVEY-PENDING] |

---

## Open items to resolve before/during the workshop

1. **Attach real names.** Pull 3–5 example accounts per segment from the On2Air billing list (segment by plan, base count, contact title/domain) and schedule 20-min interviews with survey G3 volunteers.
2. **Survey close-out.** The B1×B6×F2/F3 crosstabs will size each segment and its budget band — the single most valuable pricing input in flight. Decide whether Workshop 1 outputs get revised when the survey closes.
3. **Consultant pricing architecture** (Segment 2): the model is per-Organization billing, and each client requires its own Organization — so the open question is not "agency tier vs. per-client" (per-client is structural) but rather: does a consultant managing N client Orgs get cross-Org volume pricing, partner/reseller margin, or a consolidated invoice? Who is the bill-to per client Org — consultant or client? Flag for Workshop 2+.
4. **Positioning guardrail for all pricing/packaging language:** recovery is not the promise — no third party can fully restore an Airtable base (automations/interfaces aren't API-exportable; third-party restores don't preserve record IDs). The value story is proactive: best-practice external backups (governance artifact) + the schema/data intelligence layer admins use daily. Review tier names, feature descriptions, and page copy against this.
5. **Grandfathering constraint:** ~330 On2Air subscriptions transition at equivalent pricing for a transition period (at the sunset-triggered migration, not Baseout launch) — a boundary condition on any repricing of the lower tiers.
