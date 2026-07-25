# web-signup-domain-association — Design

## Decision 1 — One capability, two consumers

Association is a property of *account creation*, not of any sign-in method. Extracting it keeps the SSO change focused on identity and lets magic-link signup consume the identical fork, screen, and lifecycle. The fork hook runs at the single point where a new user record is about to be created, after email verification (magic-link click / Airtable-verified email) — never before verification, or domain squatting gets a probe.

## Decision 2 — Suggest, never auto-join (carried from the SSO design)

Domain possession isn't authorization: contractors, ex-employees, and look-alike addresses all hold company domains. The join request + admin approval is the safeguard; the user proceeding independently meanwhile means the fork never costs a signup. Silent auto-join additionally leaks org existence to anyone who can receive email on the domain — rejected.

## Decision 3 — Derived domains with an override table

Zero-config day one: an org "has" a domain when a verified member uses it (public providers excluded). `organization_domains` overrides both directions — adding domains a young org hasn't populated yet, and suppressing domains an org doesn't want matching (e.g. a consultant's client domain appearing via a guest member). Derivation is a query, not a synced column — correctness over cache until scale demands otherwise.

## Decision 4 — Request lifecycle is deliberately small

Status: pending → approved | declined | expired (~7 days). One open request per (user, org); declining applies a cool-down before re-request (prevents nagging). Approved → membership created via the existing team-member machinery + notification. No invitation counter-flow here — org-initiated invites already exist elsewhere; this is only the inbound direction.

## Open questions

1. Multiple matching orgs on one domain (rare: two orgs both employing `acme.com` users) — present all matches, or the largest? Default proposal: list all, capped at 3.
2. Cool-down length after decline (proposal: 30 days).
3. Should org admins get a setting to disable inbound join requests entirely? Cheap flag; recommend yes at Business+ (governance texture) — confirm with Dan.
