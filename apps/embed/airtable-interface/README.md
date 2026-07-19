# @baseout/embed-airtable-interface

Baseout's **Airtable interface extension** — the wrapper embedded inside an
Airtable interface. Thin and UI-less: one full-height iframe of the Baseout
app (`/embed?host=airtable-interface`), context streamed over the embed
messaging protocol via `@baseout/embed-core`.

Registered with Airtable as its own extension (separate from the data-layer
one — Airtable treats interface extensions as a distinct type).

## Not a pnpm workspace member — on purpose

Same rationale as `../airtable-data` (blocks CLI owns install/run; React peer
set stays out of the monorepo). Build core first:

```bash
pnpm --filter @baseout/embed-core build
```

## Dev run (human loop)

Follow `../airtable-data/README.md` steps 1–4, but register/run this
extension **inside an interface** on the development base.

**Design Q2 (verify during first smoke):** the exact interface context surface
of the pinned SDK — which hook exposes the hosting interface `pageId`, and how
record binding surfaces. The current mapping uses the cursor's
`activeTableId`/`selectedRecordIds` and omits `pageId` (degrade-to-`baseId`
default). Record actual findings here and adjust `contextOf` accordingly.

Smoke: boot inside an interface → handshake completes → embedded app navigates
to the base surface → select a record (record-bound element) → context update
carries `recordId` → sign-out state → "Sign in" opens top-level.
