# @baseout/support

Baseout support portal — **Starlight** docs + support chat + tickets + public roadmap. Target: support.baseout.com. Spec: `openspec/changes/support-portal/`.

```bash
pnpm --filter @baseout/support dev      # http://localhost:4342
pnpm --filter @baseout/support build    # static build → dist/
pnpm --filter @baseout/support deploy   # build + wrangler deploy (Workers static assets)
```

Current state: docs seeded (placeholders), `/roadmap` on fixture data with local-only voting, `/chat` with a stub responder + client-side message budget, `/tickets` signed-out only. D1/KV bindings are declared-but-commented in `wrangler.jsonc` until provisioned. The ticketing auth bridge and the chat engine are deferred pairings — see the spec's task 3.
