# D32 — One form failure contract

**Rule in one sentence:** Every surface that submits or tests something **renders a failure**: a
single form-level error region above the actions, fed by one shared code→sentence table, and every
form refuses locally-judgeable input (empty, malformed email, whitespace secret) **before** it
confirms success.

## Why this option, not the alternative

The rejected alternative was to file each surface separately and let each grow its own error slot.
That is precisely how the app arrived here: the copy already exists — `IntegrationsView.astro:50-61`
holds **ten** connect codes and `:489-511` **nine** rescan codes, verified present and verified
rendered by nothing (`access_denied` and `api_call_failed` appear nowhere else in `apps/web/src`;
the other eight appear only in `StoragePicker.astro:476-493`, in **different words**). Two scouts
reached the same hole from opposite ends: the connect flow expresses **0 of 19** documented codes,
and both registry create forms can say only *"X is required"*. `CLAUDE.md` keeps
`IntegrationsView.astro` alive expressly as a copy deck "until the live flow grows those states" —
this decision is that event. One table, one slot recipe, one deletion.

The second clause exists because the front door currently confirms a lie: `LoginView.astro:86` sets
`novalidate`, `:196` is `if (!email) return;`, and `#login-error` / `#login-error-text` are markup
with **no writer anywhere in the repo** (verified: 2 hits, both in the template). So an empty submit
produces no reaction of any kind and `not-an-email` is answered with *"we sent a sign-in link"* and
a five-minute wait. Turning `novalidate` off is not the fix — the view then loses control of the
wording — so the view must supply the message it suppressed.

## Surfaces changed

| surface | change |
|---|---|
| `SourceAddView.astro` · `DestinationAddView.astro` | one form-level `alert alert-soft alert-error` slot above the action row (today every error node is `[data-reg-err-for="<field>"]`, verified — there is no form-level slot); PAT/connection-string shape check before submit |
| `DestinationDetailView.astro:317-322` · `SourceDetailView.astro:345-350` | `Test connection` gains failure / timed-out / not-yet-connected branches; today it has exactly one unconditional success string |
| `IntegrationsSetupWizard.astro:986-999` | the 850ms always-succeeds connect gains the failure branch fed by the code table |
| `StoragePicker.astro:476-493` | its eight sentences reconcile with the deck so one code has one sentence |
| **new** `apps/web/src/views/AuthorizingView.astro` | the OAuth return state moves out of the harness into `apps/web` with in-flight · error · timeout branches, one exit ("Start over"), and `role="status" aria-live="polite"` on the spinner |
| `LoginView.astro` (and Register, which is Login in `register` mode) | the dead `#login-error` slot gets its writer: empty and malformed-email refusals |
| `settingsCatalog.ts:382-387`, `:234-240` | billing email `type="email"`, `org-slug` pattern — reusing the refuse-and-explain path that already exists at `settingsControls.ts:109-114` and today serves exactly one rule |
| `views/IntegrationsView.astro` | **deleted** once the two tables have moved, per its own header comment |

## storybook.ts

Amend `alert`: a new **form-level error** usage — one region, above the actions, `alert-soft
alert-error`, populated from a code table, never a second field error. Amend `input` usageDo with
the sentence the app already half-implements: *a form that can judge a value locally refuses it
before it confirms success; `novalidate` is only legal when the view supplies the message it
replaced.* Add the code→sentence table's home (`lib/auth/errorLabels.ts` / `lib/registry/`) as the
one writer.

## Explicitly not changing

- **Whether a connect actually fails is NOT-OURS.** The wiring belongs to the client's backend; the
  absent *markup* for the state is ours and is all this decision ships.
- Server-side rejection of a well-formed email stays NOT-OURS (an account may or may not exist —
  and the privacy-preserving sent copy at `LoginView.astro:116` must not change; `specs/03-login.md:74-77`
  asks that it never change).
- The wizard's gate model (Next is never `disabled` — `IntegrationsSetupWizard.astro:775-779`). An
  attempt is what earns the message; that is the same instinct this decision generalises.
- `AccessScopeNote`, the name-swap contract, the bfcache handler at `LoginView.astro:186-191`.

## Members

S24-F9 (S1) · S25-F6 (S2) · S28-F1 (S2, downgraded — see register) · S28-F2 (S1) · S36-F2 (S1) ·
S32-F9 (S2) · S28-F16 (S3).

