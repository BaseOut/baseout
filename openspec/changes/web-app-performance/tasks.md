# Tasks

## 1. Measure

- [ ] 1.1 Profile the reported-slow surfaces (Space list, dashboard/index): SSR query count/time vs client JS/hydration cost. Record the dominant cost (P1).
- [x] 1.2 Interaction inventory (headless pass, 2026-07-15): `setButtonLoading` is adopted at 18 sites; the network-heavy views (`SchemaView` + `schema/{Browse,Changelog,Chat,Health,Relationships}Tab.astro`) each ALREADY carry loading feedback (loading-spinner/skeleton/aria-busy). No mechanical "zero-feedback button" gap surfaced. Finding the real missing-feedback cases (esp. ChatTab's 7 calls / HealthTab's 5) needs per-interaction exercise in a browser — do NOT add spinners blindly where feedback already exists (§1.5/§3.2). Both this and 1.1/§3 profiling are browser-gated; resume in a session that can drive a browser.

## 2. Loading feedback (close the inventory gaps)

- [x] 2.1 Closed the genuine button gaps found in the schema tabs via the canonical `setButtonLoading` (§4.5) — replacing `disabled`-only / status-text-only / zero feedback:
  - HealthTab: **Re-run scoring** (was `disabled`-only) + **Save/Reset prompt** (had ZERO feedback on the POST).
  - RelationshipsTab: **Confirm/Dismiss** synced-view actions (`disabled`-only) + **Create** submit (status-text-only, no button spinner).
  - ChatTab: **New thread** (`disabled`-only).
  - Deliberately LEFT (already have context-appropriate feedback, converting would be churn per §1.5/§3.2): ChatTab **Send** (shows an optimistic *pending assistant bubble*); the scope `<select>` background PATCH and prompt-dominated **Rename** (marginal). Documented here so the omissions are intentional, not missed.
- [x] 2.2 Non-button waits (schema-tab data loads) already render a daisyUI `loading loading-spinner` region on fetch (verified in Browse/Changelog/Health/Relationships/Chat) — no change needed.
- [ ] 2.3 **Visual spot-check is browser-gated** — these are `.astro` inline `<script>` DOM handlers (not unit-tested in this repo; `setButtonLoading` itself is covered by `lib/ui.test.ts`). Confirm each fixed button shows a spinner + clears on the error path in a browser session. Typecheck is green.

## 3. Optimise the dominant cost

- [ ] 3.1 Apply the targeted fix identified in 1.1 (e.g. tighten SELECTs, defer non-critical islands to `client:idle`/`client:visible`, drop a redundant round-trip). Low blast radius (§3.2) — no data-loading rewrite.
- [ ] 3.2 Re-measure the same surface; record before/after.

## 4. Verification

- [ ] 4.1 Mobile responsiveness of any new loading UI at <375 / <768 / <1024 (§4.3).
- [ ] 4.2 `pnpm --filter @baseout/web typecheck` + `build` green; Storybook coverage test green if a story variant was added.
- [ ] 4.3 Demo: open a slow surface — spinner shows during the wait and clears; re-measured load time improved. Capture the numbers in the commit `Verification` section (§3.8).
