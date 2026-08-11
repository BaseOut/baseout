# 15 — Not Found (`/404` and `/<anything>`)

The catch-all empty-route fallback.

**Source:**
- `apps/web/src/views/NotFoundView.astro` (the page body)
- `apps/design/src/pages/404.astro` (the wrapper that returns 404
  status)
- `apps/design/src/pages/[...slug].astro` (catch-all that also
  returns 404)

**Layout:** `SidebarLayout` — yes, the not-found page still wears
the app shell

**Live preview:** <http://localhost:4332/404> and
<http://localhost:4332/anything-not-defined>

---

## Purpose

When a user lands on a non-existent route, tell them clearly,
without breaking the app shell, and give them a way out.

That last part matters: if a user mistypes `/integration` (missing
the `s`), we don't want them to feel like the app crashed. The
sidebar is still there, the back button works, life goes on.

---

## User goal

> "I clicked a stale link / mistyped a URL. Get me unstuck."

Usually one of:
- A bookmarked page that got renamed in a recent release
- A typo in the address bar
- A misclicked nav item (rare — our nav doesn't link to dead routes)
- A 404 from a malformed search result or external link

---

## What's on the page today

Wrapped in `SidebarLayout`, so the sidebar / top bar / breadcrumbs
are still present. Inside the content area: the `NotFoundView`
component.

The current `NotFoundView` (you'll see what's there in the live
preview) is minimal — a heading, a brief message, and a "Back to
Dashboard" link.

---

## Notes for designer

- Keep the app shell. Don't redirect to a full-bleed marketing
  404 page; that breaks the sense of continuity.
- The message should be short, honest, and devoid of cute apology
  language. "This page doesn't exist." is fine. "Oops! We can't
  find that page!" is not.
- Offer 1–2 escape hatches:
  - "Back to Dashboard" link
  - "Search docs" search field (if Help search exists by then)
- Don't list "popular pages" or try to be the world's nav menu —
  the sidebar already exists. Adding a second nav here is
  redundant.
- The Astro file returns the *real* HTTP 404 status (not 200 with
  a 404-looking body) — important for search engines + monitoring.
  Don't break that.

---

## States to design for

Only one — `not found`. The page either renders or it doesn't.

If you want to design adjacent error states (500 / unauthorized /
forbidden), there's no page for those yet — they currently fall
back to Astro's default error page. Designing those would be a
separate, small piece of work.

---

## Component reuse

- `Button` for the "Back to Dashboard" CTA
- Typography from the rest of the app — no new components needed
- Consider a tasteful illustration / icon if you want warmth (one
  Lucide icon is fine; no mascots)

---

## What's NOT here

- No marketing CTAs ("Try Pro!")
- No giant brand mark
- No animated mascot
- No "Type the URL again or click below" condescension
- No suggestions list ("Did you mean…?") — fuzzy URL matching is
  more trouble than it's worth at our scale
