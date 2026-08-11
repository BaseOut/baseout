# 02 — App Shell (Sidebar, Top Bar, Switcher)

The chrome that wraps every authenticated page. Visible the moment
a user signs in; the only thing that *isn't* on this shell is
`/login`, `/register`, and `/welcome` (which use a different, full-
bleed auth layout — see spec 03).

**Source files:**
- `apps/web/src/layouts/SidebarLayout.astro` — the layout that
  composes the shell
- `apps/web/src/components/layout/Sidebar.astro` — the sidebar
- `apps/web/src/components/layout/Header.astro` — the top bar
- `apps/web/src/components/ui/CreateSpaceModal.astro` — the
  "create new Space" modal opened from the switcher
- `apps/web/src/components/ui/Breadcrumbs.astro` — breadcrumbs
  rendered inside the top bar

**Live preview:** every page (`/`, `/integrations`, etc.). Toggle
to `?fixture=empty` to see the shell with no Space / no Org filled
in.

---

## Purpose

The shell answers four questions instantly, on every page:

1. **Where am I?** (active nav item, breadcrumbs, page title)
2. **Which Space am I in?** (Space switcher)
3. **Who am I?** (profile dropdown, top-right)
4. **What can I do?** (the nav itself is the menu of capabilities)

If a user can't answer those four questions in under a second on
any page, the shell is failing.

---

## Layout (today)

```
┌──────────┬────────────────────────────────────────────────────────────────┐
│          │ Top bar: [breadcrumbs] ............ [theme toggle] [profile ▾] │
│  Logo    ├────────────────────────────────────────────────────────────────┤
│          │                                                                │
│  ┌────┐  │                                                                │
│  │SPC▾│  │                                                                │
│  └────┘  │                                                                │
│          │                                                                │
│  Home    │                                                                │
│  Backups │              ←  Page content goes here  →                      │
│  Restore │                                                                │
│  Schema  │                                                                │
│  Integ.. │                                                                │
│  Reports │                                                                │
│          │                                                                │
│  ──────  │                                                                │
│ Settings │                                                                │
│ Help     │                                                                │
└──────────┴────────────────────────────────────────────────────────────────┘
```

Desktop: persistent sidebar (≈ 240px wide expanded, ≈ 64px
icon-rail when collapsed via the hover toggle).

Mobile: sidebar collapses behind a drawer; top bar adds a hamburger.

---

## Sidebar — pieces from top to bottom

### 1. Brand block

- Full logo when expanded.
- Icon-only logo when collapsed to the rail.
- Light + dark variants already wired (`/images/logo/{logo,icon}-{dark,light}.svg`).
- Clickable → routes to `/` (Dashboard).

**Designer notes:**
- The current logos are functional placeholders. There's room to
  refine the mark — see `/Users/admin/CodeProjects/openside/baseout/baseout/brand/`
  for the existing brand assets (also vendored into `apps/web/public/images/`).
- Don't change the *position* (top-left, fixed height row) — that's
  load-bearing for the rail-collapse interaction.

### 2. Space switcher

The compact card directly under the brand. Shows:

- A deterministically-colored circle with the active Space's
  initials (e.g. "DS" for "Demo Space").
- The Space name, truncated.
- A dropdown chevron when the user has >1 Space.

Clicking opens a menu listing all Spaces in the current Org plus a
"+ Create Space" item that opens `CreateSpaceModal`.

**Behavior:**

- Single-Space users see the card but it's not interactive (no
  chevron).
- Switching Spaces reloads the current route against the new Space
  context — Dashboard becomes that Space's Dashboard, Backups becomes
  that Space's Backups, etc.
- The active Space is remembered per-user across sessions (PRD §6.2,
  §6.4).

**Why this lives in the sidebar (not the top bar):** the Space is
the primary unit of context — almost every page is "this page, for
this Space." Putting it adjacent to the nav reinforces "everything
below this point is *about* the current Space."

**Designer notes:**
- The auto-generated Space color is fine for now (no `color` field
  on Space yet). If you want per-Space color picking, surface it in
  the `CreateSpaceModal` and we'll wire it.
- Don't move the switcher to the top bar — that breaks the
  established pattern and creates ambiguity about what's
  Space-scoped vs. global.

### 3. Top nav (primary)

The canonical nav order (from `app-config.json`):

1. **Home** (`/`) — Dashboard
2. **Backups** (`/backups`)
3. **Restore** (`/restore`)
4. **Schema** (`/schema`)
5. **Integrations** (`/integrations`)
6. **Reports** (`/reports`)

Each item: icon (Lucide), label, hover/active state. Active item
matches the current route via `startsWith` so child routes stay
highlighted.

**Future items** that will land here (per PRD §6.3, not all in V1):

