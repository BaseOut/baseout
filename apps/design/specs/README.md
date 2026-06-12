# Baseout — UI Specs for Designer Review

This folder is your map. Each file describes one screen (or one
cross-cutting concern) — what it does, who uses it, what's on it,
what state variants exist, and what we're trying to accomplish.

**These specs are informational.** They are *not* implementation
instructions for an AI builder. The goal is to give you the context
to make confident design decisions: why the page exists, what the
user is trying to do when they land on it, and what we already have
working.

---

## How to use these specs

1. Boot the preview app: `pnpm install && pnpm design` →
   <http://localhost:4332>.
2. Read this index, then `00-design-principles.md`, then
   `01-naming-and-hierarchy.md`. Together they cover the cross-cutting
   concerns that apply to every page.
3. Pick one page spec at a time. Open both the spec and the live
   page side by side. The spec tells you what the page is *for*; the
   live preview shows what we have *today*.
4. Edit the corresponding source files in `apps/web/src/`. Most
   pages are composed from `apps/web/src/views/*` + components in
   `apps/web/src/components/{ui,layout,backups}/`.
5. Push to your fork. The Baseout engineering team merges your work
   into the full monorepo.

---

## Suggested review order

The order below moves from infrastructure outward: shell first, then
auth flows, then onboarding, then the core product. If you only have
time for a few, do **shell + dashboard + integrations** — those are
where users spend 90% of their time.

| # | Spec | Live URL | What it covers |
|---|---|---|---|
| 00 | [Design principles](00-design-principles.md) | n/a | The "utility admin tool" stance, what Baseout is *not*, brand direction |
| 01 | [Naming & hierarchy](01-naming-and-hierarchy.md) | n/a | Organization → Space → Connection → Base. Words to use, words to avoid |
| 02 | [App shell — sidebar, top bar, switcher](02-shell-sidebar-topbar.md) | every page | The chrome wrapping every page. Sidebar nav, space switcher, theme toggle, profile dropdown |
| 03 | [Login](03-login.md) | `/login` | Magic-link sign-in (no password) |
| 04 | [Register](04-register.md) | `/register` | Account creation (also magic-link) |
| 05 | [Welcome — onboarding](05-welcome.md) | `/welcome` | Single-form onboarding wizard for first-time users |
| 06 | [Dashboard](06-dashboard.md) | `/` | The session entry point. Status, next step, backup history at a glance |
| 07 | [Integrations](07-integrations.md) | `/integrations` | Connect Airtable, pick bases, choose schedule, choose storage, run first backup |
| 08 | [Backups](08-backups.md) | `/backups` | Run-now CTA + full backup history with cancel/delete actions |
| 09 | [Restore](09-restore.md) | `/restore` | Restore a backup snapshot back into Airtable. **Placeholder today** |
| 10 | [Schema](10-schema.md) | `/schema` | Schema visualization + change log + health score. **Placeholder today** |
| 11 | [Reports](11-reports.md) | `/reports` | Usage analytics + activity reports. **Placeholder today** |
| 12 | [Settings](12-settings.md) | `/settings` | Account / Organization / Space settings hub |
| 13 | [Profile](13-profile.md) | `/profile` | Personal profile — avatar, name, email |
| 14 | [Help](14-help.md) | `/help` | Docs + support entry point. **Placeholder today** |
| 15 | [Not found](15-not-found.md) | `/404` and `/<anything>` | Empty-route fallback |

---

## State variants — preview different data without editing fixtures

Add `?fixture=...` to any page URL to swap the underlying data:

| Query              | When to use it                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| *(none)*           | Default — fully-onboarded user, real-looking dashboard                  |
| `?fixture=empty`   | Zero state — no connections, no bases, no backup runs                   |
| `?fixture=failed`  | Backup history populated with a single failed run                       |
| `?fixture=trial`   | Pre-onboarding — no org, no space. Pair with `/welcome` to see onboarding |

Examples:

- `http://localhost:4332/?fixture=empty` — "first login, nothing
  configured" dashboard
- `http://localhost:4332/integrations?fixture=empty` — "before
  Airtable is connected" Integrations page
- `http://localhost:4332/welcome?fixture=trial` — onboarding form for
  a brand-new user

Many page specs list which fixtures are most useful for designing
that page.

---

## What "we" want vs. what "we" have

Each spec separates **purpose / user goal** (what we want this page
to accomplish) from **today's implementation** (what's actually
rendered when you load the preview). Where the two diverge, the spec
calls out the gap so you know where you have design freedom and
where you're working against an existing pattern.

Pages marked "Placeholder today" are intentionally empty — they
exist in the navigation but their content has not been designed yet.
Those are the highest-value pages to work on.

---

## What's out of scope for this review

These exist in the product spec but are **not** part of V1, and not
worth designing yet:

- AI / MCP / RAG (Capability 6 — V2+)
- Governance (Capability 8 — V2+)
- Multi-Platform Spaces (Notion / HubSpot / Salesforce)
- Admin / `/ops` staff console
- Embedded Airtable extension mode (V2)
- Real-time WebSocket backup progress UI (V2)
- Direct SQL REST API console (Business+ tier feature, separate surface)

If you have ideas for any of these, jot them down and pass them to
the engineering team — but don't sink design hours into them yet.
