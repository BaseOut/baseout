Knowledge graph for `@baseout/sql` — public read-only SQL REST API at `sql.baseout.com` (Pro+ tiers). Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

`apps/sql` is currently a scaffold ([src/index.ts](../src/index.ts) only). The sections below describe the intended surface; concrete code lands in later phases.

## Sections

The intended internals of `apps/sql`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Worker entry, Hyperdrive routing, tier gating
- [[read-only-default]] — Read-only by default; write access is an explicit Enterprise opt-in
- [[provisioning]] — How customer client DBs are provisioned by `apps/server`
