/**
 * CSV serialisation for Schema exports.
 *
 * This file exists because Airtable formula fields literally begin with `=`. Writing them into a CSV
 * unescaped is two bugs at once:
 *
 *  1. SECURITY — a formula authored in someone's base becomes an *executable* formula in whoever opens
 *     the backup. OWASP calls this CSV Injection / Formula Injection:
 *     https://owasp.org/www-community/attacks/CSV_Injection
 *     Trigger characters are `=`, `+`, `-`, `@`, and also TAB (0x09), CR (0x0D) and LF (0x0A).
 *  2. CORRECTNESS — even a benign formula is *evaluated* rather than shown, so the schema documentation
 *     we claim to export is simply wrong. For a tool whose job is to document Airtable, that is worse.
 *
 * OWASP's own caveat, which we do not hide from the user: there is no sanitisation strategy that is safe
 * for every spreadsheet application. We do the portable thing — quote everything, double embedded
 * quotes, and prefix a leading trigger character with an apostrophe — and we SAY so in the export panel
 * ("Formula definitions are exported as text").
 */

/** Characters that make a spreadsheet treat a cell as a formula rather than as text. */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r', '\n'];

/** The 3 bytes Excel-on-Windows needs to read UTF-8 without mojibake. Corrupts many other importers. */
export const UTF8_BOM = '﻿';

/**
 * One cell. Quoted always (so commas, newlines and semicolons inside Airtable long-text survive), inner
 * quotes doubled per RFC-4180, and a leading formula trigger neutralised with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = FORMULA_TRIGGERS.some((c) => raw.startsWith(c)) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** A whole table. `rows` are already in column order; `header` is the first line. */
export function formatCsv(header: readonly string[], rows: readonly (readonly unknown[])[], opts: { bom?: boolean } = {}): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  // CRLF is what RFC-4180 asks for and what Excel is happiest with.
  return (opts.bom ? UTF8_BOM : '') + lines.join('\r\n') + '\r\n';
}

/**
 * The filename answers "what did I actually export?" on the day the file is opened, not just in the
 * dialog. ISO date first so files sort correctly on every OS; the scope is spelled out, not implied.
 */
export function exportFilename(opts: {
  space: string;
  tab: string;
  scope: 'filtered' | 'all';
  ext: 'csv' | 'png' | 'pdf';
  /** Injected so the caller owns the clock — keeps this pure and testable. */
  date: Date;
}): string {
  const slug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const iso = opts.date.toISOString().slice(0, 10);
  return `baseout_${slug(opts.space)}_${slug(opts.tab)}_${iso}_${opts.scope}.${opts.ext}`;
}
