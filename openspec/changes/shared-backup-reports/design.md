# shared-backup-reports — Design

## One structured document, three renderers

The generator produces a **versioned JSON report document** (`schemaVersion`, header, four sections, typed entity refs). The web view, the HTML export, and the PDF all render from it; the emailed artifact can never disagree with the in-app view. The interactive view renders in web; HTML + PDF render in the engine Worker (Browser Rendering binding — no workflows leg). Typed refs (`{kind, id, label}`) — never prose parsing — drive clickability (web: sidebar/detail; exports: app deep-links; destination refs: the external storage URL).

## Window math

Chain per Space: `period_start = previous non-ad-hoc report's period_end` (first report: first backup's start), `period_end = generation time`. `ad_hoc` runs (explicit window override) never advance the chain. Pure function + unit tests: first-report, normal advance, ad-hoc no-advance, overlapping manual + scheduled runs (row-level guard: one `generating` per Space, mirroring the backup-run uniqueness pattern).

## Section builders (pure, engine)

Each section builder takes `(window, rows)` → section JSON:

- **Backup summary**: runs in window from master `backup_runs` (+ per-entity audit detail), per-base outcomes, volumes, every failure/skip with its error text.
- **Connection health**: connection status transitions in-window (invalid/reconnect events); current status. Sourced from the connections table + status-change audit (if transition history is thinner than desired, report current status + failures observed by runs — note the gap in the section rather than inventing history).
- **Schema health**: latest `bo_at_health_scores` snapshot + delta vs the window start, notable `bo_at_health_issues`, schema changes in-window from `bo_at_schema_updates`.
- **Docs updates**: `bo_at_documents` created/updated in-window (title, editor, ref).

Empty sections emit `{status: "clean"}` — renderers show "no issues", never omit.

## Scheduling

- `daily|weekly|monthly` evaluate on the existing per-Space scheduler tick (SpaceDO alarm/cron): compute `next_run_at` on save; tick fires due schedules → insert `report_runs(generating)` → enqueue.
- `after_backup` hooks the existing run-completion path (where the run row flips to a terminal state) — debounced per Space (one report per completion burst, e.g. 10-min window) so multi-base runs don't send N emails.
- Cadence math is pure + unit-tested (DST/day-of-week edges).

## Render + deliver (engine Worker)

- **HTML**: one self-contained template (inline CSS, no external assets) shared by "HTML export" and the email body shell — a pure module, snapshot-tested.
- **PDF**: **Cloudflare Browser Rendering** from the engine Worker — `@cloudflare/playwright` over the wrangler `browser` binding: launch → `page.setContent(html)` → `page.pdf()` with print CSS + page headers/footers (Space, window, page N). Isolated behind `renderPdf(html)` (unit tests mock it; the deployed smoke exercises the real binding — Browser Rendering doesn't run under local Miniflare the same way, so treat it as `--remote`-verified). Mind the platform quotas: Browser Rendering has per-account concurrent-session and time limits — reports render one-at-a-time per Space and retry on session-limit errors; big-Space reports paginate sections rather than growing unboundedly.
- **Artifacts** stored to managed storage (R2) under a Space-scoped prefix; `report_runs.artifact_*` records locations; downloads authorized web-side.
- **Deliver** (engine, same request chain as render or a follow-up alarm): per-recipient send via the product transactional email path (Cloudflare Email binding — same rail as magic links; NOT the marketing Mailgun stack), PDF attached (MIME multipart) and/or HTML link per schedule config; per-recipient `{sent|failed, at, error}` recorded onto `report_runs.delivery`. Recipient cap per schedule (e.g. 10). If PDF size exceeds the email attachment limit, fall back to the HTML-link form and note it in delivery status. Every scheduled email footer states which schedule sent it and links to manage it (the courtesy-unsubscribe path for non-account recipients — full recipient-level unsubscribe is a follow-up if reports go to non-users at scale).

## Failure semantics

Generation failure → `report_runs.status = failed` + error, surfaced on the list; the *next* window still starts at the last **successful** period_end (failed runs don't advance the chain — no silent coverage gaps). Delivery failure with a rendered report → report stays `complete` with per-recipient failure recorded; retry = a bounded DO-alarm retry on transient render/send errors (incl. Browser Rendering session-limit errors), then manual re-send from the UI.

## Capability gating

Manual run + in-app view vs scheduled email delivery are separate capability checks (schedule endpoints reject below-tier writes server-side). Final tier mapping comes from Features §5.5 metadata — the API only asks the capability resolver.
