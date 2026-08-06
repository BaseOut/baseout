# State Management

Cross-component reactive state lives in [nanostores](https://github.com/nanostores/nanostores). Server state hydrates into stores via a JSON-script tag — there is no `@nanostores/astro` package; the pattern is hand-rolled.

The canonical hydration example is [src/pages/index.astro](../src/pages/index.astro) + [src/stores/account.ts](../src/stores/account.ts). Treat that pair as the template for new hydrated stores.

## Store Layout

[src/stores/](../src/stores/) holds one file per logical store. Today's set:

| Store | File | What it holds |
|---|---|---|
| `$account` | [src/stores/account.ts](../src/stores/account.ts) | Current viewer (user + org + space + role); hydrated from middleware |
| `$dashboard` | [src/stores/dashboard.ts](../src/stores/dashboard.ts) | Dashboard data (recent runs, alerts, etc.) |
| `$pageHeader` | [src/stores/pageHeader.ts](../src/stores/pageHeader.ts) | Page title / breadcrumbs |
| `$spaces` | [src/stores/spaces.ts](../src/stores/spaces.ts) | List of Spaces available to the viewer |
| `$connections` | [src/stores/connections.ts](../src/stores/connections.ts) | Active OAuth Connections |

Stores must be small and serialisable. Composite values are derived via `computed`, not duplicated.

## Hydration Pattern

Server-rendered Astro pages emit a `<script type="application/json">` tag with the initial value, and a small module script reads it and calls `$store.set(...)` on the client.

This avoids ad-hoc `window` globals and keeps the store as the single source of truth.

The minimal shape, lifted from the canonical example:

```astro
---
const initial = { /* server-resolved data */ }
---
<script type="application/json" id="hydrate-account">{JSON.stringify(initial)}</script>
<script type="module">
  import { $account } from '../stores/account'
  const data = JSON.parse(document.getElementById('hydrate-account').textContent)
  $account.set(data)
</script>
```

For framework islands (React, Solid, Vue, Lit), use the matching `@nanostores/<framework>` adapter. In vanilla `<script>` blocks, import the atom and use `.subscribe()` / `.get()` / `.set()`.

## Reset on Logout

The logout handler **must clear every user-scoped store**. Failing to reset is a security bug — the next user on the same browser session can see stale data.

The canonical pattern lives in `src/components/layout/Sidebar.astro`'s logout handler — every new user-scoped store added to [src/stores/](../src/stores/) needs a corresponding `$store.set(null)` (or empty default) in that handler.

## What Not To Store

Client-side state is **not** for secrets, auth tokens, or sensitive PII. Anything that should not appear in the page source must remain server-only.

If a piece of data needs to be available to client code but not to a page-source `view-source`, derive it server-side and pass only the safe projection (e.g. a display name, not an internal ID).

## Where to Look

Pointers to source files and rules.

- Stores: [src/stores/](../src/stores/)
- Per-app rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md) §4
- Hydration example: [src/pages/index.astro](../src/pages/index.astro)
- nanostores docs: <https://github.com/nanostores/nanostores>
