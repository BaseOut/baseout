## 1. Pure builders (TDD)

- [x] 1.1 Unit tests for cursor codec, `parseCommentsFilters`, parameterized WHERE/keyset/ORDER BY, `mapCommentRow`
- [x] 1.2 `per-space/comments-read.ts` implementing the builders

## 2. IO + route

- [x] 2.1 `per-space/comments-read-io.ts` — `queryCommentsPage`
- [x] 2.2 `pages/api/internal/spaces/data-comments.ts` + register in `index.ts`
- [x] 2.3 Route-layer gate tests (401 / 405 / 400)

## 3. Web proxy

- [x] 3.1 `api/spaces/[spaceId]/data/comments.ts` + unit test mirroring `records.ts`

## 4. Verification

- [x] 4.1 Targeted Vitest suites green; no `console.*`
