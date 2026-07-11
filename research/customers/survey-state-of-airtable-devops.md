# The State of Airtable DevOps — Benchmark Survey

**Audience:** the *entire* Airtable ecosystem — builders, admins, ops/RevOps, IT, consultants, founders — reached through community channels (Airtable Community, BuiltOnAir, consultant/partner networks, LinkedIn, newsletters), not just our own list. This is the definitive-benchmark instrument; the wider and more neutral the sample, the more citable the report.
**Goal:** produce the authoritative annual dataset on how teams protect, change, document, and access Airtable data — the Airtable analog of Gearset's State of Salesforce DevOps and Google's DORA research. Re-runnable annually with stable question IDs for year-over-year trend lines.
**Incentive:** first access to *The State of Airtable DevOps* report ("see how you compare").
**Target length:** 12–14 minutes, ~45 questions. Questions marked ⭑ are required. Every required practice question keeps **ordinal** answer options so it can feed the maturity index.
**Relationship to the other two surveys:** Sections 1, 4–9, 11 are a **superset** of the shared core (B–F) in `survey-existing-customers.md` / `survey-mailing-list.md` — overlapping questions use identical wording (mapping table in the builder notes) so all three datasets merge. New material (team & governance, incident deep-dive, DORA-style change metrics, AI section) exists only here.

**Design principles (from `research-notes.md`):**
- **DORA's four keys, translated to Airtable** [A-5]: structural-change frequency (§7), lead time (§7), change failure rate (§7), recovery time (§5/§6). Copado proved the four keys transfer to a SaaS platform [A-2 #10].
- **Gearset's credibility pattern** [A-1]: screener up front, demographics for disclosure (we publish our sample's customer share, role mix, and plan mix), a "topic of the year" section (AI, §10), and stable annual IDs.
- **Neutrality:** no product names in question stems except as answer options; nothing in this instrument mentions BaseOut features. The report's authority depends on the survey not reading as a lead form.
- **Measure the traps we found in research:** URL-only attachment backups [N-6], the automations/interfaces export gap [N-7, T-2], snapshot-restore rewiring cost [T-12], plan-retention awareness [N-1], untested restores [A-6].

---

## Intro copy (top of form)

> **The first State of Airtable DevOps survey**
>
> How do teams actually protect, change, and manage the Airtable bases their business runs on? Nobody has measured it — so we are. Salesforce has had a State of DevOps report for years; Airtable's ecosystem deserves the same benchmark.
>
> ~12 minutes. In return you get **the State of Airtable DevOps report before anyone else**, with benchmarks to compare your own practices against.
>
> Answers are confidential; only aggregated results are published. There are no right answers — honest ones make the benchmark worth reading.

---

## Section S — Screener

**S1. ⭑ How would you describe your relationship with Airtable?** *(single select)*
- I build and manage bases regularly — it's part of my job
- I build for clients as a consultant / freelancer / agency
- I use bases that others built
- I administer Airtable for my organization but don't build much
- I evaluated Airtable but don't actively use it
- I don't use Airtable
  - *(Branch: last two options → thank-you screen + optional email for the report. Excluded from the core dataset.)*

**S2. ⭑ How long have you been working with Airtable?** *(single select)*
- Under 1 year · 1–2 years · 3–5 years · 5+ years

---

## Section 1 — You & your organization

**1.1 ⭑ Which best describes your role?** *(single select — identical to shared core B1)*
- Airtable consultant / agency serving multiple clients
- Internal Airtable admin / "the Airtable person" at my company
- Operations / RevOps / BizOps
- IT / engineering
- Founder / executive
- Other: ___

**1.2 ⭑ How many people are in your organization?** *(single select — identical to B2)*
- Just me · 2–10 · 11–50 · 51–200 · 201–1,000 · 1,000+

**1.3 What industry is your organization in?** *(single select: standard list — Technology/SaaS · Professional services & consulting · Marketing/creative · Manufacturing/logistics · Healthcare · Education · Nonprofit · Finance · Real estate/construction · Media/entertainment · Government · Other)*

