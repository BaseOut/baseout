# Tasks

## 0. Sequencing

- [ ] 0.1 `server-media-index` contract landed (owns the media-sync body); land server-first.

## 1. Emission (TDD)

- [ ] 1.1 Hook the attachment-export path: emit on write AND on dedup-skip (Decision 1); verify BYOS locator stability per provider (design open question 2).
- [ ] 1.2 Batcher (N records / M attachments), per-record `complete`, run-progress `media` entry (Decisions 2/3).

## 2. Verification

- [ ] 2.1 Vitest: emission on write/skip; batch boundaries; outage isolation; incremental visiting rule.
- [ ] 2.2 Dev E2E with the server half: backup a media-heavy base → assets+refs appear with correct dedup; re-run → idempotent; remove an attachment in Airtable → ref removed on next `complete` capture.
