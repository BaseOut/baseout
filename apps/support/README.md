# @baseout/support

Baseout support portal — **Starlight** docs + support chat + tickets + public roadmap. Target: support.baseout.com. Spec: `openspec/changes/support/`.

```bash
pnpm --filter @baseout/support dev      # http://localhost:4342
pnpm --filter @baseout/support build    # static build → dist/
pnpm --filter @baseout/support deploy   # build + wrangler deploy (Workers static assets)
```

Current state: provisional and expected to change. Docs are seeded, `/roadmap` is on fixture data with local-only voting, `/chat` has a stub responder plus client-side message budget, and `/tickets` redirects to the signed-out contact door. D1/KV bindings are declared-but-commented in `wrangler.jsonc` until provisioned. The ticketing auth bridge, chat engine, production host/DNS, and apps/web CTA retargeting are deferred pairings — see `openspec/changes/support/`.
