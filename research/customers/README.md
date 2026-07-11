# Customer Research — State of Airtable DevOps

Everything for the July 2026 audience-research push: two surveys, the research behind the incentive report, and the report draft itself.

## The play

1. **Send two surveys** — one to existing On2Air Backups customers, one to the general mailing list. Both share an identical core question bank (Sections B–F), so the results merge into a single dataset. A third, longer **benchmark instrument** (`survey-state-of-airtable-devops.md`) targets the whole ecosystem through community/partner channels — it's a superset of the same core, so all three merge; run it as the public-facing "State of Airtable DevOps survey" motion.
2. **The incentive is the report, not the product.** Respondents get *The State of Airtable DevOps* report first, plus a sneak peek at Baseout. For non-customers, the report is the entire draw — lead with it in subject lines.
3. **Survey data completes the report.** The report draft is written from desk research with `[SURVEY: …]` placeholders; the survey benchmarks make it credible and original. Publish after the response window closes (recommend 2–3 weeks + one reminder).
4. **The report positions Baseout as the category leader** for "Airtable DevOps" — the same move Gearset made with the State of Salesforce DevOps report: define the category, publish the benchmark, own the term.

## Files

| File | What it is |
|---|---|
| `survey-existing-customers.md` | Form for current/recent On2Air Backups customers. Adds On2Air satisfaction + migration-safety sections around the shared core. ~8–10 min. |
| `survey-mailing-list.md` | Form for the broader list. Adds a screener + early-access close around the same shared core. ~6–7 min. |
| `survey-state-of-airtable-devops.md` | The **definitive benchmark instrument** for the whole ecosystem (community, partners, social — not just our list). A superset of the shared core plus governance, incident deep-dive, DORA-style change metrics, and an AI section. Designed for annual re-runs with stable IDs. ~12–14 min. |
| `research-notes.md` | Verified desk-research findings (Airtable-native gaps, tool landscape, Salesforce/Power Platform DevOps analogs) with sources — the evidence base for the report. |
| `state-of-airtable-devops-report.md` | Full report draft with maturity model, pillar analysis, and `[SURVEY: …]` placeholders keyed to survey question IDs. |

## Two forms or one?

**Two forms** (recommended, and what these files implement): the customer form needs On2Air-specific questions (satisfaction, restore experience, migration fears) that would confuse non-customers, and the list form needs a screener. A single form with heavy branching would work but makes the ESP send-segmentation messier and lengthens the perceived survey. The shared core + hidden `audience` field gives you one combined dataset anyway — including reassigning list respondents who turn out to be customers (list form A2).

## Rules for editing the surveys

- **The shared core is locked across all three survey files.** Sections B–F in the two list/customer forms, and their mapped counterparts in the benchmark survey (mapping table in its builder notes), must keep identical wording and answer options — or the combined dataset breaks.
- **Never leak unreleased pricing or tier names** (Features §3 is not public). Budget questions use neutral dollar bands.
- Question IDs (B1, C4, …) are referenced by the report's `[SURVEY: …]` placeholders — renumber carefully.
- **Never reorder answer options between annual editions of the benchmark survey** — stable IDs + options are what make year-over-year trend lines valid.

## Analysis plan (when responses land)

- Primary crosstabs: role (B1) × data criticality (B6) × audience (hidden field).
- Maturity score per respondent from C1, C4, C5, D1, D3, D4 → maps to the report's 4-stage model (Ad hoc → Aware → Managed → Engineered).
- Product-validation reads: D5 matrix (schema intelligence appetite), E3 (SQL layer), E4 (AI/MCP), F1 rank (priority order), F3 (budget bands vs. planned tiers).
- Go/no-go signal for the schema & data intelligence bet: D5 rows averaging ≥3.5 among "mission-critical" (B6) respondents, and schema items appearing in ≥30% of F1 top-3s.

## Naming note

Spelling is settled: always **Baseout** in prose (capital B, one word). Lowercase **baseout** is reserved for the logo mark only.
