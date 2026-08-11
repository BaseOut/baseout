# 14 — Help (`/help`)

The help / docs / support entry point. Currently a placeholder.

**Source:**
- Today: `apps/design/src/pages/help.astro` (`PlaceholderView`)
- Once designed: a new `apps/web/src/views/HelpView.astro`

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/help` — placeholder

---

## Purpose

Give a user *in* the product a fast way to:

- Find an answer in docs without leaving Baseout
- File a support ticket if they can't
- Reach a status page if they suspect an outage
- Surface diagnostic info we'd ask for in a support ticket (their
  Org ID, Space ID, build version) so they can paste it without us
  asking

This is *not* the marketing-site help center. It's an in-product
shortcut to the relevant resources.

---

## User goal

> "Something isn't working as expected. Help me figure out
> whether it's me or you."

The user is frustrated. They've already tried the obvious thing.
Make this page get out of their way: top-tier shortcuts, then a
clean dump of links and contact options.

---

## Suggested page structure

### 1. Search

A prominent search input at the top, scoped to docs (and ideally a
known-issue / FAQ corpus). Even if search isn't wired up yet,
design the slot.

### 2. Top tasks

A small grid of cards, each a known high-frequency help topic:

- "Connect Airtable"
- "Restore from a snapshot"
- "Change my plan"
- "Set up Google Drive storage"
- "Why did my backup fail?"

Each links to the relevant docs page.

### 3. Contact / support

- "Email support" → mailto with pre-filled subject + Org ID
- "Open status page" → external link (status.baseout.app or
  whatever the hosted status page lives at)
- "Documentation" → external link to full docs site
- "Changelog / what's new" → external link

### 4. Diagnostic info

A small card with copy-to-clipboard buttons for:

- Org ID
- Space ID
- User ID
- Browser / OS
- Build version

This is hugely useful in support tickets. Users learn to paste this
once and we stop the back-and-forth.

---

## States to design for

| State | What |
|---|---|
| **Default** | Search + top tasks + contact + diagnostic info |
| **No matching docs in search** | Empty state with "Couldn't find an answer? Email support" CTA |
| **Trial user** | Slightly more guidance-oriented copy (they're more likely lost) |
| **Paid user** | Slightly more "submit a ticket" oriented (they expect support to engage) |

---

## What this page is NOT

- **Not the full docs.** Docs live on a separate marketing/docs
  site. This page just links into them.
- **Not a live chat widget.** If we add live chat later, it'd be a
  global widget (bottom-right), not gated to this page.
- **Not the status page.** External, linked from here.
- **Not a marketing surface.** No "Have you tried our Pro tier?"
  CTA. The user is here because something is wrong; selling now is
  insulting.

---

## Notes for designer

- Lean toward sparseness. A help page that buries the contact
  option behind seven categories is hostile. Top tasks → contact →
  diagnostic info, in that order, all above the fold.
- The diagnostic-info card is the most useful and least
  glamorous element. Make the copy buttons obvious.
- If/when search is real, it deserves to be the primary thing on
  the page — possibly even the entire page above the fold.

---

## Component reuse

- `Card`, `TextInput` (search), `Button`, `Badge`
- Copy-to-clipboard pattern (no existing helper — small JS snippet
  using `navigator.clipboard.writeText`, plus a transient "Copied!"
  badge)
