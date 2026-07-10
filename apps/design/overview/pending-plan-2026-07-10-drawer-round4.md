# Drawer round 4 — plan (2026-07-10)

Sources of truth for this round:

1. **Dan's 4:39 video** — `~/Downloads/Refine Field Viewer UI remove Compare, adjust close behavior,
   fix counts, and improve layout.mp4` (transcribed offline; client videos never leave the machine).
2. **Slack thread, 2026-07-09 20:17 → 23:21** — Inbox scope (Dan ⇄ Oleh) and the Pin confusion.

Status of the drawer itself: shipped on `main` = `d5fd829`. Nothing to merge; there is only one branch.

---

## 0. Blocker that is not code

**Dan reviews `ui.baseout.dev/schema`, not localhost.** His recording still shows Compare, cap 5 and the
translucent rail — i.e. an old build. Everything below is invisible to him until the Cloudflare preview
`baseout-ui-preview` is rebuilt:

```
cd apps/design && DEPLOY_TARGET=cloudflare pnpm build && npx wrangler deploy
```

Never run `wrangler deploy` after a default (Node) build. **Redeploy before asking him to look again.**

---

## 1. Decided — just build

| # | Change | Where | Source |
|---|--------|-------|--------|
| 1.1 | **Remove Compare entirely** — button, `computeCompare()`, `.ep-diffhit`, storybook `pattern-panel-compare` | `EntityPanel.astro`, `storybook.ts` | video 0:10 |
| 1.2 | **No `✕` on a collapsed strip.** Strip click = expand only; closing requires expanding first | `EntityPanel.astro` (`.ep-collapsed` rules) | video 1:39 |
| 1.3 | **Fix the count.** `showUndo('Closed oldest panel — 5 max')` is hardcoded while `CAP = 4` | `EntityPanel.astro:1533` | video 2:52 |
| 1.4 | **Inbox: label the Space on each item + filter by Space.** Inbox stays account-level, ABOVE the Space switcher. With 1 Space: no label, no filter. With 2+: both | `Inbox.astro`, `inbox.ts`, fixture | Slack |

Note on 1.3: if §2.2 lands, the toast disappears with the eviction it describes, and this fix becomes moot.
Do §2.2 first, then re-check.

---

## 2. Decide before building

### 2.1 Pin — the model AND the vocabulary (this round's main topic)

Dan, twice: *"couldn't tell what that did or how to 'Un-pin'"* and *"not sure I follow — I couldn't tell
what it was doing when I clicked on it."*

The defect is **not** the semantics. It is that clicking Pin produced no legible state change, and the
word "Pin" implies a reversible toggle that we never built. Any model we pick must answer:

- What visibly changes at the moment of the click?
- How does a user tell a preview panel from a permanent one at a glance, without hovering?
- Is the action reversible? If yes: unpinning a second panel while a preview already exists — what
  happens to the old preview? (Oleh's question in Slack. It has no good answer, which is itself an
  argument.)
- Is "Pin" even the right word? Candidates: Keep · Fix · Lock · Hold. Plus a per-panel marker icon.

Concepts are proposed separately (see §5). **Nothing is built until one is chosen.**

### 2.2 Overflow — hard cap vs "open as collapsed"

Dan: *"I would love it if it opened maybe in a closed state — you can only have N visible, but you could
add more, they just open as closed. Or maybe we have a slide bar."*

This flips `CAP` from *how many panels exist* to *how many are visible*. We already own the machinery
(strips, auto-accordion, shutter), so this is a rule change, not new plumbing. It deletes `evictLRU()`,
the Undo toast, and with them the count bug in §1.3.

Open: does a strip opened beyond the cap steal focus (expand + park the LRU), or wait silently?

### 2.3 The `＋` button's vertical position

Video 4:25: *"I don't know if it'll be like up at this level, might be better, but it's not the end of
the world."* Ambiguous. Best reading: raise `＋` to the tab-row level. Ask Dan rather than guess.

---

## 3. Confirmed bug, needs the engine

Hovering **View field in Airtable** shows `https://airtable.com/b-sales/b-companies/f-co-website` in the
status bar — our **backup ids**, not real `app*/tbl*/fld*`. Dan noticed ("that's kind of a bug"). This is
the existing `// TODO(engine)` in `renderBody`. The mirror cannot fix it; the engine must emit real ids.
**Flag to the Baseout engineer.** Until then the link is decorative.

