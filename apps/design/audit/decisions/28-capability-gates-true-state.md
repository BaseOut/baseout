# D28 — Capability gates render the true state

**Rule in one sentence:** A capability gate has exactly one implementation with three branches —
`locked` (below plan), `no-credits` (plan held, credits exhausted — the surface stays visible,
disabled), `policy-off` (an admin turned it off: level, scope, settings link) — and it never
renders a branch that is untrue of the reader's account; a tab with no AI in it never reads the
AI prop at all.

## Why this option, not the alternative

The rejected alternative is patching each consumer's `=== 'ready'` ternary in place — five edits
that leave five writers, and the collapse returns with the sixth consumer. The
`openspec/changes/ai-settings` proposal already names the shared component
(`AiPolicyDisabledState`) and already modifies `chat-tab` to honour it; this decision executes
that shape for all three branches, not just the policy one. Also rejected: deleting `no-credits`
from the union — the harness (`?ai=no-credits`), the smoke variant table (`smoke.mjs:186`), the
Canvas doc comment (`SchemaCanvas.tsx:166`) and the composer's own `~2 credits / message` all
treat it as a real, distinct state; the union is right and the renderers are wrong.

The severity anchor is S16-F1: `?ai=no-credits` shows a paying Pro customer **"Upgrade to Pro"**
— the screen states something untrue about the reader's own account, served on every smoke run,
green.

## Surfaces changed

- `SchemaChat.astro:52,58,180-186` — three branches; `no-credits` keeps the threads readable and
  the composer visible-disabled (the reader has history to re-read).
- `QuickAskDock.astro` — the panel renders the same three branches through the shared partial
  (lands with D31's consolidation).
- `SchemaHealth.astro:116` + its two prompt-editor upgrade blocks (`:501-505`, `:578-582`).
- `SchemaCanvas.tsx:2244-2248` (`genState`) — the app-layer gate.
- `SchemaAutomations.astro:68-72,157-163` and `SchemaInterfaces.astro:57-60,148-154` — these two
  are **not AI features**: they get their own `tier` capability prop and a `?tier=` harness query
  (`pages/schema.astro` gains the variant; declare it in `smoke.mjs`). Interim honest minimum
  until the prop split: `canUse = aiState !== 'locked'`. The below-Growth gate itself is
  spec-required (`specs/automations-interfaces-tabs/spec.md:10-12`) and stays.

## storybook.ts

New entry `pattern-capability-gate`: the three branches, the wording rule per branch
(`no-credits` names what refills credits and when; `policy-off` names the level and the scope
that imposed it, link shown only to those who can change it), and the D14 cross-reference for
recipe/position/CTA target. D14 keeps authority over what the `locked` CTA looks like and where
it lands (J08-F2's census); D28 owns *which branch renders*.

## Explicitly not changing

- The existence of the Growth gate on Automations/Interfaces (spec-required — S17 scope note 2).
- The `ds-ok`'d Ask launcher and the gate's placement.
- Whether a plan-holding Space with zero AI credits exists in production — **NOT-OURS**, asked of
  the client's engineer; if it cannot exist, the `no-credits` branch is still built (the union
  declares it) but the question decides its copy.

## Members

S16-F1 (S1) · S17-F6 + S18-F7 (S2, merged — twins, one defect).

## How to verify done

`?ai=no-credits` on `?tab=chat|automations|interfaces` shows no plan upsell and no
"Available on Growth" sentence; `?ai=locked` unchanged; `?tier=free` reaches the Growth gate on
the two register tabs; `grep -rn "aiState === 'ready'" apps/web/src` returns only the shared
component; `pnpm smoke` green with the new variants declared.


---

## AMENDMENT 2026-08-14 — the gate's *shape* is governed by nobody (X04-F5)

D28 governs whether a capability gate tells the **truth**. The X04 census found that nothing governs
what one **looks like**, and there are five vessels: `.au-gate` (`SchemaAutomations.astro:379`, a
**999px circle** tile where every sibling empty state draws a rounded square), `.if-gate`
(`SchemaInterfaces.astro:395`), `.chat-gate` (`SchemaChat.astro:453-456`, a `3.2rem` tile and a 52ch
cap where the bound value is 46ch), `.sec-gate`, and `LockedTab.astro`.

`pattern-empty-state` documents three conditions — section degrade, tab card, unresolved id — and
**none of them is "you do not have this"**. So five authors invented five answers to a question the
catalog never asked.

**Ruling: the capability gate is empty-state condition 4**, added to `pattern-empty-state`, and the
five vessels are absorbed into `EmptyState.astro` (D17). **D28 keeps the truth clause; D17 takes the
shape clause.** Neither decision is widened: they meet at the component, which takes a `condition`
prop and renders a gate as one of its four cases.
