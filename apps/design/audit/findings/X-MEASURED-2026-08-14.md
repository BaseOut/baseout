# X-MEASURED — the measurement debt, taken

**2026-08-14.** `audit/SHIP-ORDER.md` closes with nine `NEEDS-MEASUREMENT` claims and the
instruction *"take 1, 2 and 3 before writing the PRs they belong to."* This file takes those three.

**Instrument.** Chrome DevTools MCP against `pnpm design` on `http://localhost:4332`, viewport set
with `emulate` (`Emulation.setDeviceMetricsOverride`), **not** `resize_page`. `resize_page` resizes
the *window*, and Chrome on macOS floors a window at ~500px — which is why every earlier "390"
number in this audit is a 500-wide layout. `window.innerWidth` is returned alongside every reading
below; a narrow number without it is not evidence.

---

## 1 · X08-F7 — the neutral KPI dot does not paint. **CONFIRMED.**

Measured on `/reports/run/r-2026-07-13`, viewport 1440, `data-theme="baseout"`. Probes injected
into the live `.hm-kpi-v` host so they inherit the same cascade:

| class | computed `background-color` |
|---|---|
| `bg-base-content/40` — the `neutral` branch | **`rgba(0, 0, 0, 0)`** |
| `bg-warning` — control | `rgb(196, 144, 48)` |
| `bg-success` — control | `rgb(61, 184, 120)` |

The utility does not exist. `ReportBodyKpi.astro:164` builds the class by interpolation —
``bg-${s.tone === 'neutral' ? 'base-content/40' : s.tone}`` — so Tailwind never sees the string and
never emits the rule. Every other tone paints; `neutral` renders an 8px hole.

**Not previously stated: no fixture in the tree sets `tone: 'neutral'` on a `strip` entry**
(`apps/design/src/fixtures/reports.ts` — the two strips use `warning`, `success` and no tone). The
state is unreachable in the harness, so this defect could not have been found by looking. It was
only ever findable by reading a computed value.

**Ship-order item 8 stands. Do not strike it.**

## 2 · X09-F3 — Restore's muting has no effect. **CONFIRMED WHOLE**, not half.

Measured on `/restore`, viewport 1440. The finding's own note said *"if they are already muted, half
of X09-F3 is wrong."* They are not muted.

| probe | computed `color` |
|---|---|
| `iconify lucide--table-2 text-base-content/45` — what `RestoreView.astro:345,643` writes | `oklch(0.764982 0.112262 156.423)` |
| `iconify lucide--table-2` — the bare global rule | `oklch(0.764982 0.112262 156.423)` — **identical** |
| `iconify lucide--database text-base-content/45` — control, different glyph | `oklab(… / 0.45)` — muted correctly |

The live rule reads
`.iconify.lucide--table-2, .concept-ic-table .iconify, … { color: var(--color-success) }`.
Restore asks for muted and gets concept-green. This is **§10 mechanism 2 (specificity)**, not source
order: the global selector is `0,2,0` and the Tailwind utility is `0,1,0`, so no utility a view can
write will ever reach it. That is precisely the argument for the ADOPT already recorded — move the
colour onto `.concept-ic-table`.

## 3 · D41 — the conclusion survives, the measurement under it does not.

Measured on `/backups` (`.bl-toolbar`), `/reports` (`.rpl-toolbar`) and `/schema` (`.sch-tb`).

| surface · family | viewport | `#layout-content` | `data-narrow` | toolbar height | search |
|---|---|---|---|---|---|
| `/schema` · `.sch-tb` | 1440 | **1184** | **ON** | 32px, one row | collapsed to **32px** |
| `/backups` · `.bl-toolbar` | 1440 | 1184 | **absent tree-wide** | 32px, one row | — |
| `/backups` · `.bl-toolbar` | 1100 | 1100 | absent | 28px, one row | field **986px** |
| `/reports` · `.rpl-toolbar` | 1100 | 1100 | absent | 28px, one row | 3 children totalling **427.5px** in 1100 |

**D41 says the three copies' *"only answer to running out of room is to become two rows."* Neither
copy was reproduced wrapping.** They carry two and three controls, summing ~430px in an 1100px
column — they never run out of room at any width the app is used at. The wrap problem belongs to the
*dense* toolbars, and those are already `.sch-tb`. So converging the three copies is still right —
on **variance** grounds, three byte-identical private rules for one job — but the wrap measurement
should not be cited as the reason, because it does not hold on the surfaces named.

**The sharper finding, which no pass has stated.** `toolbarFit.ts` compares `#layout-content`'s
`clientWidth` against **1440**, and that column is **1184 at a full-screen 1440 laptop with no split
view**. The threshold can therefore never evaluate false on the hardware this product is used on:
`data-narrow` is not a narrow adaptation, it is **the permanent state**. Six `global.css` rules that
read as "below 1440 we drop button words and collapse the search to a magnifier" are in fact the
only rendering `.sch-tb` has. Either the threshold is wrong or the rules it gates are simply the
default and should say so. This reframes D41's change 2 and supersedes the framing in
`task-responsive-1440-toolbar`.

> **Probe caveat, recorded because it produced a wrong reading first.** Counting distinct child
> `top` offsets reports a false second row: a baseline-offset count label sits 5px below its
> siblings inside a 28px one-row toolbar. **Toolbar height is the wrap signal; child offsets are
> not.** The `rows: 2` in an intermediate reading on `/reports` was this artifact.

---

## Still unmeasured — six of the nine

Items 4, 6, 7, 8, 9 of `SHIP-ORDER.md`'s list, plus item 5 (drawer `clientWidth` at 390/425), which
the file marked as needing *"a different instrument, not a retry"* — that instrument now exists and
is documented at the top of this file, so item 5 is unblocked and simply not yet taken.
