Knowledge graph for `@baseout/hooks` — Airtable webhook receiver at `webhooks.baseout.com`. Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

`apps/hooks` is currently a scaffold ([src/index.ts](../src/index.ts) only). The sections below describe the intended surface; concrete code lands in later phases.

## Sections

The intended internals of `apps/hooks`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Public webhook endpoint, HMAC verification, scope vs `apps/server`
- [[airtable-webhook-flow]] — Airtable webhook payload shape, dedup, forwarding
- [[service-auth]] — Outbound HMAC token to `apps/server`
