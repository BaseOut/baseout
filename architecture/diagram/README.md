# architecture/diagram

Interactive ReactFlow view of [`../systems-overview.md`](../systems-overview.md).
Six tabs; `Overview` is the landing tab.

**`systems-overview.md` is the source of truth.** This app has no runtime data
source — every node and edge is committed TypeScript. When the doc changes, edit
`src/diagrams/*.ts` in the same change, or the diagram silently becomes a
confident lie.

## Run

```bash
pnpm --filter @baseout/arch dev       # http://localhost:4344
pnpm --filter @baseout/arch build     # -> dist/
pnpm --filter @baseout/arch typecheck
```

## Deploy

Static-assets Worker, same shape as `apps/support` — no `main`, no bindings, no
secrets, so there is nothing for `secrets.required` to gate.

| Env | Worker | Hostname |
|---|---|---|
| `dev` | `baseout-arch-dev` | workers.dev alias |
| `staging` | `baseout-arch` | **`arch.baseout.dev`** (custom domain) |
| `production` | `baseout-arch` | none — no route on purpose |

Workers Builds settings:

- Build command: `pnpm --filter @baseout/arch run build:staging`
- Deploy command: `pnpm --filter @baseout/arch run deploy:staging`

`arch.baseout.dev` needs a proxied DNS record in the `baseout.dev` zone before the
custom domain will attach.

> **Put Cloudflare Access in front of `arch.baseout.dev`.** The diagram carries no
> credential, but it does render internal topology — account IDs, the tunnel
> hostname, Hyperdrive and VPC service IDs. Access is a Zero-Trust setting, so it
> cannot be pinned in `wrangler.jsonc`; it has to be configured once in the
> dashboard. `index.html` sets `noindex, nofollow` as a floor, not a control.

## Structure

```
src/
  types.ts          Node/edge types + the svc()/group()/note()/edge() builders
  nodes.tsx         Three custom node renderers + the 8-handle Ports component
  App.tsx           Tab shell, legend, hash routing (#workers etc.)
  styles.css        Theme tokens (light + dark), node/edge styling
  diagrams/
    overview.ts         Main tab — edge to database, one request deep
    environments.ts     Three-provider account separation; dev-shares-staging
    workers.ts          Worker topology, service bindings, runtime bindings
    data-network.ts     §9 drawn — the tunnel path, two consumers one door
    storage.ts          Snapshot destinations — 5 live writers, 3 accepted-but-not
    background-cicd.ts  Runtime job flow + Workers Builds pipelines
```

### Adding a node

```ts
svc('id', x, y, { label: 'Thing', sub: 'detail', status: 'built', tag: 'note' })
```

`status` uses the doc's own vocabulary (`live` / `built` / `proposed` /
`external` / `infra`) and drives the colour, so a node's appearance means exactly
what the doc's status table says.

### Adding an edge

```ts
edge('id', 'sourceId', 'targetId', { label: 'why', kind: 'thick', from: 'sb', to: 'tt' })
```

Every node exposes a source *and* a target handle on all four sides — `s*` for
sources, `t*` for targets — so edges can run in any direction, including
right-to-left and bottom-to-top. Defaults are `from: 'sr'`, `to: 'tl'`.

`kind`: `solid` = request/data path · `dashed` = async or build-time ·
`thick` = the critical path (used for the only route to the master database).

Layout is hand-positioned on purpose. It is deterministic, diffs readably, and
avoids a layout dependency for ~60 nodes.
