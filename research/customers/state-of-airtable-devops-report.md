# The State of Airtable DevOps 2026

**The first benchmark report on how teams protect, manage, and govern their Airtable data.**

*Published by Baseout (formerly On2Air) — draft v0.1, July 2026.*

---

> **DRAFTING NOTES (delete before publication)**
>
> - Every `[SURVEY: …]` placeholder keys to a question ID in the shared core (Sections B–F) of `survey-existing-customers.md` / `survey-mailing-list.md`. Fill from the merged dataset after the response window closes.
> - Every `[RESEARCH: …]` tag cites a numbered finding in `research-notes.md`. Desk-research facts are already written in final prose with sources; the tags are for verification traceability — strip them at publication, keep the inline source attributions.
> - Check `research-notes.md` §5 (do-not-print list) before publishing. Highlights: snapshots DO capture automations/interfaces; "Fortune **100**" not 500; no Airtable IPO claims; hedge all vendor-sourced stats as written.
> - Product guardrails (GTM inputs §6.5): no unreleased pricing or tier names; the About Baseout section must track the shipped feature list at publication time; "SOC 2 in progress" is the only approved compliance formulation.
> - Naming: **Baseout** in prose everywhere (settled); lowercase "baseout" only as the logo mark.
> - Threshold language: sentences like "most teams" / "a minority" are written assuming directional expectations from desk research — rewrite honestly if the data disagrees. The report's credibility is the asset; never bend a number.

---

## Executive summary

Airtable has quietly become production infrastructure. More than 500,000 organizations — including 80% of the Fortune 100 — run on it [RESEARCH: N-9], and the bases that started as a spreadsheet replacement now hold customer records, order pipelines, and the operational logic of entire businesses. Gartner forecast that by 2025, 70% of new enterprise applications would be built on low-code technologies, and that by 2026 at least 80% of low-code users would sit outside formal IT [RESEARCH: A-7]. That is exactly the population this report surveyed: the admins, operators, and consultants who run business-critical Airtable setups without a platform team behind them.

Every mature software ecosystem eventually grows a discipline for this — version control, backups, staging environments, change management. Salesforce got there a decade ago and the practice got a name, Salesforce DevOps; by 2024, 87% of Salesforce teams backed up their orgs or planned to, and backup had become the single most-adopted DevOps process in that ecosystem [RESEARCH: A-2]. Microsoft built application lifecycle management directly into Power Platform "to democratize ALM… for all makers, admins, and developers" [RESEARCH: A-4].

Airtable is at the same inflection point — with no equivalent playbook, no benchmark, and until now, no data. This report is the first attempt to measure the state of **Airtable DevOps**: how teams actually handle backup, recovery, schema change, documentation, and data access on Airtable.

**Headline findings:**

- [SURVEY: B6 — % "mission-critical" + "important"] of respondents say the business would stop or be majorly disrupted if their Airtable data were lost.
- [SURVEY: C2 — % any "yes"] have already lost or corrupted Airtable data at least once; [SURVEY: C2 — % "couldn't fully recover"] never got it all back.
- [SURVEY: C1 — % "built-in only" + "don't back up" + "not sure"] rely entirely on Airtable's native snapshots and revision history — or nothing at all.
- [SURVEY: C5 — % "never tested" (both "no" options)] have never tested a restore. In the wider industry, Veeam's 2021 Data Protection Trends research (n=3,000) found 58% of backups fail on backup or restore [RESEARCH: A-6] — an untested backup is a hope, not a plan.
- [SURVEY: D1 — % "in my head" + "we don't"] track their base structure in someone's head or not at all, and [SURVEY: D3 — % "basically impossible"] say answering "what changed, when, and who changed it" is basically impossible.
- [SURVEY: MATURITY — % in Ad hoc + Aware stages] of teams sit in the bottom two stages of the Airtable DevOps maturity model introduced in this report.

