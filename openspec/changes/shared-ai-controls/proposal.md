## Why

The decision on record-data AI has landed: **data chat is allowed now** — which retires the blanket sovereign-AI "metadata-only, always" stance from `server-schema-chat` and replaces it with **customer-controlled AI policy**. Customers (especially agencies and compliance-bound orgs) need to dial AI usage down or off: some want everything, some are fine with AI over schema metadata but never record data, some want no AI at all. That control must exist at the Organization level (policy) with per-Space restriction, and be enforced engine-side — not just hidden in the UI.

## What Changes

- **A three-level AI-usage policy**: `all` (AI everywhere — schema metadata AND record data) · `schema_only` (AI over schema metadata/docs only — never record data; today's shipped posture) · `off` (no AI features at all).
- **Two scopes, restrictive resolution**: an Organization-level setting (the ceiling) and a per-Space override that can only restrict further. Effective policy = `min(org, space)` on the order `off < schema_only < all`. **Default: `all`** at both levels (the product decision is allow-now; the setting is the brake, not the gate).
- **Master DB (web-owned migrations)**: `organizations.ai_usage` + `spaces.ai_usage` (enum `all | schema_only | off`, default `all`). Setting changes write to the audit log (both are security-relevant policy changes).
- **Engine enforcement** (`apps/server`): a single `resolveAiPolicy(orgId, spaceId)` helper consumed at every AI entry point — schema-chat send + context assembly reject when `off`; data-scope chat context (per `server-data-browse`) rejects unless `all`; any future AI feature (AI docs, anomaly detection) declares which level it requires. Enforcement is server-side at the route/assembly layer; UI gating is UX on top.
- **Web**: settings write paths (Org settings + Space settings) with authz (Org policy editable by Org admins only), audit rows, and the proxy plumbing the UI reads the effective policy from. Settings UI itself is designer-facing — paired ui-only change `ai-settings`.
- **Claims hygiene**: marketing/docs language changes from "metadata-only, always" to "you control it — everywhere, schema-only, or off; record data is used only when your policy allows it." The GTM claims inventory must be updated in the same release that ships `all`-level data AI (GTM §6.5).

## Capabilities

### New Capabilities
- `ai-controls`: the two-scope, three-level AI-usage policy — storage, restrictive resolution, engine-side enforcement at every AI entry point, and audited setting changes.

### Modified Capabilities
- `schema-chat`: send/context paths consult the effective policy (`off` blocks; `schema_only`/`all` allow).
- `data-browse`: record-data chat context requires effective `all` (see the updated `server-data-browse`).

## Impact

- **apps/web**: canonical migrations (`organizations.ai_usage`, `spaces.ai_usage`); settings API routes (validation + authz + audit); capability/policy exposure to the UI.
- **apps/server**: `lib/ai-policy.ts` (`resolveAiPolicy` — pure resolution + a cached per-request read), enforcement wired into schema-chat routes and the data-chat context path; policy mirrored into task payloads so workflows tasks never act on stale policy (task re-checks via engine callback if long-lived).
- **Security**: enforcement lives engine-side; UI checks are UX only. Policy changes are audited (who, when, old → new). Defense in depth: context assemblers assert the policy again immediately before building AI payloads.
- **Pairs with**: ui-only [`ai-settings`](../../../../ui-only/openspec/changes/ai-settings/) (settings UI + disabled-state affordances), `server-data-browse` (data-chat context now in scope, gated on `all`), `server-schema-chat` (enforcement point).
