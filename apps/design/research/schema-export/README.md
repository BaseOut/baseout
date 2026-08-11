# Schema Export — research synthesis and proposed draft

2026-07-10. Sources: `current-state.md` (code audit) · `mobbin-findings.md` (pattern evidence) ·
`competitors.md` (Airtable, Metabase, Notion, Figma, Miro, Grafana, Retool, ProBackup) ·
`pitfalls.md` (OWASP, Metabase issues, Excalidraw/Mermaid/Figma bug reports).

Client's answer (Dan, Slack): **format is fixed per tab** — Browse / Relationships / Automations /
Interfaces / Changelog → CSV; Visualize → image; Health / Docs / Chat → PDF. **Scope: keep filters,
with an option to export all.**

---

## The five findings that decide the design

**1. The work is a consolidation, not an addition.** Three Export controls already exist (Changelog,
Health, Visualize). All three are *format pickers* — the exact decision the client just removed — and
all three offer formats he did not ask for (JSON in Changelog, CSV in Health, PDF+JSON+CSV in
Visualize). Six of nine surfaces have nothing. Every one is a dead `<a>`.

**2. One format ⇒ name it.** Every product surveyed does: "Download CSV", "Save as PDF". Metabase is the
only one saying a bare "Download", and only because it truly offers four formats. So: **"Export CSV"**,
not "Export".

**3. Show the counts, and show both.** No *competitor* surfaces a row count — but Wix, Shopify, Typeform
and Mixpanel all do, and Airtable's silent filter-scoping is a documented source of user confusion. The
scope control must let the user compare before committing:

> ◉ Current view · 24 fields  ○ Everything · 108 fields

Mixpanel additionally puts the number in the confirm button (`Export 100 events`). Cheap, and the last
thing read before the click.

**4. Formula fields make CSV escaping a security requirement.** Airtable formulas start with `=`. Raw
export is an OWASP CSV-injection vector *and* silently corrupts the very documentation we are exporting.
This is not a nicety: it is the one thing that would make a backup tool's export untrustworthy.

**5. "Image" is underspecified, and dark-first makes it worse.** We bake a dark canvas into a PNG that
lands in a white doc — the single most-reported complaint against Excalidraw. Plus clipping without
padding, missing fonts when rasterizing SVG, blur below 2x. "Image is sufficient" does not answer:
*which background, whole graph or viewport, what scale.*

---

## Proposed draft

### One control, three shapes

A single `ExportButton` on every tab, built from the catalog's faceted-filter construction
(`ff-trigger` / `ff-panel` / `ff-opt` — already shared via `styles/components/facet-filter.css`), **not**
another hand-rolled `btn-neutral` + `menu`. A new storybook entry `pattern-export-control` goes in
FIRST, per THE SEQUENCE.

| Tab | Trigger label | Panel |
|---|---|---|
| Browse · Relationships · Automations · Interfaces · Changelog | **Export CSV** | scope radios + counts |
| Visualize | **Export image** | scope (whole graph / viewport) · background (light / dark / transparent) · scale (1x / 2x / 3x) · live preview |
| Health · Docs · Chat | **Export PDF** | scope radios; async, states the wait |

### The scope control (all tabs)

```
SCOPE
◉  Current view          24 fields
○  Everything           108 fields
                                   [ Export 24 fields ]
```

- Both counts always visible, so "keep filters" is verifiable, not promised.
- Zero matches ⇒ the control is **disabled with the reason** ("No fields match the current filter"),
  never a header-only file that reads as a bug.
- The **filename carries the scope**: `baseout_core-crm_browse_2026-07-10_filtered.csv` vs `..._all.csv`.
  The answer to "what did I export?" survives until the file is opened next week.

### CSV rules (non-negotiable)

- Quote every field; double embedded quotes.
- **Prefix any cell beginning with `= + - @`, tab, CR or LF with `'`.** Formula definitions export as
  text, which is what a documentation tool must do.
- UTF-8 **without** BOM by default; an "Excel-compatible" variant adds it. Airtable field names carry
  emoji and accents, so this bites in practice.
- Say it in the panel, quietly: *"Formula definitions are exported as text."*

### Image rules

- Export the **whole graph, fitted, with padding** — not the viewport. Off-screen nodes are the point.
- **Background is an explicit choice**, defaulting to the theme in use, with light and transparent
  offered. We are dark-first; the file usually is not.
- Rasterize at **2x** by default.
- Inline computed styles and embed fonts. Our own rule (CLAUDE.md) says scoped Astro `<style>` never
  reaches injected DOM — an exporter that trusts page CSS will ship a fontless diagram.

### PDF rules

- Real print CSS, real engine. `thead { display: table-header-group }` so the column header repeats on
  every page; `break-inside: avoid` so a field row never splits mid-cell.
- Client-side canvas libraries (html2pdf / jsPDF) mangle Flexbox and page breaks. A schema report is one
  long table — exactly their failure case.

### Async — steal ProBackup's degrade-on-size

The best pattern found anywhere: when the job is small the button downloads instantly; when it is large
the **button itself changes** to "Request full export", which goes async. The label change *is* the
warning and the wait-communication, in one affordance.

Our async trigger is **render cost, not row count** — schema metadata is tiny; a large diagram or a long
PDF is not. When it goes async, the result lands in the **Inbox we already built** (Activity lane), with
a polite `aria-live` announcement. No spinner trapped in a modal. Email is overkill at this data size.

---

## Three questions for Dan (do not guess)

1. **Visualize → "image"**: whole graph or current viewport? Background — theme, light, or transparent?
   Does "image" include **SVG**? (Figma and Miro both offer vector for diagrams, because raster blurs
   when scaled, and a schema diagram is exactly what someone zooms into.)
2. **Chat → PDF**: the open thread, or the whole history? Archived threads too?
3. **Docs → PDF**: the open document, or every document in the Space?

And one to confirm, because the evidence pushes back on his answer:

4. **CSV-only for the tabular tabs.** Metabase, Retool and Grafana all offer XLSX/JSON beside CSV;
   ProBackup defaults to Excel. Our persona is technical ops — the exact audience that asks. He said
   "CSV is sufficient". Do we *delete* the JSON option that already exists in the Changelog menu, or keep
   it? Deleting is the honest reading of his answer.

## Defaults if he does not answer

Stated in code as assumptions, not silently: Visualize = whole graph, theme background, 2x PNG;
Chat = the open thread; Docs = the open document; Changelog date range counts as a filter; Browse CSV is
always flat regardless of the Tree/Flat toggle.