## How to verify done

`grep -rn "errorLabels" apps/web/src` returns the live flow and not a dead view · submitting
`/login` empty writes `#login-error` and moves focus · `not-an-email` never reaches the sent panel ·
`/sources/new` with a rejected token paints one alert above the actions · `Test connection` on a
`needs_connection` destination does not claim credentials are valid · `pnpm ds-lint` and
`pnpm typecheck` green.


---

## AMENDMENT 2026-08-14 (second) — the X-lens wave merged three findings into one member, and it is the largest

**X13-F1 + X13-F2 + X05-F4 are one row and one PR series** — three lenses reaching the same defect by
three routes (navigation/IA, copy/tone, alerts). D32 already holds six members; this makes seven, and
it restates the case with the evidence the surface pass could not see:

- **The Airtable connect flow renders none of its nineteen documented failure messages.** The copy
  lives in `views/IntegrationsView.astro`, a file whose own header (`:2-18`) states no route renders
  it: ten connect codes at `:50-61`, nine rescan codes at `:489+`. They are in voice per
  `specs/00-design-principles.md:141` — *"Your session expired before Airtable returned. Please try
  again."*, *"Security check failed. Please start the connection over."*
- **The one deck that ships covers eight of the same codes in the engineer's register.**
  `apps/web/src/components/backups/StoragePicker.astro:476-493` — *"Your browser dropped the OAuth
  handoff cookie during the round-trip"*, *"The OAuth state parameter didn't match what we sent"* —
  inside a **solid** `alert-error` (`:120-123`), with **`error_code: <code>` printed to the user**
  (`:500`). It also uses typographic apostrophes where the dead deck uses ASCII: the same paragraph in
  two character sets.
- **We ship the engineer's words and keep the writer's in a dead file.**

**Path correction, made in four places in the audit:** `StoragePicker.astro` is at
`apps/web/src/components/backups/StoragePicker.astro`, **not** under `components/integrations/`.

**Two clauses the live deck does better, and they must survive the merge.** *"allow cookies for this
site"* is the only **actionable remedy** either set offers, and the printed `error_code:` foot is
right for a technical-ops user. **The target is `IntegrationsView`'s sentences + `StoragePicker`'s
remedy clause + the `error_code:` foot**, in a soft alert (D42), rendered in the live flow — then the
dead file is deleted.

**The three-way split of ownership is accepted as the scout proposed it:** D42 rules the vessel,
D32/X13 rule the strings, and the surface rows (S28-F1, S28-F2, S24-F9, S25-F6, S32-F9, S36-F2) supply
the instances. **One decision, three owners, no fourth row.**

---

## CORRECTION 2026-08-14 — **both decks were dead, not one**

This decision's amendment called `StoragePicker.astro` *"the one deck that ships"*, and the finding
it rests on says *"we ship the engineer's words and keep the writer's in a dead file."*

**Measured while implementing it: `StoragePicker.astro` does not ship either.** Its only importer in
the entire tree is `views/IntegrationsView.astro:27` — the dead copy deck itself. Verified with
`/usr/bin/grep -a` across `apps/web/src` and `apps/design/src`; every other occurrence is a comment.

So no user has ever seen **either** register. The defect was not "the engineer's voice reached the
user" — it was that **the connect flow had no failure surface at all**, and two competing decks sat
behind it, one of them importing the other.

That makes the fix's shape right for a different reason than recorded: the codes had to move into
`lib/connect/failureCopy.ts` and be rendered by the **live** surfaces (`SourceAddView`,
`DestinationAddView`, and both wizard drawers), not merely re-voiced in place.

**Still open, and it is what keeps `IntegrationsView.astro` alive:** the **nine rescan codes** have
no live renderer. The surface that must call `rescanFailureMessage` is `SourceDetailView.astro`'s
*Refresh bases*, which today has a success note and no error branch. Until that lands, the dead view
holds the only call site — and deleting it would orphan `StoragePicker` as well.

**One ruling applied, and it splits the difference this decision and the implementation brief
disagreed on.** The brief said no `error_code:` in front of a user; this decision says the printed
foot is right for a technical-ops reader. Shipped as **`Reference: <code>`** — the diagnostic value
is kept, the developer register is not. One line per site to flip either way.