The gap between how critical the data is and how it's protected is the story of this report — and closing it is a practice, not a product. The final chapter gives a concrete uplift path for each maturity stage.

---

## 1. Why "Airtable DevOps" is a thing now

### 1.1 Citizen-built apps became production systems

Low-code adoption stopped being an experiment years ago. Gartner's forecasts — 70% of new enterprise apps on low-code/no-code by 2025 (up from under 25% in 2020), a $26.9B low-code market in 2023 growing ~20% a year, and non-IT builders making up 80% of low-code users by 2026 [RESEARCH: A-7] — describe a world where the people building business-critical software are not the people who traditionally carried pagers for it.

Airtable is a flagship case. Its own numbers claim more than 500,000 organizations and 80% of the Fortune 100 [RESEARCH: N-9]. And the platform itself is moving faster than ever: an "AI-native" refounding in June 2025, the Omni agentic builder, ChatGPT integration in December 2025, and the Superagent launch in January 2026 [RESEARCH: N-9]. And the write paths are multiplying: Omni edits schema and data conversationally, Field Agents run continuously inside bases, and Airtable's official MCP server lets external AI assistants act with the authenticated user's full permissions [RESEARCH: N-16]. AI agents building and modifying bases raises the stakes on the question this report keeps returning to: *who is keeping track of what changed, and what happens when something breaks?*

### 1.2 Every platform that matures grows this discipline

The pattern has repeated across ecosystems [RESEARCH: A-1, A-3, A-4]:

- **Salesforce.** The "Salesforce DevOps" category emerged in the mid-2010s and industrialized: annual benchmark reports since 2021, 86% of teams on or moving to version control, 81% on CI/CD, backup the most-adopted single practice [RESEARCH: A-2]. The economics followed the practice: Own Company (formerly OwnBackup), the ecosystem's backup vendor, was acquired by Salesforce itself for ~$1.9B in cash in 2024 — Salesforce's largest acquisition since Slack [RESEARCH: A-3].
- **Power Platform.** Microsoft didn't wait for a third-party ecosystem: it shipped first-party ALM — environments, source-controlled solutions, and pipelines built explicitly to "democratize ALM" for makers [RESEARCH: A-4] — as its platform crossed 50M+ monthly active users.
- **The broader DevOps movement** gave the discipline its measurement vocabulary: DORA's four keys (deployment frequency, lead time, change failure rate, recovery time) and its Low/Medium/High/Elite performance segmentation, built on 32,000+ survey responses over a decade [RESEARCH: A-5]. Copado's 2021 research showed the framework transfers to SaaS platforms: elite Salesforce teams deployed 46× more frequently and recovered 37× faster than low performers [RESEARCH: A-2].

Airtable has the adoption curve, the criticality, and the breakage stories. What it doesn't yet have is the discipline, the tooling depth, or the benchmark. Hence this report.

### 1.3 The shared-responsibility fine print

A fact many teams discover only during an incident: **Airtable itself recommends you keep your own backups.** Its security documentation states that while Airtable's production data is backed up internally, customers should maintain their own copies "by exporting individual tables as CSV files" or "retrieving your data via the Airtable API" [RESEARCH: N-8]. That is the SaaS shared-responsibility model in plain terms — the vendor owns uptime; you own your data's recoverability [RESEARCH: T-16].

The survey measures how many teams have actually internalized that: [SURVEY: C6 — % "formal requirement" vs "informal" vs "no"] report an external requirement (client contract, security review, compliance, leadership) that their Airtable data be backed up.

---

## 2. Who we heard from & how to read this report

*(Methodology first, per the standard set by DORA, Gearset, and every credible "State of X" report [RESEARCH: A-5]. Disclose the sample skew the way Gearset discloses its own-customer share each year [RESEARCH: A-1].)*