**1.4 Where are you located?** *(single select: North America · Europe · UK & Ireland · Latin America · Asia-Pacific · Middle East & Africa)*

**1.5 ⭑ Who is responsible for Airtable in your organization?** *(single select)*
- Me, formally — it's in my job description
- Me, informally — it became mine by default
- A dedicated Airtable/ops team
- IT owns it
- Nobody, really
- An external consultant/agency

---

## Section 2 — Your Airtable estate

**2.1 ⭑ Which Airtable plan are you on?** *(single select — identical to B3)*
- Free · Team · Business · Enterprise Scale · Multiple plans (consultant) · Not sure

**2.2 ⭑ Roughly how many Airtable bases do you (or your clients) actively maintain?** *(single select — identical to B4)*
- 1–3 · 4–10 · 11–25 · 26–100 · 100+

**2.3 ⭑ Roughly how many records are in your *largest* base?** *(single select — identical to B5)*
- Under 10k · 10k–50k · 50k–125k · 125k–500k · 500k+ · Not sure

**2.4 ⭑ How many people actively *build* in your bases (create tables, fields, automations — not just enter data)?** *(single select)*
- Just me · 2–3 · 4–10 · 11+ · Not sure

**2.5 ⭑ How business-critical is the data in Airtable?** *(single select — identical to B6)*
- Mission-critical — the business stops without it
- Important — major disruption if lost, but we'd survive
- Useful — inconvenient to lose
- Experimental / low stakes

**2.6 What runs on your most important base(s)?** *(multi-select — identical to B7)*
- Customer / CRM data · Project & operations management · Product / inventory data · Finance / billing data · HR / people data · Content / marketing · Client deliverables (consultants) · Other: ___

**2.7 ⭑ Roughly how many automations run across your important bases?** *(single select)*
- None · 1–10 · 11–50 · 51–200 · 200+ · Not sure

**2.8 ⭑ What connects to your Airtable data from outside?** *(multi-select)*
- Zapier / Make / n8n workflows
- Custom code via the API
- Interfaces used by people outside the core team
- Airtable forms (or third-party forms) feeding data in
- Sync to/from other tools (CRM, spreadsheets, databases)
- BI / reporting tools
- AI tools or agents
- Nothing external
- Not sure

---

## Section 3 — Team practices & governance

**3.1 ⭑ Who can change the *structure* of your important bases (add/rename/delete tables and fields)?** *(single select)*
- One designated builder/admin only
- A small, defined group of builders
- Most collaborators have creator access
- Honestly, almost anyone in the workspace
- Not sure

**3.2 ⭑ Do you have any written rules or conventions for building in Airtable (naming, field descriptions, who approves changes)?** *(single select)*
- Yes — documented and generally followed
- Yes — documented but rarely followed
- Informal habits, nothing written
- No

**3.3 ⭑ When someone leaves the team or a project (offboarding), is there a process for their Airtable access and the bases they built?** *(single select)*
- Yes — access review and handover are standard
- Partially — access gets removed, knowledge walks out the door
- No — we've been burned by this
- No — but it hasn't hurt us yet
- Not sure

---

## Section 4 — Backup & recovery

**4.1 ⭑ How do you back up your Airtable data today?** *(multi-select — identical to C1)*
- Airtable's built-in snapshots / revision history only
- A third-party backup tool (On2Air, etc.)
- Custom scripts / API export we built ourselves
- Manual CSV exports
- Zapier / Make syncing to another system
- We don't back up Airtable
- Not sure

**4.2 If you back up (any method beyond built-in): how often do backups run?** *(single select, conditional)*
- Continuously / near-real-time · Daily · Weekly · Monthly · Irregularly, when someone remembers · Not sure

**4.3 ⭑ Does a copy of your Airtable data exist *outside* Airtable right now (a file, database, or export you could open if Airtable were unreachable)?** *(single select)*
- Yes — current within the last week
- Yes — but probably stale
- No — everything lives inside Airtable
- Not sure

