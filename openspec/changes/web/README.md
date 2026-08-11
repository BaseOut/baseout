# web

Customer-facing app at `apps/web/` (`@baseout/web`). Astro SSR + better-auth + Drizzle on Cloudflare Workers. Ported from `starter` HEAD `29dfb5b` with the abandoned `server-engine` RPC wire surgically removed.

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md), and [STATUS.md](./STATUS.md) for the implementation snapshot. Spec contracts in `specs/` describe end-state targets — gaps are tracked per-capability in STATUS.md and queued for follow-up `opsx:propose` changes.
