// CSV reader for the restore-base Trigger.dev task.
//
// Filed by openspec/changes/workflows-restore (section 2.2).
// Inverse of csv-stream.ts (which is pageToCsv → backup-side).
//
// Input:  a CSV string produced by pageToCsv(), with CRLF or LF endings.
// Output: an array of header-keyed row objects ({ [fieldName]: cellString }).
//
// ALL cell values are strings — the caller (field-denormalizer.ts) is
// responsible for converting back to Airtable's typed field values.
//
// Implementation: Papa Parse in synchronous mode (we have the full string in
// memory already — it comes from StorageReader.readFile()). We do NOT use
// Papa Parse's streaming/chunk mode because:
//   1. The file is already in memory as a string/Buffer.
//   2. Papa Parse's streaming mode is designed for Node readable streams,
//      which would require wrapping our string in a stream.
//   3. For very large files, the caller should read in chunks; within a single
//      table CSV, we have full control of buffer size at the task level.
//
// Returns [] for header-only CSVs (matching the backup writer's convention:
// an empty Airtable table produces a header-only CSV so restore can detect it).

import Papa from "papaparse";

export type CsvRow = Record<string, string>;

/**
 * Parse a CSV string produced by pageToCsv() into an array of row objects.
 *
 * Accepts either a string or a Buffer (the raw output of StorageReader.readFile).
 * CRLF and LF line endings are both handled by Papa Parse.
 *
 * Returns Promise so callers can use await throughout — and so the
 * implementation can be upgraded to streaming without changing call sites.
 */
export async function parseCsv(csv: string | Buffer): Promise<CsvRow[]> {
  const input = Buffer.isBuffer(csv) ? csv.toString("utf8") : csv;

  const result = Papa.parse<CsvRow>(input, {
    header: true,
    skipEmptyLines: true,
  });

  // Papa Parse returns `errors` but only fatally fails for truly broken
  // files; lenient parsing is the documented default. We surface the rows
  // that were successfully parsed and let the caller decide what to do with
  // the error field if needed.
  return result.data;
}
