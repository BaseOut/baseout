## ADDED Requirements

### Requirement: Windowed report assembly

The system SHALL assemble, for the window since the last successful non-ad-hoc report (first report: since the first backup), a versioned JSON report document with four sections — backup summary (runs, per-base outcomes, volumes, every failure/skip with error detail), connection health, schema health (score + delta + issues + schema changes), and documentation updates — where empty sections carry an explicit clean status. Entity references SHALL be typed (`{kind, id, label}`), never prose. Manual generation MAY override the window; overridden runs are marked ad-hoc and do not advance the window chain. Failed generations SHALL NOT advance the chain.

#### Scenario: Report after a failed backup

- **WHEN** the window contains a backup run with per-entity failures
- **THEN** the backup summary lists the run as failed with each entity error, and the other sections still assemble

### Requirement: Report schedules

Users SHALL be able to create multiple schedules per Space with cadence `after_backup | daily | weekly | monthly` (+ time/day), recipient emails (validated server-side, capped per schedule), artifact formats (PDF attachment and/or HTML link), and an enabled flag. Due schedules SHALL generate a report and deliver it; `after_backup` SHALL debounce so one completion burst produces one report.

#### Scenario: Weekly schedule fires

- **WHEN** a weekly schedule's next_run_at passes
- **THEN** a report generates for the window since the last report and delivery starts to all recipients

### Requirement: HTML and PDF artifacts

Every report SHALL be renderable to self-contained HTML and print-faithful PDF from the same JSON document, with typed refs resolved to app deep-links (destination refs to the external storage location). Artifacts SHALL be stored Space-scoped with downloads authorized web-side.

#### Scenario: Artifacts match the document

- **WHEN** a report renders to HTML and PDF
- **THEN** both contain the same sections, figures, and links as the JSON document

### Requirement: Email delivery with per-recipient status

Delivery SHALL send via the product's transactional email path (not the marketing stack) with per-recipient sent/failed status (+ error) recorded on the report run and surfaced via the API. A delivery failure SHALL NOT change a completed report's status; failed recipients SHALL be re-sendable.

#### Scenario: One recipient bounces

- **WHEN** delivery succeeds to one recipient and fails to another
- **THEN** the run records sent for the first, failed with error for the second, and the report remains complete

### Requirement: Report API

The engine SHALL expose INTERNAL_TOKEN-gated routes for report list/detail (the JSON document), generate-now with optional window override, schedule CRUD, and artifact URL resolution; scheduled-delivery configuration SHALL be capability-gated via the resolver, and all recipient input validated server-side.

#### Scenario: Below-tier schedule rejected

- **WHEN** a Space without the scheduled-reports capability attempts to create a schedule
- **THEN** the API rejects it and manual generate/view remains available per its own gate
