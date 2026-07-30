# workflows-base-collaborators — Tasks

## 1. Helper (apps/workflows/_lib, test-first)

- [ ] 1.1 Metadata-fetch helper: GET `/v0/meta/bases/{baseId}` with the four include params via the existing Airtable client; returns body verbatim or a typed skip reason (injected `fetchImpl` tests: 200, 4xx, network error)

## 2. Task orchestration (backup-base)

- [ ] 2.1 Insert the capture step after the schema fetch; POST verbatim to collaborators-sync; once per base per run
- [ ] 2.2 Failure isolation: skip reasons land in run progress as `collaborators: skipped(reason)`; record/attachment/comment stages provably unaffected in the task test

## 3. Close out

- [ ] 3.1 End-to-end task test with fakes: schema fetch → metadata capture → sync POST ordering; error path leaves other stages untouched
- [ ] 3.2 Typecheck + `pnpm --filter @baseout/workflows test` green; no `cloudflare:workers` imports