The survey ran [SURVEY: fieldwork dates] across two channels: customers of On2Air Backups (the product Baseout succeeds) and the broader On2Air/Baseout mailing list of Airtable builders and operators. **n = [SURVEY: total merged N]** after screening out non-Airtable-users; [SURVEY: % audience=customer] were existing backup customers.

**Read the numbers with that skew in mind.** A list reached through a backup vendor over-represents people who already think about data protection. If anything, the true state of the wider Airtable market is *less* mature than reported here — the gaps in this report are a floor, not a ceiling.

**Who answered:**

- **Roles** [SURVEY: B1 distribution]: consultants/agencies serving multiple clients, internal Airtable admins, ops/RevOps, IT/engineering, founders.
- **Org sizes** [SURVEY: B2 distribution].
- **Plans** [SURVEY: B3 distribution] — note the share on Free/Team plans, where native retention windows are shortest (§3.1).
- **Scale** [SURVEY: B4 distribution] bases under active maintenance; largest-base record counts [SURVEY: B5 distribution].
- **Criticality** [SURVEY: B6 distribution]; what runs on the most important bases [SURVEY: B7 top categories].

Percentages throughout are of the merged dataset unless labeled otherwise. Customer-only questions (the On2Air experience section) are labeled as the customer subsample. Where we cite third-party research, the sponsor is named — much of the industry's backup data comes from vendors who sell the remedy, and we flag that every time, including our own interest: Baseout builds Airtable backup and data-intelligence tooling. The survey questions, answer options, and scoring rubric are reproduced in the appendix so anyone can audit or replicate the method.

---

## 3. The four pillars — and what Airtable gives you out of the box

We assess Airtable DevOps across four pillars: **(1) backup & recovery, (2) restore readiness, (3) schema & change management, (4) data access & intelligence.** For each pillar this chapter pairs the survey benchmark with a precise account of what Airtable natively provides — because the most common failure mode we see is not carelessness, it's a mistaken belief that the platform's built-ins already cover you.

### 3.1 Pillar 1 — Backup & recovery

**What Airtable provides.** Native protection is real but bounded, and every bound is plan-gated [RESEARCH: N-1, N-2, N-3]:

| Native mechanism | What it does | The bounds |
|---|---|---|
| **Base snapshots** | Point-in-time copies, automatic (cadence is **activity-based, not scheduled** — a busy base snapshots ~daily; an idle one can go weeks) + manual; capture tables, records, views, automations, interfaces, extensions, comments | Retention: 2 weeks (Free), 1 yr (Team), 2 yrs (Business), 3 yrs (Enterprise Scale, extendable to 10). Restore is **whole-base only**, always into a **new base with a new base ID and new share links** (record IDs survive a native restore) — every external integration that references the base breaks and must be rewired [RESEARCH: T-12, N-1]. Restored bases lose revision history. Snapshots cannot be exported off-platform. |
| **Record revision history** | Per-record edit trail incl. automation/API edits | Same plan-gated retention. Viewable **one record at a time**; no bulk view, no revert — restoring means retyping old values [RESEARCH: N-2]. |
| **Trash** | Deleted-item recovery | **7 days** for tables/fields/records/views/interfaces; 30 days for deleted bases (up to 180 on Enterprise Scale) [RESEARCH: N-3]. |
| **Audit logs** | Admin-level activity trail | **Enterprise Scale only**, 180-day retention, and covers administrative/structural events — **not record-level data changes** [RESEARCH: N-4]. |

Two things make this availability tooling rather than backup. First, everything lives inside the platform — a copy your vendor holds for you satisfies no external-copy requirement, a point the community made as early as 2019 in the canonical thread titled *"Airtable Backup & Recovery Strategies: Simply, a Nightmare"* [RESEARCH: T-11]. Second, the recovery paths are coarse: after the 7-day trash window a deleted table is gone unless a snapshot covers it, and using that snapshot means resurrecting the *entire base* as a disconnected copy and hand-carrying data back [RESEARCH: N-1, T-6].

