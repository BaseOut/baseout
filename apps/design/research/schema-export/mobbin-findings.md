# Schema Export — Mobbin pattern evidence (2026-07-10)

Raw pattern evidence, gathered before any design decision. Every claim below is a screen I read, not
a recollection. Competitor/web evidence is in `competitors.md` and `pitfalls.md`.

## 1. Scope is expressed as radios WITH COUNTS. Every time.

The single most consistent finding. Products do not make you guess what "filtered" means — they
count it for you, in the option label.

| App | Exact wording | Screen |
|---|---|---|
| **Wix** | "Export collection as a CSV file / Choose which parts of your collection you want on your file." · `The entire collection (28 rows)` — *Export all items and fields, including hidden and system fields* · `Filtered data (7 rows)` — *Export filtered items only* · `Collection fields (0 rows)` | [screen](https://mobbin.com/screens/c03413e3-7999-4b36-a00a-43f37ece36b2) |
| **Shopify** | "Export products" · `Current page` · `All products` · `Selected: 0 products` (disabled) · `2 products matching your search` | [screen](https://mobbin.com/screens/280babd4-1ad6-4069-827c-0869dedde44c) |
| **Typeform** | "Choose a file to download" · `CSV file (2 responses)` · `XLSX file (2 responses)` | [screen](https://mobbin.com/screens/5ea8b873-bc70-4682-95ee-fbc21ecf73ef) |
| **Mixpanel** | Scope in the CONFIRM BUTTON: `Export 100 events` | [screen](https://mobbin.com/screens/fdfb6f83-1abc-4984-b50f-6db4d80dbff9) |

Two devices, both worth stealing:
- **Count in the option** (Wix, Shopify, Typeform) — lets you compare "filtered" against "everything"
  before committing.
- **Count in the button** (Mixpanel) — the last thing you read before you click is what you get.

Shopify also **disables** an impossible option (`Selected: 0 products`) rather than hiding it, which
teaches the control instead of silently changing shape.

## 2. Nobody makes you choose a format you don't have

Where a format choice exists it is a *second* decision, always below scope (Shopify: scope radios,
then "Export as"). Where there is only one sensible format, the label carries it: Sprig's modal is
titled **"Download CSV"** and its button says **"Download CSV"**, not "Export".
([Sprig](https://mobbin.com/screens/2c29538f-ef18-4f02-b9fa-7173e855c097))

This directly supports the client's fixed-format-per-tab decision: with one format, name it.

## 3. Image export shows a PREVIEW, and admits its background

- **Craft — "Image Export"** renders a live preview panel beside the options, and the preview is
  *dark* because the doc is dark. The user sees what will land in the file.
  ([screen](https://mobbin.com/screens/b998ce76-550f-4173-9b4d-dd63c5907378))
- **Air — "Export as"** shows `Size` (1x (Original) / Custom, with width/height and a lock), `Format`,
  a `Suffix` field, and a live `Preview: 6-logo.jpg` filename.
  ([screen](https://mobbin.com/screens/db7b1625-1346-4984-a637-4f3a5b646add))
- **Sketch — "Export Formats"** is scale + suffix + format (PNG/JPG/WEBP/SVG/PDF).
  ([screen](https://mobbin.com/screens/c362e7d2-82f8-49b9-8154-8dcd364278de))

The recurring trio for an image export: **scale · background/appearance · a preview you can trust**.
None of them ship a bare "Export image".

## 4. File SIZE, not just a spinner, on the confirm button

**Arcade** labels its confirm `Download GIF (0.17MB)` and offers presets (Email / Social media /
Presentation / Custom) that trade resolution against size, each explained in one sentence.
([screen](https://mobbin.com/screens/fe4d0c3b-48e8-434f-af76-d2a1611a1ccd))

## 5. Anything slow becomes a JOB, and says so before you wait

Four products, one pattern: the export leaves the modal and becomes a tracked task.

- **Basecamp**: "We're bundling up that export for you — Exporting can take up to a few hours
  depending on the size of your export. But don't worry, **we'll just email you when it's ready** —
  no need to wait around. You can close this."
  ([screen](https://mobbin.com/screens/4b3243df-ee07-4ae4-b495-51d5fe718aee))
- **Slack**: a success alert — "Your export is now being generated. You'll receive an email when the
  export is ready for download." — plus a **Past Exports** table (Started on · Type · Date range ·
  Status `Waiting…`) and the retention rule: *"Exports will be permanently removed 10 days after they
  are downloaded."* ([screen](https://mobbin.com/screens/85dd544d-465c-4062-9048-ae3111f7daea))
- **Brilliant**: "Your export has started. This usually takes a few hours (started 8/1/2024, 1:38 PM).
  You can close this window and come back any time in the next 7 days to download your data."
  ([screen](https://mobbin.com/screens/c1082a49-ac30-44e4-a4d3-90484a01193d))
- **ClickUp / HubSpot**: a persistent top banner — "Your import is in progress! We'll email you as
  soon as it's done" with a `Check status` button.
  ([ClickUp](https://mobbin.com/screens/67b14fe1-ea5b-45eb-8dfa-c6612fe24fee) ·
  [HubSpot](https://mobbin.com/screens/798a84ea-7a3e-494b-978f-f5068c6d6781))

Every one of them states the **expected duration** up front ("a few hours", "most finish in a few
minutes") and **where the result will appear**. None leave a spinner in a modal.

## 6. Column pickers exist, and they are a trap

Intercom's Export report is a full page of ~15 checkboxes grouped by entity
([screen](https://mobbin.com/screens/1d6babd7-82e1-4392-9ab5-0f274c499c3f)); Mixpanel offers
`Only selected columns` / `All event properties`; Sprig asks for `Column format: Labels / Values / Both`.

These are all *analytics* products where the column set is genuinely user-owned. A schema export has a
fixed, meaningful column set. Copying the column picker would import complexity we have no use for.

## What this evidence says for Baseout

1. The scope choice must show **counts**, and it must show BOTH numbers at once so they can be
   compared. "Current view (24)" vs "Everything (108)".
2. With one format per tab, the label says the format: **"Export CSV"**, not "Export".
3. The Visualize image export cannot be a bare button. It needs, at minimum, an answer to
   *what's the background* — dark canvas pasted into a white doc is the classic complaint — and a
   preview. This is the one tab where the client's "image is sufficient" underspecifies the design.
4. A PDF "report" of Health/Docs/Chat is the async case. Say how long, say where it will land, let the
   user close the dialog. Do not spin.
5. Resist the column picker. Our columns are the schema.
