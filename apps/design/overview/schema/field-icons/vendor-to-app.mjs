// One-off: vendor the 31 bare <path> Airtable field-type icon fragments into
// a portable TS data file in apps/web (so the Schema island + Changelog can
// render them inline as currentColor 16x16 SVGs). Run: `node vendor-to-app.mjs`.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../apps/web/src/components/schema/airtableFieldIcons.ts');

const files = readdirSync(here).filter((f) => f.endsWith('.svg')).sort();
const entries = files.map((f) => {
  const stem = f.replace(/\.svg$/, '');
  // Collapse all whitespace runs to single spaces; SVG path data is space/comma
  // delimited so this is lossless. Keep every <path> (some icons have two).
  const inner = readFileSync(join(here, f), 'utf8').replace(/\s+/g, ' ').trim();
  return [stem, inner];
});

const body = entries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');

const ts = `/**
 * Airtable field-type icons — the real 31-icon set, vendored.
 *
 * A SCOPED EXCEPTION to the otherwise Lucide-only icon rule (CLAUDE.md): matching
 * Airtable's own field iconography is what makes a field row instantly readable to
 * someone who lives in Airtable. Source of truth: overview/schema/field-icons/*.svg
 * (16x16, fill="currentColor", bare <path> fragments). Regenerate with
 * \`node overview/schema/field-icons/vendor-to-app.mjs\` — do not hand-edit below.
 *
 * Keys are Airtable snake_case field types (matching our SchemaField.type fixtures).
 * Render inside <svg viewBox="0 0 16 16">; they inherit \`color\`. Unknown types
 * (new Airtable types, AI fields) must fall back to a neutral glyph — never blank.
 */
export const AIRTABLE_FIELD_ICONS: Record<string, string> = {
${body}
};

// Common aliases: our short labels + the Airtable REST API's camelCase type names,
// mapped to the snake_case keys above so real-API payloads resolve too.
const ALIAS: Record<string, string> = {
  text: 'single_line_text',
  singlelinetext: 'single_line_text',
  multilinetext: 'long_text',
  longtext: 'long_text',
  richtext: 'rich_text',
  autonumber: 'auto_number',
  phone: 'phone_number',
  multipleselects: 'multiple_select',
  singleselect: 'single_select',
  multiplerecordlinks: 'link',
  multipleattachments: 'attachment',
  singlecollaborator: 'collaborator',
  multiplecollaborators: 'multiple_collaborator',
  createdtime: 'created_time',
  lastmodifiedtime: 'last_modified_time',
  createdby: 'created_by',
  lastmodifiedby: 'last_modified_by',
  externalsyncsource: 'external_sync_source',
  external_sync_souce: 'external_sync_source', // tolerate the source-folder typo
};

/** Resolve a field type (snake_case OR Airtable camelCase) to an icon key, or null. */
export function airtableIconKey(type: string): string | null {
  if (AIRTABLE_FIELD_ICONS[type]) return type;
  const norm = type.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (AIRTABLE_FIELD_ICONS[norm]) return norm;
  const aliased = ALIAS[norm] ?? ALIAS[type];
  return aliased && AIRTABLE_FIELD_ICONS[aliased] ? aliased : null;
}
`;

writeFileSync(out, ts);
console.log(`Wrote ${entries.length} icons -> ${out}`);