**What teams actually do.** [SURVEY: C1 distribution — full breakdown: built-in only / third-party tool / custom scripts / manual CSV / Zapier-Make sync / nothing / not sure]. For comparison: in the Salesforce ecosystem, 87% of teams backed up or planned to by 2024 [RESEARCH: A-2].

The DIY paths deserve a note, because they fail quietly. The API caps at 5 requests/second per base with monthly call ceilings on Free (1,000) and Team (100,000) plans, pages records 100 at a time [RESEARCH: N-7] — and attachment URLs expire roughly two hours after issue, so any export that stores URLs instead of bytes silently loses every file [RESEARCH: N-6]. CSV exports are per-view, one table at a time, and can't represent linked records, formulas, comments, or attachments faithfully [RESEARCH: N-7]. The author of one open-source Airtable backup script describes his own tool as "unreliable backups at best" [RESEARCH: T-1].

**The incidents are not hypothetical.** [SURVEY: C2 — full distribution, headline % any loss + % unrecovered]. Causes reported: [SURVEY: C3 — ranked: accidental deletion / automation-script misbehavior / sync overwrite / offboarding / collaborator change]. That ranking matches both the community record — "HELP! I accidentally erased 140 records… the undo function isn't remedying it" [RESEARCH: T-5]; sync tables where deletions make enriched data "irrecoverably lost" [RESEARCH: T-7]; Airtable's own troubleshooting docs naming self-inflicted automation loops as the usual culprit for vanished records [RESEARCH: T-8] — and the industry-wide pattern: Enterprise Strategy Group research (cited via backup vendor Flosum) attributes 73% of SaaS data loss to internal incidents, not external attack [RESEARCH: A-6]. In Gearset's Salesforce surveys, 47–67% of teams reported a data or metadata loss incident in a given year [RESEARCH: A-2]. Data loss on a mature SaaS platform is routine, not exotic.

**Crosstab that matters:** among respondents whose Airtable data is mission-critical (B6), [SURVEY: crosstab B6="mission-critical" × C1 — % with no external backup] still have no copy of that data outside Airtable.

### 3.2 Pillar 2 — Restore readiness

Backups exist to be restored, and restore is where confidence goes to die. Industry-wide, Veeam's 2021 study found 58% of backups fail at backup or restore time [RESEARCH: A-6]; the DR literature's standard vocabulary — RTO (how fast you must recover) and RPO (how much data you can afford to lose) — exists precisely because "we have backups" and "we can recover" are different claims [RESEARCH: A-6]. On Airtable the vocabulary bites twice: native snapshot cadence is activity-based, so a team relying on snapshots alone has **an RPO it cannot state** [RESEARCH: N-1] — and Airtable publishes **no customer-facing RTO/RPO commitment** for restoring an individual base; its audited resilience covers the platform, not your data [RESEARCH: N-15, N-8]. A backup and a *recoverable base* are not the same thing.

- **Recovery time.** Asked how long it would take to get back to a working state if their most important base disappeared: [SURVEY: C4 distribution — highlight % "a week or more" + "might never fully recover" + "no idea"]. For a mission-critical system, "no idea" is itself the finding.
- **Restore testing.** [SURVEY: C5 — % never tested vs tested once or twice vs regularly]. An untested restore path fails in ways you discover exactly when you can least afford to: the community record includes restores from trash re-firing "new record" *and* "updated record" automations with inconsistent timestamps — the recovery itself triggering new damage [RESEARCH: T-9].
- **External requirements.** [SURVEY: C6 distribution]. Client contracts and security reviews increasingly ask "how is this data backed up?" — a buying trigger the Salesforce ecosystem knows well.
- **Customer subsample:** among existing backup-tool customers, [SURVEY: customer A6 — % who have actually restored, smooth vs painful] have actually exercised a restore. Even with tooling, restore is the under-practiced half of the discipline.

