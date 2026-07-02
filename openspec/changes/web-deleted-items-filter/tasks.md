## Status

Web-only, client-side. Browse already receives per-entity `status` from `getSchema`; this hides `removed` by default and adds an "Include deleted" reveal. No engine/DB change. The removal **date** and any server-side `include_removed` read are the paired `server-removed-item-filtering` follow-up — the UI shows the date only when present.

---

## 1. Pure filter logic (TDD)

- [x] 1.1 Failing tests `apps/web/src/lib/schema-docs/deleted-filter.test.ts` (8): `isRemoved` (`removed`→true; `active`/`unknown`/null→false), `countDeleted({bases,tables,fields,views})` summing only `status='removed'` across all four levels (asserts `unknown` excluded), and `removalNote` (date appended only when present).
- [x] 1.2 `apps/web/src/lib/schema-docs/deleted-filter.ts` — pure helpers `isRemoved`/`countDeleted`/`removalNote`. No DOM, no React. Green (8/8).

## 2. Browse default-hide + Include-deleted toggle

- [x] 2.1 `SchemaView.astro` Browse tree — each removed entity `<li>` gets `data-removed` + `hidden` by default (all four levels) and a muted (`opacity-50`) button + `Badge variant="warning"` "deleted" + the `removalNote()` "no longer in Airtable" note (bases badge changed `removed`→`deleted` for consistency). "since &lt;date&gt;" lights up automatically once the engine supplies a removal date.
- [x] 2.2 Filter control atop the tree Card: an "Include deleted (N)" daisyUI `toggle`, shown only when `deletedCount > 0`. Vanilla `<script>` flips `el.hidden` on `[data-removed]` rows. No refetch, no spinner (pure client interaction).
- [x] 2.3 Removed rows stay navigable — they keep `.entity-link` + `data-target-*`, so the existing click → `docs-by-entity` detail (with its `removed from Airtable` badge) still fires once revealed.

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/web test:unit deleted-filter` 8/8 green + `typecheck` 0 errors + `build` green. No stray `console.*` (§3.5).
- [ ] 3.2 Human smoke: open `/schema` Browse on a Space that has deleted entities → removed items hidden by default, "Include deleted (N)" reveals them muted+badged, `unknown` stays visible, toggle hides again. (Needs a managed_pg Space with a `removed` entity; engine runs `--remote`.)
