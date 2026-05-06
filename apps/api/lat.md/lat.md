Knowledge graph for `@baseout/api` — public versioned inbound API at `api.baseout.com`. Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

`apps/api` is currently a scaffold ([src/index.ts](../src/index.ts) only). The sections below describe the intended surface; concrete code lands in later phases.

## Sections

The intended internals of `apps/api`. Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — Worker entry, customer API-key auth, scope vs `apps/web`/`apps/server`
- [[versioning]] — URL versioning (`/v1/...`); breaking-change policy
- [[service-auth]] — Customer API keys (hashed) + HMAC service token forward to `apps/server`
