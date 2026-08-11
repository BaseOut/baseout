# 00 — Design Principles

The "shape" of Baseout before any specific page. Read this first.

---

## What Baseout is

A **utility admin tool** for backing up, restoring, and inspecting
Airtable data. The primary user is a *power user / ops person* who
already lives in Airtable and now needs a layer that:

- guarantees their data is backed up safely on a schedule they
  control,
- can put data back into Airtable if something goes wrong,
- shows them the structure of their data (schema, change log,
  health),
- gets out of their way the rest of the time.

This is *not* a consumer app, *not* a marketing site, *not* a
no-code builder. The user is technical, deliberate, and there to
get something specific done.

---

## What Baseout is *not*

- **Not Airtable.** We sit on top of Airtable, complement it, and
  use Airtable terminology where it helps recognition (Base, Table,
  Field, View, Automation, Interface). But we don't copy Airtable's
  consumer-friendly visual brand — we look distinct.
- **Not a dashboard product.** Charts and metrics exist where they
  earn their keep (backup history, usage). They're not the point.
- **Not a CRM.** No leads, no pipelines, no fluff.
- **Not flashy.** Avoid hero illustrations, decorative gradients,
  bouncy animations, mascots, emoji-heavy copy.

---

## The five principles (from the PRD)

These come from the v1.1 PRD §6.0. Treat them as constraints.

### 1. Functional over decorative

Information density matters more than whitespace for its own sake.
Clear status indicators, predictable controls, fast access to the
thing you came for. If a visual element doesn't communicate state,
identity, or affordance, question whether it earns its space.

### 2. Trust signals first

This app touches users' production data. The first thing they need
to see, on every page that touches a backup or connection:

- **Is it working?** (status badge, last run time, health dot)
- **What's the next thing happening?** (next scheduled run, queued
  jobs)
- **Did the last thing succeed or fail?** (run history, error
  surfaces)

If you have to bury a trust signal to make the layout look cleaner,
you're optimizing for the wrong thing.

### 3. Power over simplicity

The audience can handle configuration. Don't hide options behind
"advanced" toggles by default. Don't reduce a 5-option picker to a
3-option picker because it "looks nicer." Expose what's there;
group it sensibly.

That said: **default sensibly.** Power users want to *see* options;
they don't want to *configure* every single one before the product
works. Pick a defensible default for every required setting.

### 4. Airtable-aware but distinct

- Use Airtable's terminology where it aids recognition (Base, Table,
  Field, View, Automation, Interface, Workspace).
- Use Airtable field-type iconography where it helps (the same icons
  for single-line text, multi-select, attachment, etc., when
  rendering schema).
- Do **not** copy Airtable's visual brand. Distinct color palette,
  distinct type system, distinct overall feel. We're a tool *for*
  Airtable users, not a clone of Airtable's chrome.

### 5. Platform-agnostic foundation

V1 is Airtable-only, but the UI must visibly support the idea that
other platforms exist. The Integrations page already shows
"Notion / HubSpot / Salesforce — Coming soon" cards. The Space
concept exists precisely because a Space is bound to *one* platform
and a user may eventually have multiple Spaces across multiple
platforms. Don't design anything that hard-codes the assumption
"there is one platform and it is Airtable."

---

## Visual language — current stack

You're working in:

- **Tailwind v4** (utility-first CSS)
- **daisyUI** (component primitives built on Tailwind)
- **@opensided/theme** (project-specific theme tokens, vendored at
  `apps/web/vendor/@opensided/theme/`)
- **Material Symbols Outlined** (icon set, loaded from Google Fonts)
- **Lucide** icons (via `@iconify-json/lucide`) where Material
  Symbols doesn't have what you need
- **FontAwesome Free** (sparingly — prefer Material/Lucide first)

Theme priority: `@opensided/theme` first, daisyUI fallback, custom
CSS only when neither covers it. There are light/dark themes and a
theme toggle in the top bar.

Don't introduce a new component library or icon set without checking
in — every new dependency we add to apps/web ripples into the
production build.

---

## Density vs. breathing room

Baseout is denser than a marketing site, but not as dense as a
spreadsheet. Reference points:

- **Linear** (linear.app) — closer to right than wrong. Compact
  rows, small but readable type, status colors carry meaning.
- **Vercel dashboard** — closer to right than wrong. Cards are tight
  but not cramped; copy is short.
- **Plaid dashboard** — also good reference.
- **Stripe dashboard** — slightly denser than we need; we can be a
  touch more relaxed.
- **HubSpot / Salesforce** — too busy, too many shapes, too many
  brand colors. Don't go there.

---

## Copy voice

- Direct, second-person, short sentences.
- "Connect Airtable", not "Get started by linking your Airtable
  workspace to Baseout!"
- Status copy is descriptive of state, not promotional. "12 bases
  discovered, 8 included in backups" not "Awesome! You're all set."
- Errors say what failed and what to do. "Airtable didn't return an
  authorization code — please try connecting again." Not "Oops!
  Something went wrong."

If you find yourself writing exclamation points or "Awesome!" /
"Great!" / "Welcome to your new dashboard!" — you've drifted into
consumer-app voice. Pull back.

---

## Mobile

V1 is responsive web (no native apps). The dashboard, backup
history, status, and notifications must work on mobile — that's
where users will check "did last night's backup succeed?" from bed.
Configuration screens (Settings, Integrations) are tolerated as
"functional but not pretty" on mobile if the layout makes desktop
crisper.

Test breakpoints: < 375px, < 768px, < 1024px. Touch targets minimum
44×44px.

---

## Accessibility (baseline)

- Semantic HTML — `<button>`, `<nav>`, `<section>`, `<header>`.
- Color contrast WCAG AA (4.5:1).
- Don't rely on color alone for state — pair status colors with
  icons or text labels (the active/refreshing/invalid badges
  already do this).
- Keyboard navigation must reach every interactive control.
- `aria-busy` on async buttons (the existing `setButtonLoading`
  helper handles this).

---

## What to ignore in the existing UI

Some things in the current implementation are placeholder /
underbaked and not worth defending. You have design freedom on:

- The dashboard's "System Status" and "Quick Links" cards (currently
  filler).
- All four placeholder pages (`/restore`, `/schema`, `/reports`,
  `/help`).
- The `/welcome` onboarding form layout (functional but bland).
- The empty-state copy on most screens.

Things to **keep** unless you have a strong reason to change them:

- The sidebar navigation structure and order.
- The Integrations page's information hierarchy (connection card →
  base selection → schedule → storage → run backup). This was
  worked through carefully with the PRD's user-journey.
- The Backup History widget's columns and statuses.
- The status badge color mapping (success / warning / error / default).
