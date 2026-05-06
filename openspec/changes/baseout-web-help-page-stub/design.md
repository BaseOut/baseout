## Context

The sidebar already advertises a Help Center; the route is just missing. Smallest viable fix: add a static page that fulfills PRD §15.2's placeholder contract without committing to chatbot infrastructure or modal-widget plumbing today.

## Goals

- Eliminate the dead `/help` link.
- Match PRD §15.2's "Coming Soon + contact" wording.
- Zero coupling to other in-flight changes (deliberately does not touch Sidebar.astro to avoid conflict with PR #1's stability-pass-1 commit).

## Non-Goals

- Real chatbot widget — V2.
- Modal/dialog version — deferred. The full-page version satisfies the PRD placeholder text and is keyboard-accessible without extra JS.
- "Contact form" with server-side ticket creation — V2.

## Decisions

### D1 — Page over modal

A standalone page is simpler than a modal: zero JS, zero client-state, no `<dialog>` polyfill concerns, shareable URL. PRD §15.2 doesn't pin the surface (page vs modal); page is the path of least resistance.

### D2 — Contact email pulled from `app-config.json` `owner.email`

The owner's email is the de-facto support address pre-launch. Already exposed via `getOwner()` in `lib/config.ts` so other surfaces (footer, settings) can adopt the same source.

### D3 — Mailto only — no support form

Until a ticketing backend exists (`baseout-web-mailgun` or similar), a `mailto:` link is the honest implementation. Avoids a fake form that would just send through the same Resend pipeline as magic-links.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | `mailto:` doesn't open an email client on devices without one configured | Low | Display the email address as visible text alongside the button so users can copy it manually. |
| R2 | Owner's email leaks into the marketing-style page even if the org wants support routed elsewhere later | Medium | Owner-email source-of-truth is already in `app-config.json`; later, swap the source to a dedicated `support.email` field — minimal change. |

## Verification

```bash
pnpm --filter @baseout/web typecheck     # 0 errors
pnpm --filter @baseout/web build          # clean
```

End-to-end (operator, dev server):

1. Sidebar → click "Help Center" → `/help` renders with the placeholder card.
2. Click the "Email support" button → email client opens with subject `Baseout — Help request`.
