Knowledge graph for `@baseout/web` — the customer-facing Astro SSR app. Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

`apps/web` also has a per-app [.claude/CLAUDE.md](../.claude/CLAUDE.md) with the long-form frontend rules. This graph indexes the load-bearing surfaces; for any nuance, check that file.

## Sections

The internals of `apps/web`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Astro SSR entry, middleware, account-context loader, deployment shape
- [[auth]] — better-auth (magic link), session cache, middleware gating, public path list
- [[routes]] — Page + API route map; what's customer-facing vs internal
- [[state-management]] — nanostores layout, hydration via JSON-script tag, logout reset rule
- [[theme]] — `@opensided/theme` primary, daisyUI secondary, custom CSS fallback
- [[loading-states]] — `setButtonLoading` helper, `try/finally` discipline for server waits
