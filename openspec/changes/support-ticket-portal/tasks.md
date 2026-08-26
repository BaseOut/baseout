# Tasks

## 1. Catalog first (THE SEQUENCE)

- [ ] 1.1 `pattern-message-thread` in `storybook.ts` — written from `RecordPanel.astro:907-953`, not
      from `DataComments.astro`; inherits the no-avatars ruling from `pattern-schema-chat` and the
      "never invent an author" ruling from the `DataComments` verdict.
- [ ] 1.2 `pattern-file-attach` — the upload half is new; the file-chip half is lifted from
      `pattern-changelog-timeline`, where it was already decided. Carries the third-party-data line
      that belongs above the picker, not after a rejection.
- [ ] 1.3 Customer-facing status wording as a rulings table: `Open` · `Awaiting your reply` ·
      `Closed`, with `warning` on exactly one of them and the reason attached.

## 2. The receipt — the smallest change with the largest effect

- [ ] 2.1 Done-state carries the case number, the address the mail went to, and "a person answers by
      replying to that email". No duration, anywhere.
- [ ] 2.2 The same three facts in the confirmation email's contract (`design.md` handoff section) so
      the backend cannot ship a receipt that disagrees with the screen.
- [ ] 2.3 A copyable case number — `Copyable id` already exists in the catalog.

## 3. Deflection

- [ ] 3.1 Suggested articles under the subject field, reusing `submit.ts:294-341`'s phrase-then-words
      ranking with its ≥2-word overlap floor; invert `isDocsUrl` and point it at the subject.
- [ ] 3.2 Verify against a BUILD, never `astro dev` — Pagefind indexes at build time and returns
      nothing in dev, so this feature looks broken in the exact place it will be tested first.

## 4. The chat exit

- [ ] 4.1 Persistent low-emphasis `Ask a person` in the composer row from turn one; promoted after
      two consecutive answers that cite no documentation page.
- [ ] 4.2 The handoff payload shown collapsed, editable and removable before send: question verbatim,
      AI attempts summarised, pages that did not help, current page URL, reason.
- [ ] 4.3 Wait copy names the channel, the address and the event that ends the wait. Never a clock.

## 5. My requests + the thread

- [ ] 5.1 `My requests`: `Open / Closed / All` with counts, sorted by last activity, per-tab empty
      states. The label is `My requests` — zero of the fifteen portals surveyed said "My tickets".
- [ ] 5.2 Thread route: two parties, per-message timestamps, file chips, quoted history behind
      `Show quoted text · N lines`.
- [ ] 5.3 Reply composer; sending into a closed case reopens it and says so inline before the send.
- [ ] 5.4 A customer-pressed `Close` — someone who solved it themselves should not have to write
      "never mind".

## 6. Gates and verification

- [ ] 6.1 `pnpm typecheck` and `pnpm smoke-support` green with COUNTS printed; every new route added
      to the smoke list.
- [ ] 6.2 Measured in a real browser at 1440 and 390 via `emulate`, `window.innerWidth` printed with
      every measurement.
- [ ] 6.3 `ui-reviewer` per surface against explicit criteria, since no design-system gate reaches
      this app.

## 7. Deferred, filed rather than built

- [ ] 7.1 Monorepo pairing: auth bridge, ticket storage, outbound mail, the two ids, the Space and
      run references, attachment storage and its cap.
- [ ] 7.2 An Inbox row in `apps/web` — "Support replied" is an Activity signal, one line in
      `KIND_META`, and it belongs to the paired change.
