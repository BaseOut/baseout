Knowledge graph for `@baseout/admin` — internal admin / observability surfaces. Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

`apps/admin` is currently a scaffold ([src/index.ts](../src/index.ts) only). The sections below describe its intended surface and rules; concrete code lands in later phases.

## Sections

The intended internals of `apps/admin`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Worker / Astro shape, Google SSO, scope boundary vs `apps/web`
- [[auth]] — Google SSO via better-auth; staff allowlist
- [[surface-contract]] — Internal-only routes; service calls into `apps/server`
