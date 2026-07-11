# shared-ai-controls — Design

## Three levels, one ordering

`off < schema_only < all`, and every AI feature declares the minimum level it needs:

| Feature | Requires |
|---|---|
| Schema chat, AI schema docs, health-metric prompts (metadata only) | `schema_only` |
| Data chat / any AI over record values | `all` |
| Everything AI | blocked at `off` |

The ordering is the whole model — new AI features slot in by declaring a level, no new settings.

## Org ceiling, Space brake

- Org setting = policy ceiling, editable by Org admins. Space setting = further restriction, editable by Space-level admins. Effective = `min(org, space)`.
- A Space can never *raise* above the Org ceiling — the UI shouldn't offer it and the engine clamps it anyway (a Space set `all` under an Org set `schema_only` resolves to `schema_only`; the stored Space value is preserved so lifting the Org ceiling restores intent).
- **Default `all` at both levels.** Rationale: the product decision is allow-now; a `schema_only` default would silently break data chat for everyone and make the setting a gate rather than a brake. The trade-off (record data can reach the AI provider by default) is deliberate and disclosed — see claims hygiene below. Existing rows backfill to `all`.

## Enforcement points (server-side; UI is UX)

`resolveAiPolicy(orgId, spaceId)` — one query (or joined read), resolved per request, passed down explicitly (no ambient state):

1. **Route guards**: chat-send (schema scope needs ≥ `schema_only`; any data-scoped context needs `all`), doc-AI generation, future AI routes. Violations → 403 `ai_disabled_by_policy` with the effective level in the body so the UI can render the right message.
2. **Context assemblers** re-assert immediately before building the AI payload (defense in depth — a route added later that forgets the guard still can't leak).
3. **Workflows tasks** receive the resolved policy in the payload AND the enqueue is itself guarded — a task never decides policy, it only carries proof the engine decided.
4. **Mid-conversation tightening**: policy is read per send, so tightening applies to the *next* message; in-flight tasks complete (bounded staleness of one message).

## Audit + visibility

- Setting writes append an audit row: actor, scope (org/space), old → new. This is the artifact a compliance review asks for.
- The engine exposes the effective policy + both raw values so the UI can show "Effective: Schema only (restricted by your Organization)" — never a mystery why a toggle is inert.

## Claims hygiene (must ship together)

The "we never send your record data to AI" claim becomes conditional the moment `all` exists. Approved formulation: **"You decide what AI can see: everything, schema metadata only, or nothing — enforced server-side and audited."** The GTM claims inventory (§4.2/§6.5) and any published sovereign-AI copy update in the same release. `schema_only` remains an honest one-click way to restore the old posture — worth naming in docs ("metadata-only mode").

## Non-goals

Per-user AI permissions, per-feature toggles (the level ordering covers it), per-base scoping, retention/BYO-model controls — all future changes if demanded.
