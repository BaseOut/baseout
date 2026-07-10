# Schema Export — what we shipped, and the assumptions inside it

Hi Dan — your answers (CSV for the tabular tabs, image for Visualize, PDF for Health/Docs/Chat; keep
filters with an option to export all) left a handful of questions we had to answer to build anything.
We built the baseline rather than block on you, and marked every guess in the code. Each item below is
a yes/no question. A "no" is cheap to change.

## What you'll see

One export control on every Schema tab, in the toolbar. The label names the format — **Export CSV**,
**Export image**, **Export PDF** — because each tab only has one. The panel shows **both counts at once**:

> Current view · 24 fields   ·   Everything · 108 fields

…and the number is repeated in the button (*Export 24 fields*), so the last thing you read before
clicking is what you get. The filename says which one you took —
`baseout_core-crm_browse_2026-07-10_filtered.csv` vs `…_all.csv`.

We also removed the format pickers that were already there (Changelog offered CSV + JSON, Health CSV +
PDF, Visualize PNG + PDF + JSON + CSV). None were wired to anything, and all of them contradicted your
answer.

## The assumptions — please confirm or correct

1. **Visualize exports the WHOLE graph, fitted with padding — not what's on screen.** Exporting the
   viewport silently drops the off-screen nodes, which are usually the point. *Correct?*

2. **The image background defaults to your current theme, with Light and Transparent offered.** We're a
   dark product; a dark PNG pasted into a white doc is the most common complaint against tools like
   Excalidraw. *Should the default be Light instead?*

3. **Images rasterise at 2× by default.** A schema diagram is exactly what someone zooms into, and 1×
   goes blurry. *Correct?*

4. **"Image" means PNG only — no SVG.** Figma and Miro both offer vector for diagrams precisely because
   raster blurs. We did not add it, because you said "image". *Do you want SVG?*

5. **Chat exports the OPEN THREAD, not the whole history, and excludes archived threads.** No competitor
   exports a conversation as a report, so there was no precedent to copy. *Correct?*

6. **Docs exports the OPEN DOCUMENT, not every document in the Space.** *Correct?*

7. **Changelog's date range counts as one of the "current filters".** So "Current view" respects it.
   *Correct?*

8. **Browse's CSV is always flat**, regardless of whether you're looking at the Tree or Flat view. A
   tree is a display choice, not a data shape. *Correct?*

9. **We deleted the JSON option from Changelog.** You said CSV is sufficient. Note that Metabase, Retool
   and Grafana all offer JSON/XLSX beside CSV for data grids, and ProBackup defaults to Excel — your
   users are technical ops, the exact audience that asks. *Keep it deleted?*

10. **When an export is large, the button becomes "Request full export"** and the file will arrive in the
    Inbox rather than downloading. (ProBackup does this; the label change is the warning.) *Correct?*

## Two things we did that you didn't ask for, and why

**CSV cells that begin with `=`, `+`, `-`, `@` are prefixed with an apostrophe.** Airtable formula
fields start with `=`. Exported raw, a spreadsheet *executes* them: that's an OWASP formula-injection
vector, and it also means the formula definitions we claim to be documenting get evaluated instead of
shown. The panel says so, quietly: *"Formula definitions are exported as text."* If you'd rather export
raw, that's a decision we should make deliberately.

**Both row counts are always visible.** Airtable scopes its exports to the active view's filters
silently, which is a documented source of user confusion. "Keeps your filters" should be something a
user can verify, not something we promise.

## What is NOT built

There is no backend in this preview, so **no file is produced**. Every export announces that it is
faked. The wiring — actually serialising rows, rendering the PNG, generating the PDF — is engine work.