**4.4 If you back up: what does your backup actually include?** *(multi-select, conditional — check everything you're confident is captured)*
- Records (the data itself)
- Attachment **files** (the actual files, not just links)
- Base structure (tables, fields, field types)
- Views and their configurations
- Automations
- Interfaces
- Comments
- Not sure what it includes
  - *(Analysis note: "attachment files" vs. not selecting it is the URL-expiry trap [N-6]; automations/interfaces selections test awareness that the API can't export them [N-7] — cross-check against 4.1 method.)*

**4.5 ⭑ Do you know how long your Airtable plan retains snapshots and revision history?** *(single select)*
- Yes — I know the exact windows
- Roughly — I'd have to check
- No — I assumed it was forever
- No — never thought about it

**4.6 ⭑ Does anyone *outside your team* require your Airtable data to be backed up (clients, security reviews, compliance, insurance, leadership)?** *(single select — identical to C6)*
- Yes — a formal requirement (compliance / contract / security review)
- Yes — informal expectation
- No
- Not sure

**4.7 If you have a formal requirement: which of these does it involve?** *(multi-select, conditional)*
- A security questionnaire / vendor review asked about it
- A client contract requires it
- A compliance framework (SOC 2, ISO 27001, HIPAA, GDPR retention)
- Cyber-insurance requirements
- Internal audit / leadership mandate
- Other: ___

---

## Section 5 — Incidents (the last 12 months)

**5.1 ⭑ In the last 12 months, how many times have you lost or corrupted Airtable data (deleted records/tables/fields, bad automation run, sync overwrite) badly enough that you had to act?** *(single select)*
- Never · Once · 2–5 times · 6+ times · Not sure
  - *(Benchmarks against Gearset's 47–67% annual data-loss incidence in Salesforce [A-2 #5].)*

**5.2 Thinking of the *worst* incident: what caused it?** *(single select, conditional on ≥1)*
- Someone deleted records/tables/fields by accident
- An automation or script misbehaved
- A sync/integration overwrote good data
- A departing employee / offboarding issue
- An external collaborator's change
- An AI tool/agent made unwanted changes
- Not sure
- Other: ___

**5.3 How long did it take to *notice* that incident had happened?** *(single select, conditional)*
- Minutes · Hours · Days · Weeks or longer · We found it by accident

**5.4 How long did it take to get back to a working state?** *(single select, conditional)*
- Under an hour · Same day · A few days · A week or more · We never fully recovered

**5.5 What did recovery involve?** *(multi-select, conditional)*
- Airtable's undo / revision history
- Restoring records from Airtable's trash
- Restoring a base snapshot (and rebuilding links/integrations)
- Restoring from an external backup
- Manually re-entering data
- Contacting Airtable support
- We couldn't recover some or all of it

**5.6 ⭑ Have you ever permanently lost Airtable data — gone for good?** *(single select — maps to C2 for merge)*
- Yes
- No, but only because we got lucky
- No — we've always recovered
- Never had an incident

---

## Section 6 — Restore readiness

**6.1 ⭑ If your most important base disappeared right now, how long would it take you to get back to a working state?** *(single select — identical to C4)*
- Under an hour · Same day · A few days · A week or more · We might never fully recover · No idea

**6.2 ⭑ Have you ever *tested* restoring from a backup (not just taking backups)?** *(single select — identical to C5)*
- Yes, regularly · Yes, once or twice · No — but we have backups · No — we have no backups to test

**6.3 ⭑ Do you have an explicit target for how quickly you'd need to recover (even an informal one)?** *(single select)*
- Yes — written down and tested against
- Yes — informal ("we'd need it back same-day")
- No — never discussed
- Not applicable

**6.4 ⭑ How confident are you that you could fully recover your most important base — structure, data, automations, interfaces, and integrations — after a serious incident?** *(1–5: Not at all confident → Completely confident)*

**6.5 Have you ever restored an Airtable snapshot and had to rewire what depended on the base (integrations, share links, embedded views)?** *(single select)*
- Yes — the rewiring was the hardest part
- Yes — minor rewiring
- Restored, nothing depended on it
- Never restored a snapshot

---

## Section 7 — Change management (structural changes to live bases)

*Intro shown to respondents: "Structural changes = adding, renaming, or deleting tables and fields, or changing automations and interfaces — not day-to-day data entry."*

**7.1 ⭑ How often does someone make a structural change to your important bases?** *(single select)*
- Daily · Weekly · Monthly · A few times a year · Almost never · Not sure

**7.2 ⭑ When you decide to make a significant change (a restructure, a new automation), how long does it usually take to go from decision to live?** *(single select)*
- Same day · Within a week · Within a month · Longer · We avoid significant changes

**7.3 ⭑ How do you test risky changes (new automations, restructures) before they hit the live base?** *(single select — identical to D4)*
- We duplicate the base and test in the copy
- We test in the live base carefully (off-hours, small batches)
- We just make the change and watch
- We have a formal dev/staging/prod-style process
- N/A — we rarely make risky changes

**7.4 ⭑ Roughly what share of structural changes cause something to break (an automation, integration, formula, interface, or report)?** *(single select)*
- Almost none · Under 10% · 10–25% · More than 25% · Not sure
  - *(The change-failure-rate key [A-5]; Salesforce benchmark 23–33% [A-2 #9].)*

**7.5 ⭑ Has a schema change ever broken something (a renamed/deleted field breaking an automation, integration, formula, or interface)?** *(single select — identical to D2)*
- Yes — more than once
- Yes — once
- Not that I know of
- No

**7.6 ⭑ When something breaks, how easy is it to answer "what changed, when, and who changed it?"** *(single select — identical to D3)*
- Easy — we have change history we trust
- Possible, but slow and painful
- Basically impossible
- Never needed to

**7.7 ⭑ When something breaks, how long does it usually take to find the cause and fix it?** *(single select)*
- Under an hour · A few hours · A day or two · Longer · It's still broken somewhere, probably

**7.8 Before renaming or deleting a field, can you see what depends on it (automations, integrations, formulas, interfaces)?** *(single select)*
- Yes — we have dependency visibility
- Partially — within Airtable, not external tools
- No — we find out when something breaks
- Never thought to check

**7.9 Do you take a snapshot before making a risky change?** *(single select)*
- Always · Usually · Sometimes · Never · Didn't know that was a thing

---

## Section 8 — Documentation & schema visibility

**8.1 ⭑ How do you keep track of *how your bases are structured* (tables, fields, relationships)?** *(single select — identical to D1)*
- It's all in my head / the builder's head
- Docs we maintain by hand (Notion, Google Docs, etc.)
- A diagramming tool (Whimsical, Lucidchart, etc.) updated manually
- A tool that auto-generates schema documentation
- We don't — we open the base and look

**8.2 If you maintain documentation: how current is it?** *(single select, conditional)*
- Current — updated when the base changes
- Months behind
- Historical fiction at this point

**8.3 ⭑ Do you use field descriptions in Airtable?** *(single select)*
- Yes — consistently, on most fields
- On the important/confusing fields
- Rarely
- Didn't know fields had descriptions

**8.4 ⭑ Are your automations and interfaces documented anywhere outside Airtable (what they do, what they touch, why they exist)?** *(single select)*
- Yes — documented and current
- Partially — the important ones
- No — the base is the documentation
- Not sure
  - *(The logic layer can't be exported via API [N-7] — this measures whether teams have compensated.)*

**8.5 ⭑ Roughly how much of your (or your team's) time goes to "archaeology" — figuring out how a base works, what a field is for, why something broke?** *(single select — identical to D6)*
- Hours every week · A few hours a month · Rarely · Never

**8.6 If a new person had to take over your most important base tomorrow, how long until they could maintain it safely?** *(single select)*
- Days · Weeks · Months · It would be very bad

---

## Section 9 — Data access & reporting

**9.1 ⭑ Do you ever need your Airtable data *outside* Airtable (SQL, BI tools, custom apps, spreadsheets)?** *(single select — identical to E1)*
- Yes — constantly, it's core to how we work
- Yes — occasionally
- No — everything stays in Airtable
- Not yet, but we're heading there

**9.2 If yes — how do you get it out today?** *(multi-select, conditional — identical to E2)*
- CSV exports · Airtable API + custom code · Zapier / Make · A sync tool (Whalesync, Coefficient, etc.) · Airtable's native BI connectors · Other: ___

**9.3 ⭑ How interested are you in a continuously-synced SQL database of your Airtable data (queryable with SQL / BI tools / your own code)?** *(1–5: Not interested → Extremely interested — identical to E3)*

**9.4 Have Airtable's API limits (rate limits, monthly call caps) ever constrained something you were trying to build or export?** *(single select)*
- Yes — a real blocker
- Yes — annoying but workable
- No
- Didn't know there were limits

---

## Section 10 — AI & Airtable *(topic of the year)*

**10.1 ⭑ Is your team using Airtable's AI capabilities (Omni, AI fields, agents)?** *(single select)*
- Yes — regularly, in production bases
- Experimenting
- Tried it, not using it
- No
- Not sure

**10.2 ⭑ Do AI tools or agents (Airtable's or external) ever *make changes* to your bases — creating structure, editing records, building automations?** *(single select)*
- Yes — routinely
- Yes — occasionally, supervised
- We've tested it
- No
- Not sure

**10.3 ⭑ How does AI change your level of concern about unwanted changes to your data and base structure?** *(single select)*
- More concerned — AI raises the risk of changes nobody reviewed
- About the same
- Less concerned — AI helps us catch problems
- Haven't thought about it

**10.4 ⭑ How interested are you in AI applied to *protecting and understanding* your data?** *(matrix, 1–5 — identical to E4)*
- Ask questions about your data in plain English (chat)
- AI-generated documentation of your bases
- Connecting your data to AI assistants you already use (Claude, ChatGPT) via MCP
- AI flagging anomalies (sudden deletions, unusual data changes)

---

## Section 11 — Investment & priorities

**11.1 ⭑ Rank your top 3 priorities for an Airtable data platform.** *(rank 3 of list — identical to F1)*
- Reliable automated backups
- Fast, easy restore when something breaks
- Schema visibility (diagrams, changelog, docs)
- Change alerts & monitoring
- SQL / external access to my data
- Automation & interface backup
- Governance / compliance (audit trails, PII detection, retention)
- AI features on my data

**11.2 ⭑ What does your organization spend today on Airtable backup/management tooling (excluding Airtable itself)?** *(single select — identical to F2)*
- $0 · Under $25/mo · $25–99/mo · $100–299/mo · $300–999/mo · $1,000+/mo

**11.3 ⭑ For a tool that solved your top 3 priorities well, what monthly budget could you realistically justify?** *(single select — identical to F3)*
- Under $25 · $25–49 · $50–99 · $100–199 · $200–399 · $400+ · Depends entirely on client billing (consultant)

**11.4 ⭑ Over the next 12 months, is your organization's use of Airtable…** *(single select)*
- Growing — more bases, more people, more critical
- Steady
- Shrinking / migrating away
- Not sure

**11.5 ⭑ Honestly: how mature is your team's Airtable data protection and change management?** *(single select)*
- We wing it
- We have the basics, with gaps
- Solid — automated and documented
- Engineered — we'd pass an audit tomorrow
  - *(Self-assessment vs. the computed maturity index is a headline chart: the confidence gap.)*

**11.6 What's the one thing that would most improve how you manage Airtable?** *(open text)*

**11.7 What's your single biggest frustration with Airtable overall?** *(open text — identical to F5)*

---

## Section 12 — Wrap-up

**12.1 ⭑ Email for your copy of *The State of Airtable DevOps* report:** *(email field)*

**12.2 May we contact you for a 20-minute interview about your Airtable practices? (Interviewees get an extended findings pack.)** *(single select)*
- Yes · No

**12.3 Can we count you in for next year's survey, to track how the ecosystem changes?** *(single select)*
- Yes · No

**12.4 Anything we should have asked but didn't?** *(open text, optional)*

---

## Builder notes (not shown to respondents)

### Platform & mechanics
- Needs: branching (S1 exclusion; conditionals 4.2, 4.4, 4.7, 5.2–5.5, 8.2, 9.2), one matrix (10.4), rank-3 (11.1), hidden fields.
- **Hidden fields:** `source` (community / partner / newsletter / social / paid), `audience` (customer / list / public) — publish the source mix in the methodology note, per the Gearset disclosure pattern [A-1].
- **Quality control:** min-time gate (<4 min = flag), S1 screener, and treat straight-lining on 10.4 as a flag. Gearset's 2025 shift to fewer, screened responses is the precedent: quality over volume [A-1].
- ~45 questions, ~29 required. If length testing says trim: drop 1.3, 1.4, 8.6, 9.4, 12.4 first — never trim a maturity-index or shared-core question.

### Shared-core mapping (for merging with the other two surveys)
| This survey | Shared core | | This survey | Shared core |
|---|---|---|---|---|
| 1.1 | B1 | | 6.2 | C5 |
| 1.2 | B2 | | 7.3 | D4 |
| 2.1 | B3 | | 7.5 | D2 |
| 2.2 | B4 | | 7.6 | D3 |
| 2.3 | B5 | | 8.1 | D1 |
| 2.5 | B6 | | 8.5 | D6 |
| 2.6 | B7 | | 9.1 / 9.2 / 9.3 | E1 / E2 / E3 |
| 4.1 | C1 | | 10.4 | E4 |
| 4.6 | C6 | | 11.1 / 11.2 / 11.3 | F1 / F2 / F3 |
| 5.6 | C2 (recoded) | | 11.7 | F5 |
| 6.1 | C4 | | | |

Wording of mapped questions is **locked** to the shared core — any change must land in all three files. 5.6→C2 needs a recode at analysis time (documented above); everything else merges directly.

### Maturity index (extended)
The 6-question core index (C1/C4/C5/D1/D3/D4 ↔ 4.1/6.1/6.2/8.1/7.6/7.3) stays canonical for cross-survey comparability — score it identically to Appendix B of the report. This survey additionally supports an **extended index** (0–3 each): 4.3 external copy, 4.4 coverage breadth, 6.3 RTO target, 7.4 change failure rate, 7.8 dependency visibility, 7.9 pre-change snapshots, 8.4 logic-layer docs, 3.2 conventions. Report the core index as the headline (comparable across all respondents and future years); use the extended index for the deep-dive chapter. Validate that band cutoffs produce interpretable clusters before publishing.

### DORA mapping (for the report's methodology note)
- Deployment frequency → 7.1 · Lead time → 7.2 · Change failure rate → 7.4 · Time to restore → 5.4 (actual) + 6.1 (expected) · MTTD (our addition) → 5.3.

### Headline charts this instrument is designed to produce
1. **The confidence gap:** self-assessed maturity (11.5) vs. computed index — expect systematic overconfidence.
2. **The coverage illusion:** % who "back up" (4.1) whose backups miss attachments/automations/interfaces (4.4) — the finding no one else can produce [N-6, N-7].
3. **Incident funnel:** 5.1 incidence → 5.3 detection lag → 5.4 recovery → 5.6 permanent loss, benchmarked against Gearset's 47–67% [A-2].
4. **The AI wildcard:** 10.2 (AI agents editing bases) × 7.6 (can't tell what changed) — the 2026-specific risk story.
5. **Retention awareness:** 4.5 — % who assumed native history "was forever."
6. Year-over-year trends on every shared-core ID, starting next edition.

### Distribution plan (sketch)
Community-first, per the Gearset playbook [A-1]: Airtable Community + TableForums posts, BuiltOnAir podcast/newsletter, consultant/partner networks (each consultant reaches many orgs — offer a co-branded findings pack for partners who share), LinkedIn, no-code newsletters. Subject the *survey and report*, never the product. Target n: 300+ screened responses year one (Gearset's screened 2025 edition was 464 [A-1]); disclose whatever the customer/list share turns out to be.

### Guardrails
- **No unreleased pricing or tier names** (Features §3 is not public) — 11.2/11.3 stay as neutral bands.
- No BaseOut feature language in stems; vendor names appear only inside answer options where respondents need them ("On2Air, etc." in 4.1; "Whalesync, Coefficient, etc." in 9.2).
- Keep all scored questions ordinal; never reorder answer options between annual editions — IDs and options are the trend line.
