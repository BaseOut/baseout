# Tasks

## 1. Merge rule — TDD

- [ ] 1.1 RED: tests for `mergeInterfaceSources(rows)` — mcp-only passthrough; manual-only passthrough; both → one entity (MCP name/composition, manual payload attached, sources ['mcp','manual']); mcp-removed + manual-active → removed with manual context; null entity ids ungrouped.
- [ ] 1.2 GREEN: `apps/web/src/lib/interfaces/merge-sources.ts` (pure; types mirror the engine row shape with a header comment naming the canonical source).

## 2. Badge

- [ ] 2.1 Extend `StatusBadge` with the provenance variants (Auto / Manual / Auto+Manual) per the two-tier governance — daisyUI classes only, story extended in the same change (coverage test enforces).

## 3. Adoption

- [ ] 3.1 Wire the merge + badge into the Interfaces tab views as `web-automations-interfaces-tabs` builds them (cross-referenced there; if this change lands first, the module + story stand alone and the tab consumes them).
- [ ] 3.2 Cross-reference note added to `web-automations-interfaces-tabs` tasks so its read path MUST consume `mergeInterfaceSources` (the dedupe requirement flagged in `server-mcp-interface-pages` 3.2).

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/web` targeted tests + typecheck green; Storybook story renders the new variants.
- [ ] 4.2 Smoke (once the tab exists): a base with an MCP-captured interface + a manual submission for the same entity shows ONE row with both badges.
