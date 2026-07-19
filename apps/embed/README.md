# apps/embed — Baseout host wrappers

The outer frames that embed the Baseout web app per PRD §6.7, built on the
embed messaging protocol (`packages/embed-protocol`; child side in
`apps/web` — see `openspec/changes/shared-embed-protocol/`). Wrappers are
**thin and UI-less**: one full-viewport iframe of `/embed?host=<kind>`, a
host bridge, per-host context acquisition — every screen, prompt, and error
state lives in the Baseout app.

This directory is an **umbrella of per-host packages** (deviation from
one-app-one-package, documented in `openspec/changes/embed/design.md`
Decision 1):

| Package | Host | Workspace member | Hosted by |
|---|---|---|---|
| `core/` | shared wrapper (`mountEmbedHost`) | yes | n/a (library) |
| `chrome/` | Chrome extension (MV3 side panel) | yes | Chrome Web Store / unpacked |
| `airtable-data/` | Airtable data-layer extension | **no** (blocks CLI owns it) | Airtable |
| `airtable-interface/` | Airtable interface extension | **no** (blocks CLI owns it) | Airtable |

None of these deploy to Baseout's Cloudflare infrastructure.

## Dev quickstart

```bash
pnpm --filter @baseout/embed-core build    # airtable-* consume core via file:
pnpm --filter @baseout/embed-core test
pnpm --filter @baseout/embed-chrome build  # → chrome/dist, load unpacked
pnpm --filter @baseout/embed-chrome test
```

Airtable hosts: see each package's README (blocks CLI, human-loop dev run).

The app origin is baked at build time (`EMBED_APP_ORIGIN` for chrome;
`APP_ORIGIN` const for the Airtable hosts) — dev default
`https://baseout.local:4331`. The web side must list the host origins in
`PUBLIC_EMBED_ALLOWED_ANCESTORS` (see `apps/web/wrangler.jsonc.example`).
