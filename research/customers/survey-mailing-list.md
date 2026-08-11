# Baseout Survey — Mailing List / General Airtable Audience

**Audience:** Mailing-list subscribers who are *not* (or may not be) On2Air Backups customers — Airtable builders, consultants, ops people who followed On2Air content, tools, or the newsletter.
**Goal:** Measure the broader market's Airtable DevOps pain (backup, schema visibility, change management, data access) and appetite for Baseout; grow the launch list.
**Incentive:** *The State of Airtable DevOps* report + a sneak peek at Baseout.
**Target length:** 6–7 minutes (shorter than the customer form — this audience has less commitment). Questions marked ⭑ are required.
**Merge key:** Sections B–F are the **shared core**, word-for-word identical to `survey-existing-customers.md` so the two datasets combine for the report. Section A (screener) and Section G (early access) are list-only.

---

## Intro copy (top of form)

> **How do teams actually protect and manage their Airtable data? Help us find out.**
>
> We're running the first **State of Airtable DevOps** survey — how teams handle backup, recovery, schema changes, documentation, and data access on Airtable. It takes about 6 minutes.
>
> As a thank-you, you'll get:
> 1. **The State of Airtable DevOps report** before anyone else — see how your practices compare to other teams.
> 2. **A sneak peek at Baseout**, the Airtable backup & data-intelligence platform we're building (the next generation of On2Air Backups).
>
> Your individual answers stay private; only aggregated results appear in the report.

---

## Section A — Screener *(list-only)*

**A1. ⭑ How would you describe your relationship with Airtable?** *(single select)*
- I build and manage bases regularly — it's part of my job
- I use bases others built
- I'm a consultant/freelancer building for clients
- I evaluated Airtable but don't actively use it
- I don't use Airtable
  - *(Branch: "don't use" → skip to G, ask only G1-lite: "What platform do you use instead?" open text, then email capture. Their data is excluded from the report core.)*

**A2. ⭑ Have you ever used On2Air products?** *(single select)*
- Yes — On2Air Backups
- Yes — other On2Air products (Forms, Docs, Amplify)
- No, but I've heard of On2Air
- No — never heard of it
  - *(Anyone answering "Yes — On2Air Backups" is a mis-bucketed customer: still fine — the hidden `audience` field plus this answer lets you reassign them to the customer segment at analysis time.)*

---

## Section B — About you & your Airtable footprint *(shared core)*

**B1. ⭑ Which best describes your role?** *(single select)*
- Airtable consultant / agency serving multiple clients
- Internal Airtable admin / "the Airtable person" at my company
- Operations / RevOps / BizOps
- IT / engineering
- Founder / executive
- Other: ___

**B2. ⭑ How many people are in your organization?** *(single select)*
- Just me · 2–10 · 11–50 · 51–200 · 201–1,000 · 1,000+

**B3. ⭑ Which Airtable plan are you on?** *(single select)*
- Free · Team · Business · Enterprise Scale · Multiple plans (consultant) · Not sure

**B4. ⭑ Roughly how many Airtable bases do you (or your clients) actively maintain?** *(single select)*
- 1–3 · 4–10 · 11–25 · 26–100 · 100+

**B5. ⭑ Roughly how many records are in your *largest* base?** *(single select)*
- Under 10k · 10k–50k · 50k–125k · 125k–500k · 500k+ · Not sure

**B6. ⭑ How business-critical is the data in Airtable?** *(single select)*
- Mission-critical — the business stops without it
- Important — major disruption if lost, but we'd survive
- Useful — inconvenient to lose
- Experimental / low stakes

**B7. What runs on your most important base(s)?** *(multi-select)*
- Customer / CRM data · Project & operations management · Product / inventory data · Finance / billing data · HR / people data · Content / marketing · Client deliverables (consultants) · Other: ___

---

## Section C — Backup & recovery today *(shared core)*

**C1. ⭑ How do you back up your Airtable data today?** *(multi-select)*
- Airtable's built-in snapshots / revision history only
- A third-party backup tool (On2Air, etc.)
- Custom scripts / API export we built ourselves
- Manual CSV exports
- Zapier / Make syncing to another system
- We don't back up Airtable
- Not sure

**C2. ⭑ Have you ever lost Airtable data or had it corrupted (deleted records/tables/fields, bad automation run, sync gone wrong)?** *(single select)*
- Yes — and we couldn't fully recover it
- Yes — but we recovered it
- Not yet, but it's a real worry
- No, and I'm not worried about it

**C3. If yes — what caused it?** *(multi-select, shown conditionally)*
- Someone deleted records/tables/fields by accident
- An automation or script misbehaved
- A sync/integration overwrote good data
- A departing employee / offboarding issue
- An external collaborator's change
- Not sure
- Other: ___

**C4. ⭑ If your most important base disappeared right now, how long would it take you to get back to a working state?** *(single select)*
- Under an hour · Same day · A few days · A week or more · We might never fully recover · No idea

**C5. ⭑ Have you ever *tested* restoring from a backup (not just taking backups)?** *(single select)*
- Yes, regularly · Yes, once or twice · No — but we have backups · No — we have no backups to test

**C6. Does anyone *outside your team* require your Airtable data to be backed up (clients, security reviews, compliance, insurance, leadership)?** *(single select)*
- Yes — a formal requirement (compliance / contract / security review)
- Yes — informal expectation
- No
- Not sure

---

## Section D — Schema, change management & visibility *(shared core)*