Unconfirmed: at video 2:17 the first `＋` click appears not to open the picker (it opens on the second).
Could not reproduce from frames. Do not invent a cause; re-test after the redeploy.

---

## 4. Explicit non-tasks

- Video 0:55–1:20 is **praise**, not a request: clicking a table already shows the table on top, the
  field list below, and a field search. He likes it. Change nothing.
- Dan's original "per-Space Inbox below the switcher" was **overruled** by Oleh and Dan agreed. Do not
  move the Inbox.

---

## 5. Pin concepts

Written up separately once discussed. Requirements any concept must satisfy:

- **R1 — visible on click.** The transition preview → permanent is obvious without hovering.
- **R2 — glanceable at rest.** A user scanning four panels can tell which is transient.
- **R3 — no orphan states.** Either the action is one-way (no un-pin), or "unpin while a preview exists"
  has a rule a user can predict.
- **R4 — the word explains itself.** Dan is a power user and still could not guess. If the label needs a
  tooltip to be understood, the label is wrong.
- **R5 — costs nothing when ignored.** A user who never touches it still gets sane behaviour (today:
  one reusable preview panel).

---

## 6. Overflow — DECIDED and BUILT (2026-07-10)

Dan's model wins. `MAXPANELS = 10` bounds how many panels *exist*; the viewport bounds how many are
*expanded*. Opening past what fits parks the new panel to a strip instead of destroying an old one.

**The 10 is measured, not chosen.** Opening panels one at a time at 1440px:

| panels | expanded | strips | expanded width |
|---|---|---|---|
| 4 | 4 | 0 | 333px |
| 5 | 4 | 1 | 321px (the 320 floor) |
| 6 | 3 | 3 | 397px |
| 10 | 3 | 7 | 336px — table strip still 110px |
| 11 | — | — | evicts the least-recently-focused, with Undo |

Ten panels still show **three side by side** above the 320px floor. Twelve forces you down to two
(`274k ≤ 778 ⇒ k = 2`), which defeats the purpose of a side-by-side drawer. So: ten.

---

## 7. OPEN — panel lifetime across the app (Oleh, 2026-07-10)

Today the panels are a **Schema-Browse-local** thing. They die the moment you leave, and that is a real
loss of work:

- **Switch Schema tab** (Browse → Docs → Changelog): panels close. The user's assembled context is gone.
- **Switch section** (Schema → Backups): same.
- **Automations / Interfaces** don't even use this drawer — clicking one opens *its own* `ui/Drawer`
  in its own tab, so a user cannot hold an automation beside the field it references.

Questions to answer before building anything:

1. **Scope.** Are panels a property of the *Schema* surface, or of the *app*? If app-wide, a panel
   holding a field must survive navigating to Backups — and must then say what it is doing there.
2. **Do the app-layer entities join?** Should an automation / interface / page open *beside* a field in
   the same stack, replacing their bespoke drawers? That is the only way to compare "this automation"
   against "the field it writes to", which is the whole reason the drawer exists.
3. **What survives a reload?** Nothing today (no persistence at all). Panels are cheap to re-open, so
   maybe nothing should — but then losing them on tab switch is inconsistent, not principled.
4. **Undo for lost context** (Oleh's idea). Closing a panel is already undoable. Extend it: leaving a
   surface that would destroy N panels offers **one** Undo that restores the whole set, not N toasts.
   Cheap to build on `pattern-undo-toast`; needs a `lastClosedSet` rather than `lastClosed`.

My recommendation, to argue rather than assume: keep panels **Schema-scoped but tab-persistent** —
they survive moving between Schema's own tabs (Browse ⇄ Relationships ⇄ Docs …), because every one of
those tabs talks about the same entities. Leaving Schema entirely closes them, with a single grouped
Undo. App-layer entities (automations, interfaces) should join the stack; their separate drawers are a
historical accident and they already hold the same kind of content.
