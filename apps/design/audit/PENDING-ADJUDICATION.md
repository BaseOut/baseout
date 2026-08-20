# ~~PENDING~~ — **THE AUDIT IS CLOSED** (2026-08-14, final consolidation)

**Nothing in this audit is awaiting adjudication, and nothing is awaiting a ruling.** All 40 surfaces,
all 8 journeys and all 16 X lenses are adjudicated and registered; the nine `NEEDS-MEASUREMENT` claims
are measured; Oleh's ten rulings are applied. **514 register rows · 49 decisions · 74 S1s.**

| pass | date | scope | rows | decisions |
|---|---|---|---|---|
| 1 | 2026-08-07 | J01–J08 + S06–S18 (interim) | 160 | D01–D21 |
| 2 | 2026-08-12 | S06–S09 Data | 30 | D22, D23 |
| 3 | 2026-08-12 | S10–S13 Schema | 52 | D24–D27 |
| 4 | 2026-08-12 | S14–S18 Schema | 55 | D28–D31 |
| 5 | 2026-08-13 | S19–S24 Reports + Sources | 42 | X-A, X-B, X-C |
| 6 | 2026-08-14 | S24–S40 forms · connect · Settings · auth | 85 | D32–D39 |
| 7 | 2026-08-14 | X01–X15, the cross-cutting lenses | 77 | D40–D49 |
| **8** | **2026-08-14** | **final consolidation — measurements, Oleh's rulings, four late findings files** | **13** | **0 new; 12 amended** |
| | | **total** | **514** | **49** |

Cumulative severity: **S1 74 · S2 231 · S3 185 · S4 23 · 1 unsevered NOT-OURS question.**

**Read `audit/SHIP-ORDER.md` before touching `apps/web`.** It is rewritten, and it now carries a
**blocking gate** between items 17 and 18.

---

## What the final pass settled

- **D17 is COMPLETE.** 46ch bound — **and measured to change no rendering at any width**, which is
  recorded in the decision so nobody looks for the improvement, fails to find it, and "fixes" the cap
  a second time. X04-F2 moves **S3 → S4**.
- **D19 is COMPLETE.** `Running` is **primary (blue)** (Oleh, ruling 5). Eight live amber sites change
  — seven `Running` and one `Generating` — and the state-word table's colour column is written.
- **D15 is DEFERRED behind a HARD GATE**, not a bullet in a reopen list. Oleh, ruling 9. The gate sits
  between ship items 17 and 18 and its deliverable is either a bound vessel or a written ACCEPT
  declining the four rows filed against it (S25-F4's structural half · S25-F12 · X01-F2's component
  half · the residue of X01-F1/F5).
- **One new S1** — `.ph-panels` has no width, so the panel-width ruling `specs/16-responsive.md` §8
  records as *applied and verified* is conditionally dead. It is **ship item 5**.
- **X06-F8 moves S3 → S2** and its mechanism is replaced: Escape has **no owner**, not a
  non-deterministic winner. 24 deliveries per press, 13 of them after the one `stopPropagation()`.
- **Two rulings removed scheduled work** (the ~14-file card-padding edit; D41's wrap rationale) and
  **two added items no finding carried** (`toolbarFit`'s threshold; the badge gate switch-on).
- **The audit's own drifting counts are explained and fixed.** Two NUL bytes at
  `DataBrowse.astro:936` made one file invisible to every binary-classifying grep — six counts and one
  `document`-level Escape listener were being silently dropped. **This closes the sixth wave's
  under-audited item 11.**

---

## What is NOT closed — and none of it is adjudication

1. **The D15 gate.** A decision waiting on a trigger that is now written down as blocking. Not a
   finding, not a ruling — a scheduled re-open with a named deliverable.
2. **The six pending client decisions.** **#4 blocks all of Billing and #6 blocks all of Help**, and
   #6 — *does a support channel exist at all* — has still never been put to the client. **Held
   deliberately**: Oleh's ruling 10 is *keep them, assemble at the end of the session*
   (`audit/CLIENT-QUESTIONS-PENDING.md`). Until they are answered, S33 and S35 cannot be designed.
3. **Eight things are still unmeasured**, listed at the foot of `audit/SHIP-ORDER.md`. **None of them
   blocks a ship item**, and they are a different list from the nine debts this audit opened with:
   icons at narrow widths · classic-scrollbar platforms · `/integrations/configure/bases` · 15
   runtime-string icon lines · `.rl-detail-panel`'s width · a screen-reader probe · row counts for the
   six unbounded tables · three empty-state families nobody has seen empty.
4. **One implementer decision was deliberately not made by the lead.** `.hm-conn-badge` is `1rem`
   square, so lifting its glyph to 12px may be a **badge-size** decision rather than an icon one. It
   must be decided at the element, not from a register row.

---

## What the audit did NOT do — carry this forward, it has not been smoothed over

The full list is at the foot of each wave in `audit/REGISTER.md`. These are the ones that most affect
whether the fixes will be right:

1. **No row in any wave had a second reader.** Still true, including this pass.
2. **No number was verified twice by two instruments** — *except* the ones in the final pass's
   re-count table, which were taken twice by two greps precisely because the first instrument was
   lying.
3. **"Chrome would not lay out below ~500px" is only PARTLY retired.** `emulate` does lay out at 390
   and 425 and was used for every narrow number in the final pass. **Every 390 claim in waves 1–6 was
   taken with `resize_page` and is still a 500-wide layout** — those rows are not retroactively
   verified.
4. **62 rows are inferred from declarations** by source-only lenses, in a tree with four documented
   mechanisms by which a rule is written and dead. Nine of the fourteen `NEEDS-MEASUREMENT` claims are
   now measured; the rest were never gating a ship item and were not taken.
5. **Twelve of the 28 status registries are asserted defective on a grep** and were never read. Four
   of eighteen were verified.
6. **The gate still cannot verify D17.** Three of the 28 empty-state families have never been seen
   empty by anyone. That is ship item 8's job.
7. **X16 was never lens-passed**, and the assertion that `specs/16-responsive.md` covers it was never
   re-checked against the lens template. **This pass found two defects inside that very document**
   (§8's certified number, §3's stale padding split), which is weak evidence against the assertion.
8. **`.hm-status`'s ACCEPT rests on one reader's judgement** and remains the row most likely to be
   wrong.
9. **A fifth of the lens evidence was nearly lost** (`X10-X11-X14.md` was not in its step's input
   list), and the same thing happened again in this pass — **four findings files existed that no
   register row reflected.** Twice is a pattern: **anyone auditing this audit should check the findings
   directory against the register by hand rather than trusting an input list.**

---

## Next

Not more auditing. **Start at `audit/SHIP-ORDER.md`, item 1.** The measurement debt that used to sit at
the foot of that file is paid; what is there now is a list of unknowns, not a list of blockers.
