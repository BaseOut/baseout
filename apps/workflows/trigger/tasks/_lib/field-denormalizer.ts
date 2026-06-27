// Field denormalizer for the restore-base Trigger.dev task.
//
// Filed by openspec/changes/workflows-restore (section 2.4).
// Inverse of field-normalizer.ts (which is normalizeFieldValue → backup-side).
//
// field-normalizer.ts transforms:
//   multipleRecordLinks array → comma-joined string   (e.g. "recA,recB")
//   multipleAttachments array → "[N attachments]"     (placeholder)
//   everything else           → pass-through (csv-stream JSON-stringifies)
//
// This file inverts those transforms so the restore task can feed correct
// shapes back to Airtable's create API (with typecast:true for the rest).
//
// ATTACHMENT MVP DECISION: attachment cells remain as "[N attachments]" text.
// Re-uploading actual attachment bytes is deferred (requires attachment-uploader.ts,
// the mirror of attachment-downloader.ts). The resulting Airtable base will
// have text cells where attachment fields were — intentional and documented.
//
// ALL incoming `cell` values are strings (everything is a string after parseCsv).
// The function returns the most Airtable-appropriate type for the field type.

const LINKED = "multipleRecordLinks";
const ATTACHMENTS = "multipleAttachments";
const NUMBER = "number";
const CHECKBOX = "checkbox";
const MULTI_SELECT = "multipleSelects";

/**
 * Convert a CSV cell string back to the value shape Airtable expects for the
 * given field type.
 *
 * - `multipleRecordLinks` "recA,recB" → ["recA","recB"]
 * - `multipleSelects`     JSON array string → string[]   (csv-stream JSON-serialized)
 * - `number`              "42" → 42 (falls back to string if not parseable)
 * - `checkbox`            "true"/"false" → boolean (falls back to string)
 * - `multipleAttachments` → passed through as-is (placeholder text; re-upload deferred)
 * - date / dateTime / everything else → string pass-through; Airtable accepts
 *   ISO date strings and typecast:true handles the rest.
 * - Empty string → empty string (caller can skip the field or let Airtable ignore it)
 */
export function denormalizeFieldValue(
  cell: string,
  fieldType: string,
): unknown {
  // Empty cell: always pass through as-is.
  if (cell === "") return cell;

  if (fieldType === LINKED) {
    // Normalizer joined with commas (Array.join(",")).
    return cell.split(",");
  }

  if (fieldType === ATTACHMENTS) {
    // MVP: attachment re-upload deferred. Pass through the placeholder text.
    return cell;
  }

  if (fieldType === MULTI_SELECT) {
    // csv-stream JSON-stringified the array before Papa Parse saw it.
    try {
      const parsed = JSON.parse(cell);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON — fall through and return raw string.
    }
    return cell;
  }

  if (fieldType === NUMBER) {
    const n = Number(cell);
    if (!Number.isNaN(n)) return n;
    // Not a valid number → return the raw string; typecast:true may handle it.
    return cell;
  }

  if (fieldType === CHECKBOX) {
    if (cell === "true") return true;
    if (cell === "false") return false;
    // Not a recognized boolean → return raw string.
    return cell;
  }

  // date, dateTime, singleLineText, multilineText, url, email, phone,
  // singleCollaborator, currency, percent, rating, duration,
  // and any unrecognized type → pass through as string.
  // Airtable's typecast:true will coerce where it can.
  return cell;
}