**D1. ⭑ How do you keep track of *how your bases are structured* (tables, fields, relationships)?** *(single select)*
- It's all in my head / the builder's head
- Docs we maintain by hand (Notion, Google Docs, etc.)
- A diagramming tool (Whimsical, Lucidchart, etc.) updated manually
- A tool that auto-generates schema documentation
- We don't — we open the base and look

**D2. ⭑ Has a schema change ever broken something (a renamed/deleted field breaking an automation, integration, formula, or interface)?** *(single select)*
- Yes — more than once
- Yes — once
- Not that I know of
- No

**D3. ⭑ When something breaks, how easy is it to answer "what changed, when, and who changed it?"** *(single select)*
- Easy — we have change history we trust
- Possible, but slow and painful
- Basically impossible
- Never needed to

**D4. ⭑ How do you test risky changes (new automations, restructures) before they hit the live base?** *(single select)*
- We duplicate the base and test in the copy
- We test in the live base carefully (off-hours, small batches)
- We just make the change and watch
- We have a formal dev/staging/prod-style process
- N/A — we rarely make risky changes

**D5. ⭑ How valuable would each of these be to you?** *(matrix, 1–5: Not valuable → Extremely valuable)*
- Automatic visual diagram of your base schema and relationships
- A changelog of every schema change ("Field X was deleted on March 12")
- Alerts when someone changes a table/field that other things depend on
- A "health score" flagging messy schema (unused fields, missing descriptions, formula errors)
- Auto-maintained documentation of tables and fields (AI-assisted)
- Backup of automations and interface configurations, not just records
- A changelog of *data* changes (what records changed between backups)

**D6. Roughly how much of your (or your team's) time goes to "archaeology" — figuring out how a base works, what a field is for, why something broke?** *(single select)*
- Hours every week · A few hours a month · Rarely · Never

---

## Section E — Data access, reporting & AI *(shared core)*

**E1. ⭑ Do you ever need your Airtable data *outside* Airtable (SQL, BI tools, custom apps, spreadsheets)?** *(single select)*
- Yes — constantly, it's core to how we work
- Yes — occasionally
- No — everything stays in Airtable
- Not yet, but we're heading there

**E2. If yes — how do you get it out today?** *(multi-select, conditional)*
- CSV exports · Airtable API + custom code · Zapier / Make · A sync tool (Whalesync, Coefficient, etc.) · Airtable's native BI connectors · Other: ___

**E3. ⭑ How interested are you in a continuously-synced SQL database of your Airtable data (queryable with SQL / BI tools / your own code)?** *(1–5: Not interested → Extremely interested)*

**E4. ⭑ How interested are you in AI features on top of your backed-up data?** *(matrix, 1–5)*
- Ask questions about your data in plain English (chat)
- AI-generated documentation of your bases
- Connecting your data to AI assistants you already use (Claude, ChatGPT) via MCP
- AI flagging anomalies (sudden deletions, unusual data changes)

**E5. Where would you want backup files stored?** *(multi-select)*
- Managed for me (I don't care where)
- My Google Drive / Dropbox / Box / OneDrive
- My own S3 / cloud bucket
- My own database (Postgres etc.)
- On-premise / customer-controlled only (compliance requirement)

---

## Section F — Priorities & investment *(shared core)*

**F1. ⭑ Rank your top 3 priorities for an Airtable data platform.** *(rank 3 of list)*
- Reliable automated backups
- Fast, easy restore when something breaks
- Schema visibility (diagrams, changelog, docs)
- Change alerts & monitoring
- SQL / external access to my data
- Automation & interface backup
- Governance / compliance (audit trails, PII detection, retention)
- AI features on my data

**F2. ⭑ What does your organization spend today on Airtable backup/management tooling (excluding Airtable itself)?** *(single select)*
- $0 · Under $25/mo · $25–99/mo · $100–299/mo · $300–999/mo · $1,000+/mo

**F3. ⭑ For a tool that solved your top 3 priorities well, what monthly budget could you realistically justify?** *(single select)*
- Under $25 · $25–49 · $50–99 · $100–199 · $200–399 · $400+ · Depends entirely on client billing (consultant)

**F4. What would make this a "buy it today" product for you? What's the one feature or guarantee that matters most?** *(open text)*

**F5. What's your single biggest frustration with Airtable overall?** *(open text)*

---

## Section G — Stay in the loop *(list-only)*

**G1. ⭑ Want early access to Baseout when it launches?** *(single select)*
- Yes — put me on the early-access list
- Yes — and I'd beta test in exchange for free access
- Just send the report
- No thanks

**G2. Can we interview you for 20 minutes about your Airtable setup? (We'll share extra findings from the report as thanks.)** *(single select)*
- Yes · No

**G3. ⭑ Email for your copy of *The State of Airtable DevOps* report + Baseout sneak peek:** *(email field — prefill from the ESP link where possible)*

---

## Builder notes (not shown to respondents)

- **Hidden field `audience=list`** (customer form carries `audience=customer`). Combined with A2, this lets you reassign mis-bucketed respondents at analysis time instead of policing the send lists.
- **Branch logic:** A1 "I don't use Airtable" skips the core and goes straight to a short close-out; C3 and E2 are conditional; everything else linear.
- **Any edit to Sections B–F must be mirrored** in `survey-existing-customers.md` — identical wording is what makes the combined report dataset valid.
- **No pricing/tier leaks:** F2/F3 stay as neutral bands; never mention Launch/Growth/Pro names or price points (Features §3 is not public).
- **Send strategy:** this form works as a 2-email sequence — announce ("first State of Airtable DevOps survey") then remind with a stat teaser. Subject-line the *report*, not the product; the report is the draw for non-customers.
