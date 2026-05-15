// Per-field-type transforms applied to Airtable record fields before they
// hit csv-stream. csv-stream JSON-stringifies remaining arrays/objects, so
// we only intervene where the spec calls for a different shape:
// - multipleRecordLinks → comma-joined record IDs (cell stores the link IDs,
//   not a JSON array, so downstream CSV consumers can split simply).
// - multipleAttachments → "[N attachments]" placeholder (MVP doesn't store
//   attachment URLs/blobs — Phase 8+ will).

const LINKED = "multipleRecordLinks";
const ATTACHMENTS = "multipleAttachments";

export function normalizeFieldValue(
  value: unknown,
  fieldType: string,
): unknown {
  if (fieldType === LINKED && Array.isArray(value)) {
    return value.join(",");
  }
  if (fieldType === ATTACHMENTS && Array.isArray(value)) {
    return `[${value.length} attachments]`;
  }
  return value;
}
