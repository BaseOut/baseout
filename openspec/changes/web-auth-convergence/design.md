# web-auth-convergence — Design

## Context

Two facts shape every decision here.

**One: the tree is ahead of the fork on wiring and behind it on presentation.** `web-login-methods` promoted the fork's auth markup and replaced its fixture `<script>` blocks with real better-auth calls. So `#login-error` has a writer, empty submit is refused, and `setButtonLoading` is in place — the audit's `S36-F2` ("`LoginView` got the markup and neither [importer nor hand-implementation]") describes the fork's tree, not ours. Converging must therefore be **markup-and-CSS forward, script-wiring backward**: take the fork's presentation, keep our behaviour.

**Two: `AuthLayout.astro` is byte-identical between fork and tree.** The entire item-1 defect and the entire fix live in `styles/components/auth.css`. Anyone who tries to verify this by reading the layout file will conclude there is nothing wrong.

## Goals / Non-Goals

**Goals**
- The auth shell scrolls. `Continue` is reachable at 844×390 on all five screens.
- A malformed email is refused before the magic-link call.
- The two grown views match the fork, with our real wiring intact.

**Non-Goals**
- Any change to auth logic, routes, session handling, or middleware.
- `RegisterView` (a 602B fork stub — the working page stays).
- 2FA backend (still deferred; `SecurityPanel` stays gated — see [`web-settings`](../web-settings/)).
- The Airtable SSO button's gate (still server-config-gated per `web-auth-airtable-sso`).

## Decisions

### D1 — The scroll fix is three rules, and it is one fix

They must land together and must not be split across commits:

| rule | change | why alone it fails |
|---|---|---|
| `.auth-layout` | `flex h-screen w-full overflow-hidden` → `flex w-full` + `min-height: 100dvh` | drops the clip, but centring still strands the leading end |
| `.auth-panel` | lose `justify-center` | without this, overflow distributes to both ends and no scroll position can reach above 0 |
| `.auth-card` | gain `margin-block: auto` | auto margins take *free* space: they centre when there is room, resolve to 0 when there is not |

`min-height`, not `height`: the shell is *at least* the viewport and grows past it when the card needs more. No `overflow` on `.auth-layout` — the **document** scrolls, giving one scroll model for the family and the scrollbar the browser already provides. `.auth-brand` keeps its own `overflow-hidden`; that clips the decorative rays, not the form.

**Verification is by computed value at the width the rule claims to act on, not by screenshot** — a green cascade check only proves the cascade agrees with the source. And per the audit's own instrument rule: set the viewport with device-metrics emulation, never a window resize (macOS floors a window at ~500px, so every "390" taken by resizing is really a 500-wide layout).

### D2 — Keep the fork's asset reasoning in the comment, because the optimisation is conditional

`auth-rays.webp` is flattened onto opaque black and is pixel-equivalent *only because* the layer is `mix-blend-mode: screen` — for a near-black backdrop B, `(1−a)B + a·screen(C,B) == screen(a·C, B)`. **If this layer ever stops being `screen`, the flattening stops being free** and the asset must be re-exported from the RGBA original. That sentence is the deliverable, not a nicety: 1367 KB → 32 KB is worth keeping and worth being able to undo correctly.

The `opacity: 0.6` multiplier is dropped rather than carried: the art peaks at 73/255, so 0.6 erases it.

### D3 — Email format is refused client-side as UX; the server boundary does not move

A format check before `signIn.magicLink` exists so the product does not confirm sending a link it could not send. It is **not** a security control — server-side validation is unchanged and remains the boundary (§3.3). Annotate it at the call site so a future reader does not mistake it for a gate.

Use a deliberately permissive shape check (non-empty local part, one `@`, a dot-bearing domain). An aggressive regex rejects valid addresses, and rejecting a real customer's real email is a worse failure than accepting a typo.

### D4 — `welcomeForm.ts` is a real extraction, not tidying

Two reasons, both from the fork's own header and both worth preserving:

1. **`astro check` does not walk `<script>` blocks inside `.astro`.** A type error there is invisible to `pnpm typecheck`. Logic in a `.ts` sibling is actually checked — and testable.
2. **The required set is consumed twice** — the template renders one message slot per field, the submit handler validates against the same set. Two hand-kept copies is how a `*` marker and a validator drift apart.

This is the §3.2 exception that earns itself: not a drive-by refactor, but a second real call site.

### D5 — Local verification is partial, and the plan says which half

- **Locally verifiable:** the whole CSS/shell fix, the email refusal, the copy, the 390 floor gate, `welcomeForm` unit tests.
- **Deploy-only:** the magic-link round trip. Miniflare cannot send mail (`ui-sync.md` §5 / the reverted local-backup-loop precedent). The original deferral was about exactly this.

So the change ships in two verification stages and the commit's `Caveats` must say so rather than implying a full smoke ran.

## Risks

- **This is the sign-in path.** A regression locks every user out, including whoever would fix it. Mitigation: no auth logic in scope; the two views' `<script>` blocks are ours and unchanged; deploy smoke before the local commit is treated as done.
- **`min-height: 100dvh` on mobile browsers.** `dvh` is the right unit here (it tracks the dynamic viewport as browser chrome collapses) but it is also the unit most likely to behave differently across the mobile browsers we do not test. Verify on a real device, not only in emulation.
- **Five screens, one shell.** `/register` and `/2fa` are easy to forget because neither is in the fork's promoted set.

## Migration

Additive CSS + one asset swap. No DB change, no route change, no contract change. Rollback is the CSS file plus re-adding `auth-bg.png`; the existing `views/*.legacy.astro` files from `web-login-methods` remain the view-level rollback.