- **Data** (record metrics, alerts, insights) — V1.5+
- **Automations** (Airtable automation backup & changelog) — V1.5+
- **Interfaces** (Airtable interface backup & changelog) — V1.5+
- **AI** (docs / MCP / RAG) — V2
- **Analytics** (usage metrics) — could land in V1 as part of Reports
- **Governance** (rules / compliance) — V2, Business+ only

Don't add them now; design the current list cleanly and the future
items will slot in.

### 4. Divider + footer nav

- **Settings** (`/settings`)
- **Help Center** (`/help`)

Visual separation from the primary nav makes "this is meta-work, not
the product itself" obvious.

---

## Top bar — pieces left to right

### 1. Breadcrumbs

Generated from the current route. Examples:

- `/` → `Home`
- `/backups` → `Home / Backups`
- `/integrations` → `Home / Integrations`

Source: `getBreadcrumbs(currentPath)` in
`apps/web/src/lib/config.ts`. The current implementation is
flat — every route returns `Home / <PageName>`. There's no nested
hierarchy yet because no page has children deep enough to need it.

**Designer notes:**

- Once Backups gains a per-run detail page (`/backups/abc123`), the
  breadcrumb will become `Home / Backups / Run #abc123`. Plan for
  that.
- Keep them subtle — they're navigational, not a focal point.

### 2. Empty middle

Currently empty. Candidates if you want to fill it:

- Global search (eventually — not designed yet)
- Page-specific actions (could move "Run backup now" up here on
  the Backups page, for example)
- Stay empty (whitespace as design choice)

Don't put status notifications here — they belong inline on the
page that's affected (Integrations page for connection state,
Dashboard for system status).

### 3. Theme toggle

Light / dark mode toggle. Already wired to `@opensided/theme`'s
`baseout-light` and `baseout-dark` themes. Defaults to light.

**Designer notes:** the current implementation uses a sun/moon
icon. Stays in the top-right corner because theme is global and
shouldn't move when the user navigates between pages.

### 4. Profile dropdown

Click on the user's avatar in the top-right. Reveals:

- User name and email at the top
- "Profile" link → `/profile`
- "Settings" link → `/settings`
- "Sign out" action

**Current behavior:** the dropdown also stays open across the theme
swap (fixed in a recent commit; don't reintroduce the regression).

**Designer notes:**
- Avatar shows initials when no photo set.
- Don't put org/space switching here — that's the sidebar's job.
- Multi-Org users will eventually need an "Organization switcher"
  somewhere; the profile dropdown is a reasonable home for it (the
  user is leaving their current Org context, much like signing
  out). Not in scope for V1 — most users have one Org — but flag
  it if you want to think ahead.

---

## States to design for

When iterating on the shell, test each of these by toggling
fixtures:

| State | URL | What it looks like |
|---|---|---|
| **Onboarded, single Space** | `/` (default) | Space switcher shows one item, no chevron; primary nav fully populated; profile filled |
| **Pre-onboarding** | `/?fixture=trial` | No Org / no Space — the switcher should degrade gracefully (today it shows "—"); nav items are present but actions on them won't work yet |
| **Empty Space** | `/?fixture=empty` | Space exists but has no connections / no bases / no runs. Dashboard's "Next Step" card is the prominent CTA |
| **Collapsed rail** | hover the toggle on the sidebar's right edge | Sidebar narrows to icon-only ≈ 64px |
| **Mobile** | resize browser < 768px | Sidebar collapses behind hamburger, top bar gains menu icon |

---

## What's load-bearing (don't break)

- The active-item logic (`startsWith`-based). If you change the
  highlight CSS, make sure `/backups/anything` still highlights the
  "Backups" item.
- The `data-open-modal="connect-airtable-modal"` attribute pattern
  — buttons in views use this to trigger modals. Keep the
  attribute hook even if you change the visual.
- The `aria-busy` / loading-spinner pattern on async buttons. The
  `setButtonLoading` helper in `apps/web/src/lib/ui.ts` is the
  single source of truth.
- The fact that signing out **clears all nanostores**. If you
  redesign the profile dropdown's Sign Out, the existing handler
  in `Sidebar.astro` is what does that cleanup — don't
  inline-replace it without porting the cleanup.

---

## Open design questions

These are unresolved. If you have opinions, flag them — they're
worth a conversation:

1. **Density of the sidebar.** Currently the nav rows have generous
   padding. We could tighten it to expose more of the eventual
   future items (Data / Automations / Interfaces / Analytics)
   without scroll.
2. **Sidebar grouping.** Should "Backups / Restore / Schema" feel
   like one group (data-protection-y) and "Integrations / Reports /
   Settings" like another (config-y)? A subtle visual grouping
   (extra spacing, or a tiny label) could help.
3. **Top-bar use of empty space.** Strongly empty (cleaner) or
   gently informational (last-backup timestamp pinned globally)?
4. **Space switcher's "create new Space" CTA prominence.** The
   product expects most users to have one Space; the secondary
   audience is consultants with many. How prominent should "create
   new" be without distracting the majority?
