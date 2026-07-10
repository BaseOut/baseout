# Schema Export — pitfalls that would actually bite us (2026-07-10)

Ranked by real risk for *this* feature, whose data contains **Airtable formula text**.

## 1. CSV formula injection — CRITICAL, and it is a security bug, not a nit

Airtable formula fields **begin with `=`** by nature. Export them raw and every spreadsheet program
executes them.

- OWASP: *"CSV Injection, also known as Formula Injection, occurs when websites embed untrusted input
  inside CSV files."* Trigger characters: `=` `+` `-` `@`, plus **Tab (0x09)**, **CR (0x0D)**,
  **LF (0x0A)**, and full-width variants `＝ ＋ － ＠`.
  ([OWASP](https://owasp.org/www-community/attacks/CSV_Injection) ·
  [WSTG](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection))
- Remediation: quote every field, double embedded quotes, and **prefix any cell starting with a trigger
  character with a single quote `'`**.
- OWASP's own caveat, which we must not hide: *"There is no universal CSV sanitization strategy that is
  safe for all spreadsheet applications and all downstream consumers."*

**Two distinct harms, and the second is the one people miss:**
1. *Security* — a formula authored in someone's base becomes executable in whoever opens the backup CSV.
2. *Correctness* — even a benign formula gets **interpreted rather than shown**, so the exported
   "documentation" of the schema is simply wrong.

Real libraries treat escaping as default behaviour:
[League CSV](https://csv.thephpleague.com/9.0/interoperability/escape-formula-injection/) ·
[KendoReact](https://www.telerik.com/kendo-react-ui/components/grid/export/csv-export/formula-injection) ·
[DataTables fix](https://datatables.net/forums/discussion/80069/csv-formula-injection-vulnerability-in-buttons-extension)

> For a tool whose entire job is to back up and document Airtable, shipping an export that mangles
> formula definitions would undermine the product's core claim.

## 2. "What did I actually export?" — the trust problem, and it was fixed by someone already

Metabase issue #5657, *"We should clarify how many rows a user is downloading"*, documents users
conflating the visible/paginated count with what downloads. The fix that shipped: a tooltip on the
download button and a menu that **states how many rows will be downloaded**.
([#5657](https://github.com/metabase/metabase/issues/5657))

Related confusion, still live: a filtered dashboard exporting all rows
([forum](https://discourse.metabase.com/t/unable-to-export-filtered-results/14912)).

Metabase's live docs also carry a distinction we should copy the *thinking* of, not the wording:
**Formatted vs Unformatted** — *"Formatted: With any formatting changes you've applied in Metabase"* /
*"Unformatted: … the raw results … without applying any of the formatting."*
([docs](https://www.metabase.com/docs/latest/questions/exporting-results))

Our analogue: a formula field's *displayed* value versus its *definition*. Decide, and label it.

⚠️ The agent could **not verify** the exact paired labels "download full results" / "download results
shown" in current Metabase docs. The *concept* is well-evidenced (#5657); the exact strings are not.

## 3. Zero rows — no authoritative standard exists

**No evidence found** for a single recommended pattern. What is evidenced is that empty output causes
downstream damage: Airtable **rejects** files containing blank rows rather than partially importing
([source](https://splitforge.app/blog/csv-empty-rows-breaking-import)); tools emitting empty export
files is a known failure mode ([DBeaver #20998](https://github.com/dbeaver/dbeaver/issues/20998)).

**Derived recommendation, flagged as judgement not evidence:** when the filter matches nothing, disable
the control with the reason ("No fields match the current filter") rather than hand back a header-only
file that looks like a bug.

## 4. Image export bakes the dark theme into the PNG — our sharpest trap

We are a **dark-first** product. The PNG lands in a white Notion doc.

- Excalidraw bakes the on-screen theme and cannot export the other variant
  ([#8944](https://github.com/excalidraw/excalidraw/issues/8944) ·
  [#8542](https://github.com/excalidraw/excalidraw/issues/8542) ·
  [#2026](https://github.com/excalidraw/excalidraw/issues/2026))
- **No padding → edge clipping.** Excalidraw has no export margin; Mermaid clips edge content; Figma
  exports only what is inside the frame, and viewport-only export misses off-screen nodes
  ([Figma forum](https://forum.figma.com/ask-the-community-7/need-to-export-all-of-a-frames-contents-to-png-not-just-the-contents-in-it-s-viewport-27030))
- **Missing fonts / clipped text on SVG→PNG.** Mermaid's `foreignObject` labels fail when rasterizing an
  SVG data-URL; fonts must be loaded first
  ([#790](https://github.com/mermaid-js/mermaid/issues/790) ·
  [#2102](https://github.com/mermaid-js/mermaid/issues/2102))
- **Transparency is not a free win**: transparent + dark glyphs = invisible on a dark paste target. A
  neutral baked background is often safer than transparency.
- **Resolution**: rasterize at ≥2x or it is blurry.

Direct collision with our own codebase rule: scoped Astro `<style>` never reaches innerHTML-injected
DOM (see CLAUDE.md). **The exporter must inline computed styles and embed fonts**, not rely on page CSS.

## 5. PDF pagination

Print-CSS rules that prevent the classic bugs:

- `thead { display: table-header-group }` — repeats the column header on every page.
- `break-inside: avoid` — stops rows/cards splitting mid-cell. `page-break-after: avoid` keeps a heading
  with its content.
- `@page` for margins and running headers/footers.
  ([cheatsheet](https://www.customjs.space/blog/print-css-cheatsheet/) ·
  [pdfbolt](https://pdfbolt.com/blog/optimizing-html-for-pdf))

**Client canvas libraries (html2pdf / jsPDF / html2canvas) mangle Flexbox/Grid, fonts and page breaks**
([evidence](https://joyfill.io/blog/creating-pdfs-from-html-css-in-javascript-what-actually-works)).
A schema report is exactly a long table. Use a real engine: browser print for on-demand, Puppeteer
server-side for the branded/async report.

## 6. Async: our trigger is RENDER cost, not row count

Practitioner consensus (blogs, not a standard): under ~10k rows sync is fine; over ~100k go async
([source](https://dev.to/young_gao/background-job-processing-in-nodejs-bullmq-queues-and-worker-patterns-31d4)).

**Schema metadata is small.** We will essentially never hit a row threshold. The realistic async trigger
is rendering a large diagram or a long PDF. Notify with a toast when fast; use the **Inbox we already
built** when slow. Email is overkill at metadata size.

Progress copy should carry counts ("124 of 500 rows processed") and must not steal focus
([LogRocket](https://blog.logrocket.com/ux-design/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/)).

## 7. Encoding — UTF-8 BOM

Excel on Windows needs the 3-byte BOM (`EF BB BF`) to read UTF-8 CSV without mojibake; but the BOM
corrupts the first header for many importers (Shopify turns `Handle` into `ï»¿Handle`).

Consensus: **UTF-8 without BOM by default; offer an "Excel-compatible" variant.**
([guide](https://leaprows.com/en/blog/csv-utf8-bom-encoding-guide) ·
[OpenMetadata added exactly this option](https://github.com/open-metadata/OpenMetadata/issues/28134))

Airtable field names contain emoji and accents, so this is not hypothetical.

## 8. Accessibility

- Announce completion in a **polite** `aria-live` region; `assertive` only for urgent
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) ·
  [Soueidan](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/))
- **Return focus to the trigger** when the menu closes. Never yank focus to an async toast the user did
  not summon ([part 2](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-2/))
- The control must be a real `<button>` with an accessible name that includes scope: "Export current
  view as CSV".

## 9. Filenames

ISO date first (`YYYY-MM-DD`) so files sort cross-OS; hyphens, no spaces
([Harvard RDM](https://datamanagement.hms.harvard.edu/plan-design/file-naming-conventions)).

**Encode the scope in the name** — `..._filtered.csv` vs `..._all.csv` — so the answer to "what did I
export?" survives until the day the user opens the file. This closes the loop with §2.
