Knowledge graph for `@baseout/api` — the public REST API + MCP server (target domain `api.baseout.com`; live today at `baseout-api-dev.openside.workers.dev`). Cross-cutting facts (naming, security, schema) live in the [root lat graph](../../../lat.md/). Cross-graph wiki refs aren't validated by `lat check` — use plain markdown links to reach the root graph.

Everything derives from a single operation registry ([src/lib/registry.ts](../src/lib/registry.ts) + [src/operations/](../src/operations/)): the router, the OpenAPI document, and the MCP tool catalog are all generated from the same array, so REST/docs/MCP drift is structurally impossible. Reads shipped via `api-rest-read`/`api-mcp`; the write plumbing (PATCH/DELETE, write scopes, body validation, attribution) via `api-write-foundation`.

## Sections

Each file documents one slice; navigate by `lat locate` or `lat section`.

- [[architecture]] — request pipeline, operation registry, MCP mount, deployment state
- [[versioning]] — URL versioning (`/v1/...`); breaking-change policy
- [[service-auth]] — Bearer api_tokens (hashed) + scopes; outbound SERVER service binding with `INTERNAL_TOKEN`