**The maturity multiplier.** Copado's DORA-style segmentation of Salesforce teams found elite performers recovered from failed changes 37× faster than low performers [RESEARCH: A-2]. Recovery speed is the single clearest separator between maturity stages in our model too (§4): [SURVEY: crosstab MATURITY stage × C4 median].

### 3.3 Pillar 3 — Schema & change management

This pillar is Airtable's largest native gap. There is **no schema changelog** — no history of field or table creation, deletion, renames, or type changes visible to builders. The nearest native features: "Manage fields" shows only the *most recent* modifier of a field; Enterprise Scale audit logs capture structural events but are admin-only and expire after 180 days [RESEARCH: N-5, N-4]. The community has been asking for a schema history for years, and third-party services have appeared just to fill it [RESEARCH: N-5]. The one dedicated commercial tool for schema documentation and change tracking (On2Air Schemas) shut down, leaving the category effectively vacant [RESEARCH: T-4] — practitioners now hand-roll daily API scripts that log field lists to tracking tables and diff them [RESEARCH: T-4].

The stakes: a renamed or deleted field silently breaks whatever depended on it — formulas, automations, interfaces, and external integrations. Zapier's own support docs list Airtable field-reference changes as a known Zap-breaker [RESEARCH: T-10]. And automations and interfaces — the logic layer — **cannot be exported through Airtable's public API at all** (verified current through June 2026), so no external tool can fully document or back them up from the API alone; native snapshots capture them, but snapshots can't leave the platform [RESEARCH: N-7, T-2, T-13].

Breakage is also frequently *silent*. For most of Airtable's history a failing automation notified exactly one person — the last one to enable it — and configurable failure recipients shipped only in early 2026; automation run caps are a hard monthly stop, not a throttle [RESEARCH: N-12]. Staging finally has a native answer — **App Sandbox** (GA October 2025, Business/Enterprise Scale only), a schema/automation copy publishable back to production — but its merge is imperfect as of early 2026 and everyone below those tiers still stages by duplicating the base, which does not preserve record IDs [RESEARCH: N-11].

**What the survey found:**

