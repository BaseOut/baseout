# baseout-web-server-service-binding-staging-prod

Follow-up to [openspec/changes/baseout-web-server-service-binding/](../baseout-web-server-service-binding/). The dev half of the apps/web ↔ apps/server service binding is live; this change finishes wiring for staging + production once those backend Workers are deployed.

Pre-req: `baseout-server-staging` and `baseout-server` Workers must be deployed before the corresponding `apps/web` deploys, otherwise the binding can't resolve and the deploy fails.

This change is intentionally a thin proposal+tasks pair — no design.md, since the design is identical to the prior change just scoped to different envs. See the prior change's [design.md](../baseout-web-server-service-binding/design.md) for the architecture.

When tasks are complete, run `/opsx:apply` to drive implementation, then `/opsx:archive`.
