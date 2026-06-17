## Why

With Sources and Destinations now account-level (see `shared-sources`, `shared-destinations`) and a Space repurposed into its backup **Overview** (`web-nav-ia-restructure`), the per-Space setup needed rebuilding. The old Configure had no Source step (it predated account Sources) and embedded account-level connection management that now lives on the Source. We rebuild the per-Space setup as a left-to-right wizard that references account objects, and redraw the unconfigured Space as the product model itself.

## What Changes

- **The unconfigured Space Overview becomes a teaching diagram** (Airbyte-style): a Source anchor (Airtable) → the Space hub → a Destinations column (Drive / Dropbox / S3 / databases), with one CTA. It replaces the old four-step list card.
- **A per-Space setup wizard** with a left-to-right flow: **Source → Bases → Destination → Options (depth + schedule) → Review → Run first backup**. It references account Sources/Destinations rather than connecting platforms from scratch.
- **Empty-first, no context loss**: when the account has no Source/Destination yet, the Source and Destination steps open a "connect your first…" card whose button opens a **right-hand drawer** that creates the object inline; on success the new object is auto-selected and the wizard never unmounts. (OAuth uses a popup in the real app; key-based methods are fully inline.)
- **Two modes**: **setup** (first run) is a gated stepper ending in "Run first backup"; **edit** (reached via the overview's Configure) is **free tabs** that jump in any order, pre-filled with the current config, ending in "Save changes". No Review/Run step in edit.
- **The configured Overview pipeline** shows a status connector between cards — a green check when the backup is healthy, a warning when paused.

## Capabilities

### Modified Capabilities
- `integrations`: the per-Space page gains the unconfigured pipeline diagram, the setup-wizard flow (setup + edit modes), inline drawer creation of Sources/Destinations, and the status-connector pipeline.

## Impact

- apps/web: new `IntegrationsSetupWizard.astro` (the wizard, both modes) and `SpacePipelineHero.astro` (unconfigured diagram); `SpaceOverviewView.astro` swaps the four-step card for the diagram and replaces pipeline arrows with status connectors; new `public/brands/*` (Drive/Dropbox/AWS marks).
- apps/design harness: `configure.astro` derives mode from `?first=1` (setup, empty) vs default (edit, seeded); `integrations.astro` passes the wizard-created names to the running overview.
- **EXPERIMENT on branch `experiment/nav-restructure`** — built + `astro check` green; pending client review with `web-nav-ia-restructure`.
