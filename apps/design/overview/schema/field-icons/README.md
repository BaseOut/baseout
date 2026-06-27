# Airtable field-type icons

The 31 SVGs in this folder are the **Airtable field-type icon set**,
for use in the Schema page's Visualize side panel (field rows) and
Changelog entries. Their presence **resolves the open icon question**
in the parent brief: we vendor the Airtable field-type icons as a
scoped exception to the otherwise Lucide-only rule, because matching
Airtable's iconography is what makes field rows instantly
recognizable to a user who lives in Airtable.

> See `contact-sheet.html` for a rendered preview of all 31 (open it
> in a browser — `node build-contact-sheet.mjs` regenerates it).

---

## Format (read before using)

Each file is a **bare `<path>` fragment**, not a complete SVG
document:

- No wrapping `<svg>` element — you must inline each path inside
  `<svg viewBox="0 0 16 16">…</svg>`. They will **not** render via
  `<img src="…">`.
- Drawn on a **16×16** coordinate space.
- `fill="currentColor"` — they inherit the surrounding text color.
  Tint by state with CSS `color:` (e.g. muted grey in a field row,
  or band colours if ever used as status). Don't hardcode fills.
- A couple (e.g. `single_select`) contain **two paths** — keep both.

Implementation note for engineering: these should land in the real
app as an inline-able icon component (sprite or per-type component)
under something like `apps/web/public/icons/airtable/`, mirroring how
Lucide icons are used elsewhere. The single-icon-set rule in
`apps/web` gets a documented exception for this set.

---

## Filename → Airtable field type

| File | Airtable field type |
|---|---|
| `single_line_text.svg` | Single line text |
| `long_text.svg` | Long text |
| `rich_text.svg` | Rich text |
| `number.svg` | Number |
| `currency.svg` | Currency |
| `percent.svg` | Percent |
| `duration.svg` | Duration |
| `rating.svg` | Rating |
| `checkbox.svg` | Checkbox |
| `single_select.svg` | Single select |
| `multiple_select.svg` | Multiple select |
| `date.svg` | Date |
| `phone_number.svg` | Phone number |
| `email.svg` | Email |
| `url.svg` | URL |
| `attachment.svg` | Attachment |
| `barcode.svg` | Barcode |
| `button.svg` | Button |
| `link.svg` | Link to another record |
| `lookup.svg` | Lookup |
| `rollup.svg` | Rollup |
| `count.svg` | Count |
| `formula.svg` | Formula |
| `auto_number.svg` | Autonumber |
| `collaborator.svg` | Collaborator (User) |
| `multiple_collaborator.svg` | Multiple collaborators |
| `created_by.svg` | Created by |
| `last_modified_by.svg` | Last modified by |
| `created_time.svg` | Created time |
| `last_modified_time.svg` | Last modified time |
| `external_sync_souce.svg` | External sync source |

That's effectively the full Airtable V1 field-type set.

---

## Two things to flag

1. **Typo in a filename:** `external_sync_souce.svg` (should be
   `…source`). Flag to engineering when this set is vendored into the
   app so the import name is corrected — fix it at vendor time, not by
   renaming here, so the source folder and any in-flight reference
   stay in sync.
2. **No "missing icon" fallback in the set.** If the engine ever
   reports a field type not in this list (new Airtable types, AI
   fields), design a neutral fallback (a generic Lucide field/`box`
   glyph). Don't let an unknown type render blank.
</content>
</invoke>
