# 12 — Settings (`/settings`)

The hub for everything that isn't a customer-facing product
surface: account preferences, Organization config, Space config,
notification preferences, billing, team members, API tokens. Today
the page is a placeholder.

**Source:**
- Today: `apps/design/src/pages/settings.astro` (single card)
- Once designed: `apps/web/src/views/SettingsView.astro` (or
  multiple sub-views — see below)

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/settings>

---

## Purpose

Centralize every configuration knob that isn't already on a
product surface. Settings is the "everything else" surface.

This page will grow large. Designing it well now (sub-navigation,
grouping, search-ability) saves pain later.

---

## User goal

> "I need to change a setting. Take me to it without me having to
> hunt."

Sub-goals depending on context:

- "Add a teammate to my Organization."
- "Change my billing email."
- "Generate a new API token."
- "Disable email notifications when backups succeed (keep
  failures)."
- "Rename my Space."
- "Configure my BYOS (Bring Your Own Storage) destination."
- "Look up which plan I'm on."

---

## Suggested structure

A **two-pane layout** works well for settings hubs at this scale:

- Left rail: nested nav of categories.
- Right pane: the selected category's settings.

The categories that will eventually live here (per PRD + Features):

### Account (per-user)

- Personal profile (name, avatar) — links to `/profile` or absorbs
  that page entirely
- Email + magic-link preferences
- Connected sessions / sign out everywhere
- Delete account

### Organization (per-Org, admin only)

- Org name + slug
- Billing email
- Billing address / tax info
- Members + roles (Admin / Member / Viewer)
- API tokens (issue, revoke)
- Audit log of org-level admin actions

### Space (per-Space)

- Space name
- Backup schedule defaults (also surfaced on /integrations)
- Storage destination defaults (also surfaced on /integrations)
- Auto-add-new-bases policy (also surfaced on /integrations)
- Data retention policy
- Delete space

### Billing (per-Org, admin only)

- Current plan + tier
- Usage this month (mirrors /reports)
- Upgrade / downgrade
- Payment method
- Invoices / receipts
- Auto-overage / hard-cap toggle

### Notifications (per-user, scoped per-Space)

- Per-event toggles: backup succeeded / failed / overage warning /
  schema-drift alert / health-score drop
- Per-channel toggles: email / in-app / webhook
- Quiet hours

### Integrations (mirrors `/integrations` summary)

- Currently-connected platforms
- Currently-connected storage destinations
- Outbound webhooks (V1.5+)

### Developer

- API tokens (issue, revoke, scope)
- Direct SQL API connection details (Business+)
- Webhook signing secret

---

## Notes for designer

### Information density

A settings hub for a power-user product *can* be dense. Reference
points: Linear's Settings, GitHub's Settings, Vercel's project
settings. Avoid the consumer-app pattern of one big scrollable page
with section headers — that doesn't scale past 5 categories.

### Search

A search field at the top of the left rail that filters across all
settings ("backup", "webhook", "billing") is gold. Doesn't need to
be in the first design pass but plan a slot for it.

### Permission-gating

Many settings are admin-only. Non-admins should see those sections
greyed out or hidden, with a tooltip explaining: "Ask your Org
admin to change this." Don't ship a settings page where a non-admin
clicks "Change plan" and gets a 403.

### Today's placeholder is honest

The current "Account Settings" card says only that Baseout is
passwordless. That's *correct* — there's no password to manage, so
the section is shorter than a typical app's. But the page still
needs to grow as features ship.

### "Profile" overlap

`/profile` (spec 13) and `/settings > Account` overlap. Designer's
call:

- **Option A** — Delete `/profile`. Profile lives at `/settings/profile`
  or just `/settings`.
- **Option B** — Keep `/profile` as a fast-access shortcut, with
  `/settings` linking back to it.
- **Option C** — Merge: `/profile` redirects to `/settings/profile`.

Option A is cleanest if the settings hub gets a left-rail nav.
Option B is the lightest-touch transition.

### Mobile

Two-pane layout collapses badly on mobile. Standard pattern: on
mobile, show *only* the left rail (as a list of links), tap a
category to navigate to a full-screen settings sub-page. Don't try
to fit both panes side-by-side.

---

## Component reuse

Same primitives as the rest of the app — `Card`, `TextInput`,
`Select`, `Toggle`, `Button`, `Checkbox`, `Badge`, `Avatar`,
`Tabs`, `Divider`, `Modal`.

You'll likely need new patterns for:

- **Settings row** — label + description + control in a
  consistent horizontal layout (Stripe Dashboard's settings rows
  are a good reference).
- **Section header** — H2 + helper text + optional CTA.
- **Permission-gated section** — wrapper showing "Admin only" badge
  + grey overlay when the current user can't edit.

---

## What's NOT here

- The product-surface duplicates (Backup history, Integrations
  connection cards) live on their dedicated pages.
- Billing payment-method capture should NOT live inline — that
  should open in a Stripe Customer Portal pop-up or redirect.
  Designing the Stripe portal is out of scope (it's Stripe's UI),
  but the button that launches it lives here.
