# Schema Export — competitor evidence (2026-07-10)

Web research across Airtable, Metabase, Notion, Figma/FigJam, Miro, Whimsical, Grafana, Retool and
ProBackup. Every claim carries a source. Where nothing was found, it says so rather than guessing.

## 1. Where Export lives

It is **almost never a prominent primary button**. Three conventions:

- **Overflow menu** — Airtable (view caret → "Download CSV"), Notion (••• → Export), Miro (… → Board →
  Export), Grafana (panel … → Inspect → Data → Download CSV).
- **Docked corner affordance** — Metabase (Download, lower-right of the question), Figma (an Export
  section at the bottom of the right sidebar), Whimsical (paper-plane, top-right).
- **Component toolbar toggle** — Retool ("Download CSV" in the Table toolbar, behind an "Allow export"
  setting).

Clicking it opens a small popover or modal for options. **Our three existing `btn-neutral` triggers are
the loudest button in a toolbar full of quiet facet filters — that is backwards.**

## 2. One format ⇒ name the format

Every product surveyed names it when there is one: "Download CSV" (Airtable, Retool, Grafana),
"Save as PDF" / "Save as image" (Miro), "Export PDF/HTML/Markdown" (Notion).

Metabase is the only one that says a bare "Download" — precisely because it genuinely offers four
formats. ([Metabase](https://www.metabase.com/docs/latest/questions/exporting-results))

**Directly supports the client's fixed-format-per-tab decision.** "Export CSV" · "Export image" ·
"Export PDF report" — never a bare "Export".

## 3. Scope — the field's weakest spot, and our opening

- **Airtable**: export is silently scoped to the active view's filters. No scope control, no count.
  Third-party guides literally have to warn users to "ensure the view does not contain any filters" if
  they want everything.
  ([guide](https://www.switchlabs.dev/resources/exporting-your-data-from-airtable-a-step-by-step-guide-to-downloading-as-csv))
- **Metabase**: the on-screen table caps at 2,000 rows as a *preview*; Download returns the **full**
  result set (cap 1,048,575). There is **no displayed-vs-full toggle**; the one binary in the popover is
  **Formatted vs Unformatted**.
  ([docs](https://www.metabase.com/docs/latest/questions/exporting-results))
- **Notion**: explicit scope binaries — "Include subpages", "Create folders for subpages", "Include
  content". ([docs](https://www.notion.com/help/export-your-content))
- **Figma / Miro**: "Selection only" vs the whole page/board.
- **Retool / Grafana**: scope is "whatever the component shows", with acknowledged fidelity bugs
  (Retool exports only the current paginated page).

> **No surveyed product surfaces a row count in the export control.**

Mobbin says otherwise for adjacent categories (Wix, Shopify, Typeform, Mixpanel all show counts — see
`mobbin-findings.md`). So counts are a proven pattern, just not in *our* competitors. Doing it puts us
ahead of every schema/data tool surveyed.

## 4. Image export — the three non-negotiables

- **Scale / DPI** — Figma 1x/2x/3x + custom (SVG and PDF are 1x only); Miro Small/Medium/Large/Vector;
  Grafana PDF has a Zoom control.
  ([Figma](https://help.figma.com/hc/en-us/articles/13402894554519-Export-formats-and-settings))
- **Background** — the differentiator. FigJam and Whimsical offer an explicit Transparent / Solid / Grid
  chooser. Miro *lacks* clean transparency and users complain of a grey rectangle on SVG export.
  ([FigJam](https://help.figma.com/hc/en-us/articles/4407699832855-Export-your-FigJam-board) ·
  [Miro complaint](https://community.miro.com/ask-the-community-45/grey-rectangle-in-background-when-exporting-as-svg-27811))
- **Viewport vs whole canvas** — Miro "select the area" vs whole board; Figma selection vs page.

## 5. PDF reports: sync for one artifact, async for everything else

- **Single artifact** (one page, one dashboard) → synchronous browser download. Notion single page,
  Metabase "Export as PDF".
- **Large scope** → async job + emailed link. Notion's workspace export states the wait up front:
  *"Exports can take up to 30 hours to process…"*, *"You'll receive an email from Notion with a link…
  This link will expire after 7 days"*, falling back to the in-app inbox if email is off.
  ([Notion](https://www.notion.com/help/export-your-content))
- Grafana renders PDFs server-side via its Image Renderer; scheduled reports are emailed.
  ([Grafana](https://grafana.com/docs/grafana/latest/dashboards/create-reports/))

## 6. Warning about a slow export

Mostly **absent**. Two real patterns:

- **ProBackup — the button swaps.** When a table is too big to load in-browser, the instant "Download"
  is **replaced by "Request Full Export"**, which runs async and emails a link. The label change *is*
  the warning and the wait-communication, in one control.
  ([ProBackup](https://support.probackup.io/en/articles/9286842-how-to-download-your-backups))
- **Notion** states an inline time estimate.

Miro, Retool and Grafana give no in-UI warning at all.

## 7. Filenames

**Largely undocumented — do not assume a convention exists.** Nothing authoritative found for Airtable,
ProBackup, Metabase, Retool, Grafana or Miro. The two documented ones:

- **Figma**: a slash in the layer name becomes folder nesting (`button/pill/default`), plus a Suffix
  field appended to the filename.
- **Notion**: files named after page/database titles; Markdown export = one `.md` per page and one
  `.csv` per database.

We are free to pick our own.

## Flags against the client's decision

1. **Fixed format per tab is well-supported and arguably the stronger pattern** — it is what lets the
   label name the format. No contradiction.
2. **CSV-only may frustrate the power user.** Metabase, Retool and Grafana all offer XLSX/JSON beside
   CSV for data grids; ProBackup defaults to **Excel**. Our persona (technical ops) is exactly the
   audience that asks. Worth confirming before we delete the JSON item that already exists in the
   Changelog menu.
3. **"Image" needs a definition.** Figma and Miro both also offer **SVG/PDF** for diagrams, because
   raster goes blurry when scaled. Does "image" include SVG?
4. **PDF-for-Chat has no precedent.** No competitor exports a conversation as a report. Fine as a
   decision — just note there is no wording to borrow.
5. **Scope is our edge.** Airtable's silent filter-scoping actively confuses its users. Explicit scope
   with row counts is differentiated.

## The single strongest pattern to steal

**ProBackup's degrade-on-size.** Instant download when small; the control *itself changes* to "Request
Full Export" when large, going async with a link. It answers scope, async and the large-export warning
in one affordance.
