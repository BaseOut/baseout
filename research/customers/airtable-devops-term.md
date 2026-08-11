# "Airtable DevOps" — Term Usage Guide

The category term we are creating and intend to own. This doc is the reference for how, why, and when to use it, and the approved supporting language around it. Outward-facing copy (survey, report, prelaunch, PR, docs) should conform; deviations are a decision, not an accident.

---

## The term

**Airtable DevOps** *(noun, category)* — the discipline of overseeing and managing what runs on Airtable: backup and recovery, restore readiness, schema and change management, documentation, monitoring, and data access.

**The standing gloss (use it everywhere the term headlines):**

> **Airtable DevOps — how teams build, change, and safeguard what they run on Airtable.**

The gloss is not optional decoration. Most of the audience (admins, ops people, "the Airtable person," consultants) does not self-identify as DevOps engineers — the gloss makes the term land in the same breath for readers who don't know it, while the term itself signals engineering-grade seriousness to those who do.

---

## Why this term

1. **Borrowed authority with a proven playbook.** "Salesforce DevOps" went from vendor coinage to a real market — Gearset's annual *State of Salesforce DevOps* report, DORA's *State of DevOps* as the most-cited benchmark format in software, and a $1.9B acquisition (Own Company by Salesforce) as the category endgame. Our survey/report strategy is built on that analogy; renaming the discipline forfeits the borrowed credibility that makes a first-edition report citable. (Evidence: `research-notes.md` §3.)
2. **Search and category whitespace.** "Airtable DevOps" is essentially unclaimed. First mover on the term + the benchmark = owning the definition.
3. **Aspirational, not descriptive.** Salesforce admins weren't developers either; the term stuck because it told them their work was engineering-grade. Same audience dynamic here — the word follows the discipline, not the job title.
4. **Bigger than backup.** Every alternative either names one pillar (backup, data protection, change management, administration) or has a fatal flaw (see Rejected terms). The category term must cover the whole discipline so the platform story has room.

## Where it's used (and where it's not)

| Surface | Use? | Form |
|---|---|---|
| Report title + survey title | **Yes — canonical** | *The State of Airtable DevOps* + gloss as subtitle |
| Prelaunch / launch marketing headlines | Yes | Term + gloss on first appearance per page |
| PR, podcast/community talking points | Yes | "the first State of Airtable DevOps survey/report"; define it in the first sentence |
| Baseout positioning | Yes, carefully | "the Airtable DevOps platform" — *category-leader claims only after the report ships* (the report is what earns the term) |
| Product UI (buttons, nav, settings, empty states) | **No** | Plain verbs: back up, restore, see what changed, protect |
| Support docs / everyday help copy | Sparingly | Explain tasks in plain language; the term may appear in conceptual overviews |
| Survey question stems | **No** | Questions stay in plain language (neutrality — the instrument must not read as jargon or a pitch) |

**The pattern: category label at the headline level, plain verbs at the task level.** DevOps names the discipline and the report; it is never the button.

## When it's used

- **Now → survey launch:** "the first State of Airtable DevOps survey" — the term's public debut rides the survey announcement (prelaunch page, community posts, BuiltOnAir).
- **Report publication:** the report *defines* the category — maturity model, benchmarks, the four pillars. After this, "Airtable DevOps" has a citable definition we wrote.
- **Annually thereafter:** each edition re-anchors the term ("the second annual State of Airtable DevOps…"). Cadence is part of ownership.
- **Product launch:** Baseout positions as the platform *for* the discipline the report named. Order matters: benchmark first, platform claim second.

---

## Approved supporting language

### Definitions by length

- **One-liner (the gloss):** How teams build, change, and safeguard what they run on Airtable.
- **Short:** Airtable DevOps is the discipline of protecting and managing what your business runs on Airtable — backups you control, safe changes, visible schema, recoverable data.
- **Full:** As Airtable graduated from shared spreadsheet to production infrastructure, the practices that every mature platform develops — version control, backups, staging, change management, documentation — had no Airtable equivalent. Airtable DevOps is that missing discipline: how teams back up and restore their data, test and track changes, document and monitor their bases, and get their data wherever it needs to go.

### The four pillars (report vocabulary — reuse verbatim)

1. **Backup & recovery** 2. **Restore readiness** 3. **Schema & change management** 4. **Data access & intelligence**

### The maturity ladder (report + survey completion screen)

**Ad hoc → Aware → Managed → Engineered.** Respondent-facing one-liners: *Ad hoc* — "the base is the backup" · *Aware* — "we know, and there's a spreadsheet somewhere" · *Managed* — "it's automated, and we've restored at least once" · *Engineered* — "protection and change management are part of how we build."

### Supporting phrases (allowed alongside the term, never instead of it)

- "Airtable operations" — spelled out, as a plain-language variant in mid-funnel prose. Never "Airtable ops" (reads as the business ops people run *in* Airtable) and never as a competing category name.
- "The missing safety layer for Airtable" — emotional framing for marketing.
- "Protect, manage, and understand your Airtable" — task-level triplet for product-adjacent copy.
- Attribution/sponsorship line wherever the survey/report is presented: **"Run by Baseout and BuiltOnAir — from the team behind On2Air."**

### Rejected terms (and why — don't reopen without a decision)

| Term | Why not |
|---|---|
| **AirOps / Airtable Ops** | AirOps is an existing company; "Airtable ops" inverts (means ops run *in* Airtable) |
| **ALM** (application lifecycle management) | Microsoft's accurate term, zero recognition outside that ecosystem — cite it in the report, don't brand with it |
| **Governance** | Reads as lockdown/compliance; already reserved as the Baseout V2 suite name |
| **Administration / base management** | Low-status, no category energy |
| **Data protection / backup** | Names one pillar; the category must be bigger than backup |
| **Estate** (as in "Airtable estate") | Consultant-speak the audience doesn't recognize — use "setup" in public copy (settled 2026-07-11) |

## Claim hygiene for the term

- "The **first** State of Airtable DevOps survey/report" — defensible now (verify no prior publication with the exact title before print).
- "The Airtable DevOps platform" (Baseout) — hold until the report has shipped and the product claims track shipped features (GTM §6.5).
- Never imply Airtable-the-company endorses the term or the report.
- The survey's public core stays neutral: the term appears in framing/titles, never in question stems.
