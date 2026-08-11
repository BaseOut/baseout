# Do we need Pin at all? — use cases first, model second

Written 2026-07-10, after Dan could not tell what Pin did, and Oleh noticed that ⌘-clicking a row
creates a panel that is *already pinned* — so "pinned" cannot mean what the word implies.

## The observation that reframes everything

**"Pinned" is not a state.** A pinned panel is indistinguishable — visually and behaviourally — from a
panel created by ⧉, by ⌘-click, or by the ＋ picker. There are not two kinds of panel. There is **one
kind of panel**, plus **one exception**: the single panel that the next plain table click is allowed to
replace.

We named the exception "pin", which is why the model reads as incoherent: an explicit open-beside
"creates a pinned panel" while pinning nothing.

So the real question is not *"pin or auto-pin"*. It is:

1. Do we need the exception at all?
2. If yes — what marks it, and what promotes it?

---

## Every action a user can take

Grouped by how many panels are open, because that is where the rules interact.

### With zero panels
| # | Action | Expected |
|---|--------|----------|
| U1 | Click a table row | A panel opens showing that entity |
| U2 | ⌘/Ctrl/middle-click a row, or the row's ⧉ | A panel opens (same thing — there is nothing to sit beside) |
| U3 | Another tab hands off (`schema:openEntity` from Relationships / Docs / Health) | A panel opens |

### With one panel
| # | Action | Tension |
|---|--------|---------|
| U4 | Click a *different* row | Replace this panel, or add a second? **This is the whole problem.** |
| U5 | Click the row that is *already* open | Focus it. Never duplicate. |
| U6 | ⌘-click / ⧉ a row | Add a second panel — unambiguous, explicit |
| U7 | Drill a reference *inside* the panel | Navigate in place (Miller). Back pops the stack |
| U8 | ⌘-click a reference inside the panel | Open that entity beside |
| U9 | Close it | Zero panels |

### With two to four panels
| # | Action | Tension |
|---|--------|---------|
| U10 | Click a row in the table | **Which panel absorbs it?** The last one? The focused one? A dedicated one? A new one? |
| U11 | Drill inside panel #2 | Panel #2 navigates. Others untouched |
| U12 | Reorder (⠿) to pair two panels for comparison | Position must not carry meaning the user then destroys |
| U13 | Park one to a strip; expand it later | Parked ≠ closed |
| U14 | Shutter-drag the stack | All resize; strips park/unpark one at a time |
| U15 | Close one | The others must not move semantically (no cascade) |
| U16 | Open one beyond the visible cap | Dan: it should arrive collapsed, not evict anything |
| U17 | Come back after a distraction | Which panel is safe to lose? Must be answerable *at a glance* |

### Failure modes we are trying to prevent
- **F1 — Silent loss.** A panel the user cared about is replaced by a plain click.
- **F2 — Pile-up.** Scanning ten fields leaves ten panels.
- **F3 — Duplicates.** The same entity open twice.
- **F4 — Unpredictable target.** The user cannot tell *which* panel a click will affect.

Note that F1 and F2 pull in opposite directions. Every model below is a different trade between them.

---

## The models

### M1 — Preview + explicit Keep *(prototype `#A`)*
One transient panel; plain click reuses it; **Keep** makes it ordinary; explicit gestures make ordinary
panels directly.

- F1 ✅ (Keep protects) · F2 ✅ · F3 ✅ · F4 ⚠️ the transient panel is marked, but by a chip
- Cost: a status to teach, and the incoherence Oleh spotted (⧉ "creates a pinned panel").

### M2 — Preview + auto-Keep on intent *(prototype `#B`, the VS Code pattern)*
As M1, plus the panel keeps itself when you drill in or open one beside it.

- Same scores; less clicking; **more** hidden state, because promotion can happen without the user
  asking for it. The user must still learn that a rule exists.

### M3 — No exception: every open is a panel
Plain click always opens a new panel. Overflow arrives collapsed (Dan's ask). Nothing is ever replaced.

- F1 ✅ perfect · F2 ❌ scanning ten fields → ten panels/strips · F3 ✅ (focus instead of duplicate)
- Zero vocabulary. Zero teaching. The drawer becomes browser tabs.
- Verdict: only viable if scanning is rare. It isn't — Browse *is* a scan surface.

### M4 — Plain click retargets the **focused** panel
No transient state. Click navigates whichever panel you last touched.

- F4 ❌ badly. The user focuses panel #3 to read it, clicks a row in the table, and panel #3 — the one
  they were reading — is gone. Focus is an accident of the last click; it should not decide what gets
  destroyed.
- Rejected.

### M5 — The **anchor slot**: transience encoded by *position*, not by a badge
The panel nearest the table (the leftmost) is the **anchor**: it is permanently bound to the table
selection, and a plain row click always retargets *it*. Every other panel was created by an explicit
gesture and is never touched by the table.

"Keeping" the anchor is not a status change — it is a **spatial** act: ⧉ opens its entity as its own
panel beside, and the anchor is free again. There is no pin, no chip, no promotion, no italic.

- F1 ✅ (nothing else can be replaced) · F2 ✅ · F3 ✅ · F4 ✅ — the answer to "what will this click
  replace?" is *always* "the panel next to the table", visible at all times.
- One rule to teach, and the layout teaches it: **the slot next to the table mirrors the table.**
- **Conflict:** reorder (⠿, U12) lets the user drag a panel into the anchor slot. Either the anchor is
  pinned to its position (excluded from reorder), or the anchor is a *role* that travels with its panel
  and then position no longer encodes it — which collapses M5 back into M1.

---

## Where this leaves us

The choice is between **marking the exception** (M1/M2 — a chip, a word, a promotion rule) and
**placing the exception** (M5 — a slot whose location says what it is). M3 removes the exception and
pays for it in clutter; M4 removes it and pays in unpredictability.

M5 is the only model where a user never has to be told anything — but it costs the freedom to reorder
the leftmost panel, and it needs one honest answer: *is the anchor allowed to be parked or closed?*
(If it can be closed, the next plain table click must recreate it.)

Open question for Dan and Oleh, in this order:
1. Is Browse primarily a **scanning** surface (favours an exception) or a **collecting** one (favours M3)?
2. If an exception exists — mark it (M1/M2) or place it (M5)?
3. If M5 — is the anchor excluded from reorder, and what happens when it is closed?