- **Documentation.** [SURVEY: D1 distribution — in someone's head / hand-maintained docs / manual diagrams / auto-generated / we just open the base and look].
- **Breakage.** [SURVEY: D2 — % broken at least once, % more than once] have had a schema change break an automation, integration, formula, or interface.
- **Diagnosis.** When something breaks, "what changed, when, and who changed it" is [SURVEY: D3 distribution — easy / slow and painful / basically impossible]. Compare version-controlled ecosystems: 86% of Salesforce teams have or plan version control [RESEARCH: A-2] — the equivalent Airtable practice barely exists.
- **Testing discipline.** [SURVEY: D4 distribution — duplicate-and-test / carefully in live / change-and-watch / formal dev-staging-prod / rarely change]. Consultants' published best practice is defensive and manual: "create your own snapshot before & after making any important changes" [RESEARCH: T-14].
- **The archaeology tax.** [SURVEY: D6 — % spending hours every week] figuring out how a base works, what a field is for, why something broke.

**Appetite for tooling.** The D5 matrix asked respondents to rate seven schema-intelligence capabilities. Ranked by mean score: [SURVEY: D5 — ranked means for: visual schema diagram / schema changelog / dependency-change alerts / health score / auto-maintained docs / automation-interface backup / data changelog. Flag any row ≥4.0 overall and report the mission-critical (B6) segment separately]. Among respondents with mission-critical data, [SURVEY: D5 × B6 crosstab — highlight rows ≥3.5].

### 3.4 Pillar 4 — Data access & intelligence

Airtable data increasingly needs to live two lives: the operational one inside Airtable, and an analytical one in SQL, BI tools, and — increasingly — AI assistants.

**Native paths out are thin.** There is no native outbound warehouse connector — Airtable's Snowflake sync runs *inbound* only [RESEARCH: T-3]. The API's schema endpoint returns field definitions but not view configurations [RESEARCH: N-7]. CSV is per-view, manual, lossy. The third-party landscape contracted sharply when Sequin — the original "query your Airtable as Postgres" product — shut down in October 2025 after an acquisition, deleting all customer data at closure [RESEARCH: T-3]. What remains starts at $249/month or sales-led pricing, leaving a real gap below the enterprise price point [RESEARCH: T-3].

**What the survey found:**

- [SURVEY: E1 — % constantly + occasionally] need their Airtable data outside Airtable; their current paths: [SURVEY: E2 ranked — CSV / API + code / Zapier-Make / sync tools / native connectors].
- Interest in a continuously-synced SQL copy of their data: [SURVEY: E3 — mean + % 4-5]. Segment: [SURVEY: E3 × B1 — consultants vs IT/eng vs ops].
- **AI on backed-up data** [SURVEY: E4 ranked means — plain-English chat / AI-generated docs / MCP connection to existing assistants / anomaly flagging]. Given the platform's own AI turn (§1.1), the anomaly-detection row is worth watching: AI agents editing bases make "something changed that shouldn't have" detection more valuable, not less.
- **Where backups should live** [SURVEY: E5 distribution — managed / own cloud drive / own bucket / own database / on-prem-only]. [SURVEY: E5 — % selecting any customer-controlled option] want at least the option of customer-controlled storage — the external-copy instinct in action.

---

## 4. The Airtable DevOps Maturity Model

*(The segmentation framework follows DORA's Low/Medium/High/Elite precedent [RESEARCH: A-5] and Microsoft's staged Power Platform adoption model [RESEARCH: A-4], adapted to what protection and change management look like on Airtable. Scoring rubric in Appendix B.)*

One caution the framework demands: on a platform where every edit is live the instant it is saved, decision-to-live lead time *looks* elite by DORA standards — but only because there are no gates to traverse. Fast change on Airtable signals **missing controls at least as often as excellence**, which is why our maturity model scores safety practices, not speed [RESEARCH: A-8].

Each respondent is scored on six ordinal questions — backup method (C1), recovery-time expectation (C4), restore testing (C5), schema documentation (D1), change diagnosis (D3), and change testing (D4) — and lands in one of four stages:

### Stage 1 — Ad hoc
*"The base is the backup."*
No copy of the data exists outside Airtable (or no backup at all). Recovery time is unknown or unbounded. Structure lives in the builder's head; when something breaks, finding what changed is basically impossible; risky changes go straight to the live base.

**[SURVEY: MATURITY — % Stage 1]** of respondents. Their profile: [SURVEY: MATURITY 1 × B1/B2/B6 — typical role, org size, criticality mix].

### Stage 2 — Aware
*"We know, and we've got a spreadsheet somewhere."*
Manual CSV exports or occasional copies; the risk is understood (often after a scare) but the practice is irregular and untested. Some hand-maintained documentation that drifts out of date. Changes tested by being careful.

**[SURVEY: MATURITY — % Stage 2]** of respondents.

### Stage 3 — Managed
*"It's automated, and we've restored at least once."*
Scheduled external backups (third-party tool or maintained scripts), restore exercised at least once, same-day recovery expectation, documentation maintained somewhere other than a memory, duplicate-base testing before risky changes.

**[SURVEY: MATURITY — % Stage 3]** of respondents.

### Stage 4 — Engineered
*"Protection and change management are part of how we build."*
Automated external backups with regularly tested restores; recovery in hours, not weeks; trusted change history; auto-generated or rigorously maintained schema documentation; a dev/staging-style process for risky changes. The Airtable analog of DORA's elite tier.

**[SURVEY: MATURITY — % Stage 4]** of respondents.

### What separates the stages

- **Criticality doesn't predict maturity.** [SURVEY: B6 × MATURITY — report whether teams with mission-critical data are meaningfully more mature; expected finding: barely]. The teams with the most to lose are not systematically the best protected — the report's central tension.
- **Incidents drive maturity more than foresight does.** [SURVEY: C2 × MATURITY — are teams that lost data more mature today?]. The pattern the whole industry shows: the backup budget appears the week after the incident.
- **Consultants vs. internal admins.** [SURVEY: B1 × MATURITY]. Consultants manage many clients' setups and their practices propagate to every one of them — the highest-leverage population for maturing the ecosystem.
- **Recovery expectations.** Median expected recovery time by stage: [SURVEY: MATURITY × C4 medians] — the Airtable expression of Copado's 37× elite-recovery multiplier [RESEARCH: A-2].

---

## 5. Priorities & investment

**What teams want first.** Ranked top-3 priorities for an Airtable data platform: [SURVEY: F1 — % appearing in top 3, full ranking: reliable automated backups / fast easy restore / schema visibility / change alerts / SQL access / automation-interface backup / governance-compliance / AI features]. [SURVEY: F1 — note whether schema items appear in ≥30% of top-3s — the pre-registered validation threshold for the schema-intelligence direction.]

**What they spend today.** [SURVEY: F2 distribution] — expect a large $0 cohort; the honest benchmark of a young category. **What they could justify** for a tool that solved their top three: [SURVEY: F3 distribution, note consultant "depends on client billing" share].

**The gap between the two** [SURVEY: F2 vs F3 delta] is the clearest single measure of unmet demand — spend follows practice, and practice is what this report benchmarks.

In their own words: the most common answers to "what would make this a buy-it-today product?" — [SURVEY: F4 — top themes, 3–5 verbatim quotes with permission]. And the single biggest frustrations with Airtable overall: [SURVEY: F5 — top themes; expect native-limits, pricing, and change-visibility clusters].

---

## 6. Recommendations — the uplift path

*(One stage at a time; each step is doable in an afternoon. Tool-agnostic on purpose: the discipline is the point. The economics of ignoring it are documented above; Gartner put the cost of downtime at $5,600/minute back in 2014 [RESEARCH: A-6].)*

**If you're at Stage 1 (Ad hoc) → get to Aware this week:**
1. Take a manual snapshot of every base that matters, right now, and put a monthly reminder on the calendar. Know your plan's snapshot retention window (2 weeks on Free — shorter than most people's vacation).
2. Export your most critical tables to CSV once, and store them outside Airtable. Imperfect is fine; external is the point — Airtable's own docs tell you to do this [RESEARCH: N-8].
3. Write down, anywhere, what your most important base is for and what connects to it.

