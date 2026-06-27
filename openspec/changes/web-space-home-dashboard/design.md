# Design notes — Space Home is the dashboard

## The dashboard-vs-config tension, resolved
The reflex "dashboards display, they don't configure" is a property of **analytics**
dashboards (the data is external; you only observe). Baseout is a **control plane**: the
backup pipeline is the Space's primary object, and operational tools (Vercel, Airbyte,
Fivetran, GitHub) routinely show status and afford control on the same surface. Airbyte
— whose IA this product adopted (Space = Connection) — puts the source→destination,
sync history, and config on one Connection page. So Home showing **and** entering the
pipeline is the correct pattern, not an anti-pattern.

The guardrail it implies: Home shows the pipeline as a **compact status object with an
entry into editing**; the heavy configuration lives in a focused flow
(`/integrations/configure`). Home leads with status; in steady state the configure
affordance recedes.

## One component, two modes
The pipeline section is a single component rendered in two modes by config status:
- **Empty** → there is nothing to monitor, so Home's job is to lead to setup
  (`SpacePipelineHero` diagram + "Set up backup").
- **Populated** → the same pipeline leads with status ("Everything's backed up", last /
  next run) and the configure affordance is present but quiet.

First-backup-running and edit-saved are short-lived confirmation states layered on the
populated mode (a banner + an adjusted status line), not separate pages.

## State ownership (where each old-Overview state went)
| Old Overview state | New home |
|---|---|
| empty / not set up | **Home** (`?fixture=empty`) — setup diagram |
| healthy / protected | **Home** (`/`) |
| paused (broken Source/Dest) | **Home** (`?broken=src|dest|both`) — paused header + Reconnect |
| first backup running | **Home** (`?status=running`) |
| edit saved | **Home** (`?status=saved`) |
| reauth / invalid / refreshing | **Sources / Destinations** (account scope) + the wizard reconnect |
| nobases / capped | the **setup wizard** (base selection) |

Connection diagnostics are account-scoped because Sources and Destinations are reusable
across Spaces; a Space only shows the *consequence* (paused) and links out to the fix.

## Layout — two-region "primary + rail" (2026-06-17, client-chosen)
The configured Home splits into two regions to kill the "everything in a pile" feeling and
give a sense of control:
- **LEFT (≈2/3) — the user's backups:** a metrics strip (Bases protected · Records ·
  Attachments · Backups run) above two tables, **Backup history** and **Schema**. A clean
  ledger of what happened.
- **RIGHT (340px, sticky) — the status rail (control panel):** the health block
  (Everything's backed up · last/next · Run backup now) at the top, then the backup
  **pipeline drawn vertically** (Source → bases → Destination),
  then **Usage** bars. One cohesive "my status" panel, set apart by a subtle `base-200`
  fill + border (no nested cards, no side-stripe).
  The vertical pipeline reinforces "everything works": each node carries a connection
  status chip top-right (Source **Connected** · Backs up **Active** · Destination
  **Connected**; when paused the broken object flips to amber **Reconnect** and the middle
  to **Paused**), and the connectors carry a green check badge.

Chosen from a 4-way lab (`/home-lab`, since removed): health-in-rail vs full-width-banner ×
metrics-above-tables vs metrics-in-rail. Client picked **health in rail + metrics above the
tables**. The not-set-up, paused, first-backup-running and edit-saved states keep their
treatments: empty stays a full-width setup hero (no split); paused turns the rail health
amber + Reconnect; running shows a spinner + "First backup running" in the rail and a
confirmation banner; saved shows a saved banner.
