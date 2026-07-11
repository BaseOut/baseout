# Research Notes — The State of Airtable DevOps

**Purpose:** the verified evidence base for `state-of-airtable-devops-report.md`. Every desk-research claim in the report should trace to a numbered finding here. Research date: **July 2026** (three parallel research passes; facts current as of mid-2026 unless noted).

**Confidence key:**
- `[OFFICIAL]` — verified directly from an Airtable-owned or vendor-owned page fetched during research.
- `[COMMUNITY]` — Airtable Community forum, TableForums, Zapier Community, or practitioner post.
- `[PRESS]` — news / analyst / third-party coverage.
- `[VENDOR]` — a commercial party with an interest in the claim (backup vendors, analyst shops). Treat as directional; attribute in print.
- `[UNVERIFIED]` — conflicting or unconfirmable. **Do not print** without independent confirmation.

**How to use:** findings are numbered `N-x` (native), `T-x` (tools/community), `A-x` (analogs/benchmarks). The report cites them as `[RESEARCH: N-3]` etc. §5 is the do-not-print list — check it before publishing anything.

---

## 1. What Airtable natively provides (and doesn't)

### N-1. Base snapshots
Source: https://support.airtable.com/docs/taking-and-restoring-base-snapshots `[OFFICIAL]`

- Automatic snapshots are scheduled "based on how often you use your base" (heavy use ≈ daily); manual snapshots allowed with a cooldown of a few hours between them.
- **Retention by plan:** Free **2 weeks** · Team **1 year** · Business **2 years** · Enterprise Scale **3 years** (extendable in 1-year increments to **10 years** via data-retention policies — https://support.airtable.com/docs/creating-and-managing-data-retention-policies-in-airtable `[OFFICIAL]`).
- **Snapshots DO capture automations, interfaces, extensions, tables, views, records, pending interface edits, and record comments.** (Common third-party claim that they don't is wrong — see §5.)
- **The real gaps:** restore is **whole-base only** and always creates a **new base** ("The existing base cannot be overwritten") — no record/table/field-level restore; the restored base has **no revision history**; the new base gets **new record IDs and share links**, severing every integration (see T-12); retention is plan-gated; and snapshots live **inside Airtable** — they cannot be exported off-platform, so they satisfy no external-copy requirement.

### N-2. Record-level revision history
Source: https://support.airtable.com/docs/record-level-revision-history-overview `[OFFICIAL]`

- **Retention by plan:** Free **2 weeks** · Team **1 year** · Business **2 years** · Enterprise Scale **3 years** (extendable to 10 via retention policies).
- Tracks who edited a record and when — including edits by automations, syncs, and API calls — plus comments.
- **Limitations:** viewable **one record at a time** only; no bulk view, no bulk restore, no revert mechanism (reverting = manually re-typing old values); changes to synced-in data are hidden; in interfaces only visible-field changes show; clearing history is per-base and irreversible.

### N-3. Deleted-item recovery (trash)
Source: https://support.airtable.com/docs/managing-trash-in-airtable `[OFFICIAL]`

- **Base-level trash: 7 days** for tables, views, fields, extensions, records, interfaces, and interface pages.
- **Workspace-level trash: 30 days** for deleted bases/workspaces; Enterprise Scale admins can set 30/60/90/180 days.
- After the window items are "permanently removed." Recovery then depends on a pre-deletion snapshot (whole-base restore into a new base, manual copy-out). On Free, a deletion older than 2 weeks has no covering snapshot at all.

### N-4. Audit logs & admin panel
Sources: https://support.airtable.com/docs/accessing-enterprise-audit-logs-in-airtable · https://airtable.com/developers/web/api/audit-log-events `[OFFICIAL]`

- **Enterprise Scale only.** No audit logs on Free/Team/Business.
- Admin Panel export capped at 10,000 events; API pages 1,000/response. **Retention: 180 days.**
- Covers administrative/structural activity (base, table, view, interface, share, permission, auth events). **Record-level data changes (created/updated/deleted) are absent** from documented event categories — audit logs are not a data changelog.

### N-5. Schema change history — none exists natively
- No native changelog of field/table creation, deletion, renames, or type changes visible to builders. The nearest feature ("Manage fields") shows only the *most recent* modifier of a field, no history. `[COMMUNITY]`
- Demand evidence: https://community.airtable.com/other-questions-13/field-revision-history-12167 · https://community.airtable.com/formulas-10/edit-history-of-a-field-or-formula-35490 · https://community.airtable.com/other-questions-13/how-to-create-a-changelog-of-major-changes-in-airtable-18735 · a third-party "schema changelog" service built to fill the gap: https://community.airtable.com/show-and-tell-15/schema-changelog-track-changes-to-fields-and-tables-46642. `[COMMUNITY]`
- Enterprise audit logs partially cover structural events (admin-visible only, 180 days); nothing for the other three tiers, nothing surfaced to builders. `[OFFICIAL]`

### N-6. Attachment URL expiry
Source: https://support.airtable.com/docs/airtable-attachment-url-behavior `[OFFICIAL]`

- Expiring attachment URLs introduced **Nov 8, 2022**. Download URLs guaranteed active "at least 2 hours"; API docs: URLs "will only be active for a short period of time (~2 hours)."
- **Backup impact:** CSV exports and API responses contain URLs that die within hours — any backup that stores the URL instead of the bytes silently loses all attachments. Pain thread: https://community.airtable.com/automations-8/how-to-solve-the-problem-of-airtable-attachment-urls-expiring-after-2-hours-45254 `[COMMUNITY]`

### N-7. API surface & limits
Sources: https://airtable.com/developers/web/api/rate-limits · https://support.airtable.com/docs/managing-api-call-limits-in-airtable · https://airtable.com/developers/web/api/get-base-schema · https://airtable.com/developers/web/api/changelog `[OFFICIAL]`

- **Rate limits:** 5 requests/second per base; 50 rps per user/service account across personal access tokens; 429 → mandatory 30-second wait.
- **Monthly call caps:** Free **1,000 calls/month** · Team **100,000/month** (over-limit throttled to 2 rps) · Business & Enterprise Scale unlimited. Metadata calls count. This materially constrains DIY API backups on lower tiers.
- **Pagination:** list-records pages of 100 → a full-table export costs one request per 100 records.
- **Meta API:** returns full field definitions, but views come back **id/name/type only** — no filters, sorts, or view configuration.
- **Automations and interfaces are NOT exportable via the API — verified current through June 2026** (API changelog Feb 2024→Jun 2026 adds nothing for them). Community confirmations: https://community.airtable.com/development-apis-11/access-automation-via-api-5307 · https://community.airtable.com/development-apis-11/how-can-i-work-with-interfaces-via-api-4230 · https://community.airtable.com/automations-8/export-and-import-automations-22755. **Consequence: no third-party tool can fully back up automations/interfaces from the API alone** — the parts of a base you can't rebuild from memory are the parts you can't export.
- CSV export is per-view, one table at a time; attachments export as filename + expiring URL; comments, field descriptions, extension data not included; no native scheduled export. `[VENDOR/COMMUNITY — mechanics match official view docs]`

### N-8. Airtable's own shared-responsibility guidance
Source: https://support.airtable.com/docs/airtable-security-practices `[OFFICIAL]`

- Airtable backs up its production data internally ("regularly backed up to a separate, isolated location… encrypted") **and explicitly recommends customers keep their own backups** — by "exporting individual tables as CSV files" or "retrieving your data via the Airtable API." This is the strongest official shared-responsibility citation.
- No customer-facing SLA/RPO/RTO or durability commitment appears on that page.
- ToS reportedly disclaims responsibility for user content — `[UNVERIFIED wording]`: fetch and quote the exact clause before print.

### N-9. Adoption & scale stats (citable)
- **"More than 500,000 organizations, including 80% of the Fortune 100"** — Airtable's own boilerplate (https://www.airtable.com/about, newsroom releases). ⚠️ **Fortune 100, not Fortune 500** — many roundups misquote this.
- Funding: $735M Series F, Dec 2021, $11.7B valuation — https://www.airtable.com/newsroom/series-f `[OFFICIAL]`. Secondary-market 2025–26 estimates ≈ $4B (Forge, TSG Invest) `[PRESS — estimates, label as such]`. ARR ~$478M late-2024 (Getlatka/Sacra) `[VENDOR — unaudited estimate]`.
- **AI pivot timeline** (all official newsroom): "AI-native Airtable" refounding letter + **Omni** — Jun 24, 2025; DeepSky acquisition + OpenAI CTO hire — Oct 2025; Airtable for ChatGPT — Dec 15, 2025; **Superagent** — Jan 2026. Useful framing: the platform is moving fast, which raises the stakes on change management underneath it.

### N-10. Outages, incidents, deprecations
- **Feb 20, 2026 global outage** — bases/apps unloadable, logins and API failing; DownDetector spike ~1:45 PM ET. Sources: https://isdown.app/status/airtable/incidents/539388-airtable-service-interruption · https://community.airtable.com/other-questions-13/is-airtable-down-right-now-february-20-2026-47537 `[COMMUNITY/PRESS — official status-page entry should be verified manually before print]`
- StatusGator counts 172+ Airtable outages over ~6 years — https://statusgator.com/services/airtable `[PRESS — aggregator, cite as such]`
- **No publicly documented platform-wide customer data-loss incident.** Real-world loss is customer-side: automation bugs mass-overwriting fields, bases discovered deleted after the trash window, offboarding accidents. `[VENDOR blogs — attribute carefully]`
- Verified deprecations for the durability narrative: expiring attachment URLs (Nov 2022) `[OFFICIAL]`; legacy API keys shut off **Feb 1, 2024** `[OFFICIAL]`; legacy plan migrations (Plus/Pro → Team/Business) — https://support.airtable.com/docs/changes-to-airtable-plans `[OFFICIAL — verify dates before citing specifics]`.

---

## 2. The tool landscape & community evidence

### T-1. Backup tools (status mid-2026)

| Tool | What it does | Pricing (as published mid-2026) | Status |
|---|---|---|---|
| **On2Air Backups** | Scheduled exports (records, attachments, schema) to Dropbox/Box/Google Drive | $9.99 → $29.99 → $49.99 (daily) → $79.99/mo (hourly) | **Active** — now Openside/On2Air's only product; Schemas/Forms/Actions sunset |
| **ProBackup** | Daily backups + granular restore; 19+ SaaS apps, Airtable flagship | ~$25–29 → ~$47 → ~$88/mo | Active |
| **AirBackups** | Daily full backups to Google Cloud Storage; preserves record IDs | Flat per-base (EUR) | Active |
| **Export My Base** | Free one-shot export of all tables | Free | Active |
| **BackupTable** | Auto + manual table/base backups | — | **Possibly defunct** — DNS failed Jul 2026 |
| **Sequin** | "Airtable as Postgres" | — | **Shut down Oct 23, 2025** (acquired; acquirer unnamed) |
| OSS: Unly airtable-backups, airtable-pg-sync | Script-level dumps / Postgres mirror | Free | Community-maintained; Unly author: "unreliable backups at best" |

Sources: https://on2air.com/pricing/ · https://www.probackup.io/backup/airtable · https://airbackups.com/pricing · https://sequin.io/docs/shutdown `[OFFICIAL]` · https://www.producthunt.com/products/backuptable `[PRESS]`

**T-2. Structural ceiling for every third-party tool:** the public API exposes records, attachments, and schema metadata — **not automations, scripts, or interfaces** (N-7). Community consensus thread (Jun 2025): only native snapshots capture everything, and snapshots can't leave the platform — https://community.airtable.com/other-questions-13/looking-for-a-simple-backup-restore-solution-tables-automations-scripts-interfaces-45701 `[COMMUNITY]`

### T-3. Airtable → SQL / sync
- **Sequin** — the original SQL layer. Announced shutdown Aug 21, 2025; dissolved **Oct 23, 2025**; all customer data deleted at shutdown; official migration path was Stacksync. https://sequin.io/docs/shutdown `[OFFICIAL]`
- **Stacksync** — real-time two-way Airtable⇄Postgres/MySQL, SOC 2 Type II, sales-led pricing. https://www.stacksync.com/integrations/airtable-and-postgresql `[OFFICIAL]`
- **Whalesync** — two-way sync; Postgres starts at the **$249/mo** Operator tier (20k records; $599 unlimited). https://www.whalesync.com/pricing `[OFFICIAL]`
- **Coefficient** — Airtable→Sheets/Excel live sync (spreadsheet, not SQL). https://coefficient.io/integrations-google-sheets/airtable `[OFFICIAL]`
- **Native connectors:** Airtable Sync's Snowflake integration is **inbound only** (Snowflake→Airtable, Enterprise Scale, 100k-row cap). **There is no native outbound "dump my base to a warehouse."** https://support.airtable.com/docs/airtable-sync-integration-snowflake `[OFFICIAL]`
- ELT long tail: Fivetran (MAR pricing, widely considered expensive), Airbyte (OSS), Hevo, Rivery, Portable. BaseQL offers GraphQL (not SQL). `[OFFICIAL vendor pages]`
- **Takeaway:** since Sequin died, "query Airtable in SQL" means $249+/mo, sales-led pricing, or DIY ELT — a real gap at the prosumer/SMB price point.

### T-4. Schema documentation / visualization
- **On2Air Schemas** — generated ERDs + a change-history log of tables/views/fields (the closest thing to schema versioning that existed). **Shut down / closed to new registrations.** https://on2air.com/schemas/ `[OFFICIAL]`
- **Native "Base Schema" extension** — view-only diagram; no export, no doc generation, no change history; GitHub repo shows minimal activity. https://support.airtable.com/v1/docs/base-schema-extension `[OFFICIAL]`
- **AirMap** — community ERD tool, maintenance status unverified. https://community.airtable.com/show-and-tell-15/airtable-schema-mapping-tool-46926 `[COMMUNITY]`
- DIY practice (Feb 2026 thread — https://community.airtable.com/other-questions-13/how-do-you-document-your-airable-bases-47395): daily API scripts logging fields to a tracking table, Whimsical diagrams, AI-summarized schema diffs. One consultant: tracking *which automations use each field* is "the bit that's much harder to deal with" — automations are invisible to the API. `[COMMUNITY]`
- **Takeaway:** the schema-documentation category is effectively **vacant** — the one dedicated commercial tool shut down, the native extension is a read-only diagram, and practitioners hand-roll scripts.

### T-5 – T-13. Community pain evidence (citable)

**Accidental deletion / data loss**
- **T-5.** "HELP! I accidentally erased 140 records" (Apr 2021) — "The undo function isn't remedying it"; saved only by a lucky auto-snapshot. https://community.airtable.com/other-questions-13/help-i-accidentally-erased-140-records-9216 `[COMMUNITY]`
- **T-6.** "How do you restore a base after 7 days has passed?" (Jul 2022) — verdict: "Once the base is deleted, it is gone after seven days." https://community.airtable.com/other-questions-13/how-do-you-restore-a-base-after-7-days-has-passed-7858 · recurring 2023 variant: https://community.airtable.com/t5/other-questions/deleted-base-and-now-can-t-retrieve-it/td-p/170648 `[COMMUNITY]`

**Automation / sync destroying data**
- **T-7.** Synced tables: deleted source records mean "data entered in enriched columns would be irrecoverably lost" and deletions "cause lookups, rollups, filters, and automations to break." https://community.airtable.com/t5/other-questions/3-issues-with-leaving-deleted-records-in-a-sync-table/td-p/120225 `[COMMUNITY]`
- **T-8.** Airtable's own troubleshooting doc concedes the pattern — disappearing records are often an automation "that triggers 'when a record is created/updated' and then deletes the record or clears fields." https://support.airtable.com/docs/troubleshooting-airtable-automations `[OFFICIAL]`
- **T-9.** Restoring from trash "will trigger automations for BOTH 'new records' AND 'updated records'" with inconsistent created/modified times — recovery itself can fire destructive automations. https://air.tableforums.com/t/unexpected-behaviors-when-restoring-records-from-an-airtable-snapshot/944 `[COMMUNITY]`

**Schema changes breaking things**
- **T-10.** Field references in Zapier silently changed form, breaking live Zaps. https://community.airtable.com/t5/other-questions/changes-in-field-identification-with-zapier/td-p/95652 · Zapier's own "Common Problems with Airtable": https://help.zapier.com/hc/en-us/articles/8496011037453 `[COMMUNITY/OFFICIAL]`

**Snapshot / history frustration**
- **T-11.** The canonical thread — "Airtable Backup & Recovery Strategies: Simply, a Nightmare" (Bill French, Nov 2019): "There is no approach or best practice to protect this huge intellectual layer and investment"; "Never rely on ANY aspect of the SaaS platform to recover and restore ANY of the data." https://community.airtable.com/other-questions-13/airtable-backup-recovery-strategies-simply-a-nightmare-10423 `[COMMUNITY]`
- **T-12.** Snapshot-restore product-idea thread (Jun 2022 → May 2024): restore creates a new base with new record IDs and share links — "All 3rd-party tools need to be completely reconfigured all over again from scratch." https://community.airtable.com/legacy-product-ideas-75/restoring-a-snapshot-overwriting-the-current-base-43137 `[COMMUNITY]`

**The perennial ask**
- **T-13.** "Looking for a simple backup & restore solution (tables, automations, scripts, interfaces)" (Jun 2025) — consensus: you can't. https://community.airtable.com/other-questions-13/looking-for-a-simple-backup-restore-solution-tables-automations-scripts-interfaces-45701 · perennial variants: https://community.airtable.com/other-questions-13/database-backup-19411 · https://community.airtable.com/other-questions-13/save-backup-19576 · https://community.airtable.com/other-questions-13/export-all-airtable-data-including-files-keeping-file-record-relation-19444 `[COMMUNITY]`

> **Gap:** no directly linkable Reddit r/Airtable citations could be obtained (Reddit blocks fetching; search indexing thin). All pain evidence is from Airtable Community, TableForums, Zapier Community, and consultant blogs.

### T-14. Consultant / agency ecosystem
- Airtable runs a formal **Services Partner Program** (accreditation, tiers incl. "Gold Services Partner," Partner of the Year awards, public directory). https://ecosystem.airtable.com/consultants · https://www.airtable.com/partners `[OFFICIAL]`. **No published partner total** — 40+ Gold partners visible in the directory; defensible claim: "dozens of accredited partners plus a longer tail of independents."
- Consultants publicly discuss backup practice, and it's defensive/manual — "best practice to manually create your own snapshot before & after making any important changes" (ScottWorld, repeated forum advice); agency backup guides from Ace Workflow, Views And Bases, On2Air. `[COMMUNITY/VENDOR]`

### T-15. SaaS-backup category precedents (the economic pattern)
- **Salesforce → Own Company (ex-OwnBackup): acquired by Salesforce for $1.9B cash** (announced Sep 5, 2024; closed Nov 2024) — Salesforce's largest deal since Slack. Own had raised ~$500M, peak valuation $3.3B (2021). https://www.salesforce.com/news/press-releases/2024/09/05/salesforce-signs-definitive-agreement-to-acquire-own-company/ · https://techcrunch.com/2024/09/05/salesforce-acquires-data-management-firm-own-for-1-9b-in-cash/ `[OFFICIAL/PRESS]`
- **Rewind** (Shopify/QuickBooks/GitHub): $65M Series B (Insight Partners, Jan 2022); claims 25,000+ organizations. https://www.insightpartners.com/ideas/rewind-closes-usd-65-million-series-b-as-demand-for-cloud-backup-and-recovery-solutions-continues-to-grow/ `[PRESS]`
- **Backupify** → Datto (2014) → Kaseya (2022) as Datto SaaS Protection; AvePoint Cloud Backup (public company) for M365. `[OFFICIAL/PRESS]`
- Pattern: platform matures → data becomes mission-critical → backup/DevOps vendor category emerges → strategic exits.

### T-16. Shared-responsibility & SaaS data-loss stats (handle with care — mostly vendor-sourced)
- Shared responsibility model: vendor owns uptime; **customer owns data protection and recovery.** https://rewind.com/shared-responsibility/ · https://www.cpomagazine.com/cyber-security/are-you-aware-of-the-shared-responsibility-model-the-saas-data-loss-risk-you-might-not-know-youre-taking/ `[VENDOR/PRESS]`
- Gartner: "through 2025, 99% of cloud security failures will be the customer's fault" — **secondhand via vendor content**; attribute as "Gartner, as cited by…" `[VENDOR]`
- "79% of IT professionals mistakenly believed SaaS apps include backup/recovery by default; 85% of organizations reported at least one data-loss event in the prior 12 months" — vendor aggregations (SaaS Assure, ExpertInsights); **verify original survey before print.** `[VENDOR]`
- Cause-of-loss splits (directional): malicious deletion ~25%, accidental deletion ~20%, service outages ~22%; "human error accounts for almost one-third." `[VENDOR]`
- SaaS backup market size: ~$2.5B (2023) → ~$4.8B by 2030 (QYResearch) vs. a divergent $10.5B (2024) → $23.1B (2033) (Verified Market Reports) — **analyst figures conflict; cite a range or omit.** `[PRESS — low-to-medium confidence]`

---

## 3. Category analogs & benchmark precedents

### A-1. Gearset's "State of Salesforce DevOps" — the playbook
- **Annual since 2021** (published each Q1 from a Nov–Jan survey). Editions verified 2021–2026: https://gearset.com/blog/the-state-of-salesforce-devops-2021/ · https://gearset.com/devops-report/2024/ · https://gearset.com/devops-report/2025/ · https://gearset.com/devops-report/2026/ `[OFFICIAL]`. No pre-2021 edition verifiable.
- **Copado runs a competing report with the identical name** (its "second annual" was Feb 2021) — two vendors fighting over the same report title is itself a category-creation data point. `[PRESS]`
- Respondents: 2023 **1,254**; 2024 **1,296** (32% Gearset users); 2025 **464** quality-controlled (65% Gearset users); 2026 **522** (48%). Gearset discloses its own-user share each edition — **the disclosure pattern to copy** for our methodology note. `[OFFICIAL, vendor survey]`
- Distribution playbook: "biggest survey in the ecosystem" positioning, community participation drives (Salesforce Ben), gift-card draw incentive, then year-round derivative content — webinars, industry cuts, conference talks. `[OFFICIAL/PRESS]`
- Commercial payoff: Gearset took a **$55M growth investment** (Silversmith, Jun 22, 2022) after six bootstrapped years, at ~1,700 customers. https://www.businesswire.com/news/home/20220622005165/en/ `[PRESS]`

### A-2. Citable Gearset/Copado stats
1. **86%** of Salesforce teams have adopted or plan to adopt version control (Gearset 2024). `[OFFICIAL, vendor survey]`
2. **81%** adopted/planning CI/CD (Gearset 2024). `[OFFICIAL, vendor survey]`
3. **87% back up their Salesforce orgs or plan to in 2024; only 13% have no backup plans** (Gearset 2024). **The single most important analog stat — backup as a named pillar of a DevOps report.**
4. **Backup was the single most-adopted DevOps process at 70%** (Gearset 2025).
5. **Data-loss incidence: 65%** of teams had ≥1 data/metadata loss incident (2024 report), **67%** (2023), **47%** (2025) — year definitions shift; don't chart as one series without a caveat.
6. Teams releasing daily nearly doubled YoY; 61% keep lead time under a week (Gearset 2024).
7. Consolidated-toolset teams deploy 5× faster (Gearset 2025 — self-serving framing, flag it).
8. 98% recognize ROI from Salesforce DevOps; only 50% have calculated dollar returns (Gearset 2026).
9. **Copado 2021** (n≈230): mean recovery from a failed change rose 110h (2019) → **196 hours** (2020); change failure rate 23% → 33%. https://www.prweb.com/releases/new-research-shows-increased-velocity-and-virtual-development-create-fresh-challenges-for-salesforce-delivery-teams-in-2020-886677740.html `[PRESS, vendor survey, small n]`
10. **Copado 2021 DORA-style segmentation:** elite Salesforce teams deploy **46× more frequently, 30× shorter lead times, 5× lower change-failure rate, 37× faster recovery** than low performers — precedent that DORA's four keys translate to a SaaS/low-code platform.
- ⚠️ A widely-remembered "Gearset says X hours lost per failed deployment" stat **does not exist** — don't invent one.

### A-3. Salesforce DevOps market economics (the endgame)
- **Salesforce acquired Own Company for ~$1.9B cash** — announced Sep 5, 2024, closed FY-Q4 2025; largest Salesforce deal since Slack; ~7,000 customers. SEC 8-K: https://www.sec.gov/Archives/edgar/data/1108524/000110852424000024/a090524-ex991pressrelease.htm `[OFFICIAL — SEC filing]`
- OwnBackup peak: $240M Series E at **$3.35B valuation** (Aug 2021); ~$500M raised total. The $3.35B peak vs $1.9B exit is a fair ZIRP-haircut caveat. `[PRESS]`
- **Copado**: $140M Series C (Sep 2021) at ~$1.2B; Salesforce Ventures participated. `[PRESS]`
- IDC's $18B total-DevOps TAM (via Copado's release) `[VENDOR citing analyst — MEDIUM]`. **No Gartner/IDC number exists for "Salesforce DevOps" as a named market** — the ~$250M software / $5B services split is a one-person analyst model (salesforcedevops.net), directional only.

### A-4. Power Platform ALM — "low-code grows up"
- Microsoft maintains formal **ALM guidance** for Power Platform (environments, source-controlled solutions, managed solutions): https://learn.microsoft.com/en-us/power-platform/alm/ `[OFFICIAL]`
- **Pipelines** exist explicitly to "democratize ALM… bringing CI/CD capabilities into the service in a manner that's more approachable for all makers, admins, and developers" — https://learn.microsoft.com/en-us/power-platform/alm/pipelines `[OFFICIAL — direct quote, good epigraph material]`
- **CoE Starter Kit** (governance toolkit) → Microsoft stopped monthly updates Feb 2026, folding governance into the first-party admin center — community tooling → sanctioned toolkit → native platform capability. `[OFFICIAL/PRESS]` (Adoption counts unverifiable — don't cite a number.)
- Scale: Power Platform MAU **33M (FY2023) → 48M (FY2024) → 56M, +27% YoY (FY2025)** per Microsoft earnings (secondary reporting — cite as "per Microsoft earnings reports"). `[PRESS]`
- Microsoft also publishes a staged **adoption maturity model** (Level 100→500) — direct precedent for a staged low-code maturity ladder. URL to verify before citing: learn.microsoft.com/en-us/power-platform/guidance/adoption/maturity-model-details `[UNFETCHED — verify]`

### A-5. DORA / Accelerate — the maturity-model precedent
- First State of DevOps survey 2012 (Puppet + Gene Kim), 4,000+ respondents; *Accelerate* published 2018; Google acquired DORA Dec 2018; continues as Google Cloud's Accelerate State of DevOps Report. Cumulative reach **32,000+ professionals**. https://dora.dev/guides/dora-metrics-four-keys/ `[OFFICIAL/PRESS]`
- **Four keys:** deployment frequency, lead time for changes, change failure rate, failed-deployment recovery time — two throughput, two stability.
- **DORA segments respondents into Low / Medium / High / Elite** — the direct precedent for **Ad hoc → Aware → Managed → Engineered**. Cluster thresholds shift by edition; cite a specific year when quoting cutoffs.
- Other "State of X" scale markers: State of JavaScript 2024 **14,015** responses; State of CSS 2023 **9,190**; HackerOne report annual since 2017, mixes **platform telemetry + survey** — a pattern BaseOut could copy (product data + survey) that nothing in the Airtable ecosystem does.
- Standard structure across all: methodology/demographics up front → maturity segmentation → YoY benchmarks → topic-of-the-year chapter → prescriptive recommendations → year-round derivative content.

### A-6. Backup/DR discipline stats
- **58% of backups fail** (error out, overrun window, or miss restore SLA) — Veeam Data Protection Trends 2021, n=3,000. The canonical "your backup probably doesn't work" stat. https://www.veeam.com/company/press-release/cxo-research-58-percent-of-data-backups-are-failing-creating-data-protection-challenges-and-limiting-digital-transformation-initiatives.html `[OFFICIAL, vendor-sponsored]`
- Only **55%** of ransomware-encrypted data was recoverable — Veeam DPT 2023, n=4,200. `[OFFICIAL, vendor-sponsored]`
- **73% of SaaS data loss stems from internal incidents** (accidental deletion, failed integrations, bad deployments), not external attack — Enterprise Strategy Group via Flosum `[VENDOR relay — locate original ESG report before headline use]`
- "~Half of businesses test DR once a year or less" / "30–40% of never-tested backups fail at recovery" — **no traceable primary study**; use only as "industry surveys repeatedly find…" or drop. `[UNVERIFIED]`
- Downtime cost: **$5,600/minute** — Gartner (Andrew Lerner), **2014** — cite with the year. `[OFFICIAL, dated]`
- **RTO/RPO** is the standard DR vocabulary (Veeam DPR series) — frame the maturity stages in RTO/RPO terms; no single canonical stat needed.
- ⚠️ **Never use** "93% of companies that lose data for 10+ days go bankrupt" — 1990s on-prem provenance, widely debunked.

### A-7. Low-code market growth — "citizen apps become mission-critical"
- **By 2025, 70% of new enterprise applications will use low-code/no-code, up from <25% in 2020** — Gartner press release, Dec 13, 2022: https://www.gartner.com/en/newsroom/press-releases/2022-12-13-gartner-forecasts-worldwide-low-code-development-technologies-market-to-grow-20-percent-in-2023 `[OFFICIAL — primary Gartner]`
- Low-code technologies market **$26.9B in 2023, +19.6% YoY** — same release. `[OFFICIAL]`
- **By 2026, developers outside formal IT will be ≥80% of low-code users, up from 60% in 2021** — same release. **The "citizen developers are the majority" cornerstone.** `[OFFICIAL]`
- ~$44.5B by 2026 (Gartner via InfoWorld) `[PRESS]`; $58.2B by 2029 at 14.1% CAGR (Gartner via vendor blogs) `[VENDOR relay — verify against Gartner abstract]`
- **Narrative spine for the report:** Gartner 70%/80% forecasts + Power Platform MAU curve → citizen-built apps are production infrastructure → Microsoft answered with ALM (A-4), Salesforce's ecosystem monetized the maturation at $1.9B (A-3) → **Airtable sits at the same inflection with no equivalent report — the white space this report claims.**

---

## 4. How the evidence maps to the report

| Report element | Evidence |
|---|---|
| "Snapshots are availability tooling, not backup" argument | N-1, N-3, T-11, T-12 |
| "The API can't export automations/interfaces" (why intelligence-layer capture matters) | N-7, T-2, T-13 |
| Shared-responsibility framing (Airtable says back up your own data) | N-8, T-16 |
| Schema-visibility vacuum (validates survey Section D / D5 matrix) | N-5, T-4, T-10 |
| SQL-access gap post-Sequin (validates E3) | T-3 |
| Data-loss anecdote color (pairs with C2/C3 results) | T-5–T-9 |
| Category-creation playbook + report structure | A-1, A-2, A-5, T-15 |
| Maturity-model grounding (Ad hoc → Aware → Managed → Engineered) | A-5, A-2 (#10), A-4 |
| "Backup is a DevOps pillar" + data-loss incidence benchmarks | A-2 (#3–5), A-6 |
| "Citizen apps are production infrastructure" macro framing | A-7, A-4, N-9 |
| Market-scale framing | N-9, T-16 (with caution) |

---

## 5. Do-not-print list (corrections & traps)

1. **Snapshots DO capture automations, interfaces, extensions, and comments** — never claim they don't. The true gaps: whole-base-only restore into a *new* base (new record IDs/share links), no revision history in the restored base, plan-gated retention, cannot be exported off-platform.
2. **Revision history: Business = 2 years** (not 1). Free 2wk / Team 1yr / Business 2yr / Enterprise Scale 3yr (→10 via policy).
3. **"80% of the Fortune 100"**, not Fortune 500.
4. **Airtable IPO/S-1: conflicting sources, no Reuters/Bloomberg confirmation — do not print.**
5. **"BaseBackup" and "BaseDNA" do not exist** (likely misremembered names). **Airboxr** is not an Airtable backup tool (it's Shopify/DTC analytics).
6. **Sequin's acquirer is publicly unnamed** — don't speculate.
7. Gartner 99% stat and the 79%/85% survey stats are secondhand vendor citations — verify originals or attribute the chain explicitly.
8. Kanban-view / scripting-automation "deprecations" that surface in search come from **miniExtensions'** changelog, not Airtable — do not attribute to Airtable.
9. Trash is **7 days at base level** but **30 days for deleted bases** (30–180 on Enterprise Scale) — don't flatten to "7 days" without the qualifier.
10. All pricing figures are as-published mid-2026 and change often — re-verify before print.
11. Per the repo guardrails: **no unreleased BaseOut pricing/tier names** anywhere in the report, and claims about BaseOut itself must track shipped status (GTM doc §6.5).