**Stage 2 (Aware) → Managed:**
1. Automate the backup: a scheduled tool or a maintained script — anything that runs without a human remembering. If you script it yourself, download attachment *bytes*, not URLs (they expire in ~2 hours [RESEARCH: N-6]), and mind the API caps on lower plans [RESEARCH: N-7].
2. **Test one restore.** Restore a snapshot (it creates a new base — safe by design), and walk through what reconnecting your integrations would actually take. You will learn more in that hour than from any vendor page, ours included.
3. Snapshot before-and-after every risky change — the consultants' standing rule [RESEARCH: T-14].

**Stage 3 (Managed) → Engineered:**
1. Establish real RTO/RPO targets for your most critical base and test against them on a schedule. "We restore quarterly and it takes 40 minutes" is a sentence that passes security reviews.
2. Get schema change visibility: a changelog of structural changes, dependency awareness before renaming or deleting fields, and documentation that regenerates instead of rotting.
3. Capture the logic layer. Automations and interfaces can't be exported via the API [RESEARCH: N-7] — document them deliberately (screenshots, scripts-in-git, structured notes) so the parts you can't re-download are the parts you *can* rebuild.
4. Separate dev from prod: duplicate-base staging as standard practice for restructures, with a checklist for promoting changes.

**For consultants and agencies:** your maturity is a product you can sell. A client-facing backup-and-documentation standard — every client base backed up externally, schema documented, restore tested — is a differentiator today and will be table stakes in this ecosystem within a few years, exactly as it became in the Salesforce world [RESEARCH: A-2, T-14].

