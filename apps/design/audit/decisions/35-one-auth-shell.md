# D35 — One auth shell

**Rule in one sentence:** The five signed-out screens are one documented pattern —
`pattern-auth-screen` — which scrolls, carries the 390 floor gate, opens on one `<h1>`, wears the
mark and the footer, and states its theme decision out loud.

## Why this option, not the alternative

`SB_ENTRIES` holds 113 entries and **grep for `auth-card` / `auth-layout` / `LoginView` /
`WelcomeView` returns 0**. `auth.css` is 267 lines and ~30 `.auth-*` classes: split layout, brand
panel, card, provider button and note, divider, footer, copyright, form note, field label, trust
block. This is the worst case my charter names — a shared mechanism that is **reused and invisible**,
so it drifts. The entry's absence is not a side note; it is the *cause* of every row below. The
rejected alternative — fix the six defects and move on — leaves the next person free to rebuild
them, because nothing in the catalog would have disagreed.

The load-bearing defect is the scroll model, and it is the most surprising behaviour in the wave.
`apps/web/src/styles/components/auth.css:6` is `@apply flex h-screen w-full overflow-hidden` with a
vertically centred card, so a viewport shorter than the card clips **both** ends with no scrollbar:
measured on `/welcome?fixture=trial` at 844×390, `documentElement.scrollHeight === clientHeight ===
390`, the card runs **−69.8 → 459.8**, and `Continue`'s bottom is at **459.8** — off-screen, with no
way to reach it. A phone in landscape cannot submit the onboarding form. `/login?state=lockout` at
the same size puts `Verify and continue` at 391.3 in 390.

Two smaller rows are one line of the same story: `#too-narrow` is rendered by
`SidebarLayout.astro:171-183` only, so the **three routes a signed-out person can reach are the
three without the gate** — which is also why the scroll bug has never been reported. And the family
has **no `<h1>` anywhere**; the card title is an `<h2>` on all five views.

## Surfaces changed

- `apps/web/src/styles/components/auth.css:6` — `min-height: 100dvh` + `overflow-y: auto`;
  `align-items: center` yields to `flex-start` when the card is taller than the viewport. **One
  rule, five screens.**
- `Layout.astro` — `#too-narrow` moves up so both shells inherit it (verified exact where it
  exists: `none` at 390, `flex` at 375).
- `LoginView.astro:60` · `WelcomeView.astro:21` · `AuthChallengeView.astro:81` ·
  `AuthAssociationView.astro:45` — `<h2>` → `<h1>`; the visual size need not change.
- `WelcomeView.astro:20-22` — the 8-line, already-theme-aware `.auth-form-logo` block and the
  `.auth-footer`; today Welcome is the only screen in the family with neither, and it is the screen
  a new user spends longest on.
- `WelcomeView.astro:21` — greet without the raw address, or set the address at the subtitle rung
  (today: a 24px heading containing `reese@baseout.design`, wrapping to three lines at 390).
- `AuthLayout.astro:14` and `apps/design/src/pages/welcome.astro:12` — one `<title>` format,
  `<Page> — Baseout`; today three formats across five surfaces.
- `AuthLayout.astro:27` — the hard-coded `data-theme="baseout"`: either delete it (the theme-aware
  logo swap at `auth.css:140-154` becomes reachable) or keep it and write the brand reason into the
  new entry and delete the dead light-logo branch. **The lead's call is: keep the dark door, record
  it** — a signed-out brand surface is a different job from a signed-in tool, and the theme has not
  been chosen yet at that point in the session. That makes it an ACCEPT, and ACCEPT requires the
  catalog sentence.

## storybook.ts

**New entry `pattern-auth-screen`**: the 360px column (measured 360/358/343 at 1440/390/375), the
16px gutter below 1024 and 40px above, the ranked two paths with **no method tabs**, the SSO note
that separates *sign in with Airtable* from *let Baseout read my bases*, the divider, the footer and
copyright, the `<h1>` rule, the **scroll contract**, the 390 gate, and the theme exception with its
reason. Also fold the bespoke `.auth-divider` onto the existing `divider` entry, or ratify it here.

## Explicitly not changing

- **The two-factor screen** — backup-code swap reachable during lockout, the trust bound stated out
  loud, the challenge as its own route, the lost-phone footer naming a human path. Best-reasoned
  surface in the batch.
- **The association fork** — two equal `btn-secondary` cards with deliberately no primary.
- **Register is Login in `register` mode** — one implementation, two screens, reason written down.
  Exactly the variance reduction this audit exists to find.
- The privacy-preserving sent copy and the 5-minute expiry sentence.
- The bfcache handler (`LoginView.astro:186-191`).
- Zero horizontal overflow at 375 · 390 · 768 · 1024 · 1440. A fix that disturbs that has overshot.

## Members

S36-F1 (S1) · S36-F3 (S2) · S36-F8 (S2, `<h1>` half; the path-404 half sits with D36) ·
S36-F9 (S2) · S36-F12 (S2, **ACCEPT**) · S36-F13 (S2) · S36-F17 (S3) · S36-F20 (S3).

## How to verify done

`/welcome` at 844×390: the page scrolls and `Continue` is reachable · `/login` at 375 shows the
narrow gate · `document.querySelectorAll('h1').length === 1` on all five screens · the wordmark and
footer render on `/welcome` · `pattern-auth-screen` exists in `SB_ENTRIES` and names the theme
decision · `pnpm css-guard` green (this touches CSS).
