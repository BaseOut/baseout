# Design — Per-Space setup wizard + empty state

## The flow order (founder + our edge analysis)
Source → Bases → Destination → Options → Review. The user's mental model is "where from → which data → where to → how deep / how often → confirm". One Source per Space (founder-confirmed); a Space fans out to one file destination + an optional database.

## Empty-first, inline creation (drawer)
The biggest risk in a "pick from account objects" flow is the first-ever user with nothing to pick, plus anyone wanting a custom object — naively that means leaving to the Sources/Destinations page and navigating back, losing wizard state. Instead:
- A step with no options shows a focused "connect your first…" card; its button opens a **right-hand slide-over drawer** (chosen over inline-expand so a long form / many options don't push the step's content far down).
- The drawer reuses the same create form as the standalone add page. On success the object is created at the account level **and** auto-selected in the step; the wizard page never unmounts.
- Honest constraint: OAuth providers must visit their own consent screen — in the real app that's a **popup** (page stays mounted), not a full-page redirect; key/credential methods are fully inline. The prototype simulates the create client-side.

## Two modes, one component
- **setup** (`mode="setup"`, first run): a gated **stepper** — steps unlock in order, the Bases step gates Next until ≥1 base, the last step is "Run first backup". Source/Destination start empty (created inline).
- **edit** (`mode="edit"`, via Configure): a **free tab bar** (no gating, jump anywhere), no Review step, pre-filled with the current config, primary action "Save changes". Restores the edit-tabs behaviour of the earlier `IntegrationsConfigureView.tabs.astro`.

Both share the same panels, drawers, and create logic; only the nav + footer differ. (Changing the Source invalidates the base selection — decided, surfaced in edit later; not modelled in this prototype because harness bases are source-agnostic.)

## The unconfigured Overview as the model
Rather than a list of steps, the empty Space is drawn as the Airbyte-style pipeline: **Source anchor (Airtable, hub-sized + labelled) → Space hub (its name) → Destinations column** (Drive / Dropbox / S3 / a generic DB glyph). Dashed connectors take turns lighting up (restrained; `prefers-reduced-motion` safe). One CTA opens the wizard. This teaches the model before the user commits.

## Configured pipeline connector
The configured/running Overview shows the pipeline cards joined by a **status connector**: a coloured line + badge — green check when healthy ("connected & flowing"), amber triangle when a Source/Destination is broken. It reads as "all set" at a glance and mirrors the empty-state diagram's schematic feel.

## Status
EXPERIMENT on branch `experiment/nav-restructure`; pending client review before merge to `main`.