---

## 7. Where this goes

Salesforce DevOps went from forum threads to a named discipline with annual benchmarks, dedicated tooling, and a $1.9B acquisition by the platform vendor itself [RESEARCH: A-3]. Power Platform ALM went from community starter kits to first-party product [RESEARCH: A-4]. The arc is always the same: the platform's data becomes too important for the platform's built-ins, practice formalizes, tooling professionalizes, and eventually the discipline gets absorbed into how everyone works.

Airtable is earlier on that arc — this survey found [SURVEY: MATURITY — % in bottom two stages] of teams still in the bottom two maturity stages while [SURVEY: B6 — % mission-critical] run mission-critical data. That gap will close. The teams (and consultants) who close it first get the compounding benefits: faster recovery, safer change, data that's usable everywhere, and the quiet confidence of knowing that the worst Tuesday imaginable is a restore away from being fine.

We intend to run this survey annually and track the ecosystem's maturity the way DORA tracked the industry's [RESEARCH: A-5]. If you want next year's edition — or want to argue with this one — we'd genuinely like to hear from you.

---

## About Baseout

*(Keep to four sentences, claim-hygiene per GTM §6.5 — track shipped status at publication time; no pricing; "SOC 2 in progress" only if mentioned at all.)*

Baseout is the backup, restore, and data intelligence layer for Airtable — the next generation of On2Air Backups, which has protected Airtable data for paying customers for years. It automatically backs up schema, records, and attachments to storage the customer controls (Google Drive, Dropbox, Box, OneDrive) or to Baseout-managed storage, with per-run audit reports. On static backups to customer-owned storage, record data streams through memory and is never stored on Baseout servers. Learn more at [URL].

*This report was produced by Baseout. We sell tooling in the category this report benchmarks; the survey instrument, answer options, and scoring rubric are published in full in the appendices so you can audit our method.*

---

## Appendix A — Survey instrument

*(Reproduce the shared core, Sections B–F, verbatim from the survey files at publication. Customer-only and list-only sections summarized.)*

## Appendix B — Maturity scoring rubric

Each of the six scoring questions maps its ordinal options to 0–3 points:

| Question | 0 points | 1 point | 2 points | 3 points |
|---|---|---|---|---|
| C1 backup method | None / not sure | Built-in only, or manual CSV | Zapier-Make sync, or custom scripts | Third-party backup tool (scheduled, external) |
| C4 recovery time | No idea / might never recover | A week or more | A few days / same day | Under an hour |
| C5 restore testing | No backups to test | Backups, never tested | Tested once or twice | Tested regularly |
| D1 schema tracking | In someone's head / we don't | Hand-maintained docs | Manually updated diagrams | Auto-generated documentation |
| D3 change diagnosis | Basically impossible | — | Possible but slow | Easy, trusted history |
| D4 change testing | Change and watch | Carefully in the live base | Duplicate the base | Formal dev/staging/prod process |

*Scoring notes:* C1 is multi-select — score the highest-scoring selected option; "We don't back up" overrides to 0. D3 "Never needed to" and D4 "N/A — rarely make risky changes" are scored 1 (unknown discipline is not evidence of discipline). Total 0–18 → **Ad hoc 0–4 · Aware 5–9 · Managed 10–14 · Engineered 15–18.** [SURVEY: validate band cutoffs against the actual score distribution before publication — bands should produce interpretable cluster sizes, not force a bell curve.]

## Appendix C — Sources

*(Compile from `research-notes.md` at publication: every desk-research claim above carries a `[RESEARCH: id]` tag that resolves to a sourced finding. Re-verify the items in research-notes §5 do-not-print list, and re-check all pricing/status claims — the tool landscape moves.)*
