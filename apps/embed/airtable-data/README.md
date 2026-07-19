# @baseout/embed-airtable-data

Baseout's **Airtable data-layer extension** — the sidebar wrapper at the data
layer. Thin and UI-less by design: one full-height iframe of the Baseout app
(`/embed?host=airtable-data`), context derived from the blocks SDK cursor and
streamed over the embed messaging protocol (`@baseout/embed-protocol`, via
`@baseout/embed-core`).

## Not a pnpm workspace member — on purpose

The Airtable blocks CLI owns this package's install/run lifecycle, and its
React peer set must not constrain the monorepo (see
`openspec/changes/embed/design.md` Decision 1). `@baseout/embed-core` is
consumed as a `file:../core` dependency — **build core first**:

```bash
pnpm --filter @baseout/embed-core build
```

## Dev run (human loop — needs Airtable extension dev access)

1. `npm install -g @airtable/blocks-cli` and `block auth` with an account that
   has extension development enabled.
2. In a development base: Extensions → Add an extension → Build a custom
   extension → "Remix from an existing repository" is NOT needed; create the
   extension and run `block init` OUTPUT INTO A TEMP DIR ONCE to obtain the
   `.block/remote.json` for this base, then copy that `.block/` directory
   here (it is gitignored — per-developer/per-base).
3. `npm install && block run`, open the extension in the base.
4. **First check (design Q1):** the extension sandbox must permit framing the
   app origin. If the iframe is blocked by the sandbox CSP, STOP and surface —
   do not work around.

Smoke: boot → handshake completes (`connected` in the panel console) → the
embedded app navigates to this base's surface → switch tables → the app
receives the context update → sign-out state shows the app's sign-in prompt →
"Sign in" opens a top-level tab.

`APP_ORIGIN` in `frontend/index.tsx` is baked per build (dev default
`https://baseout.local:4331`); change it only via a release build script,
never a runtime setting.
