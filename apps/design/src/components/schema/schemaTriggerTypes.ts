/**
 * Airtable's fixed set of automation trigger types (support.airtable.com/docs/automations-overview).
 * Airtable itself surfaces these as a "Trigger type" dropdown; we mirror that instead of free text.
 *
 * Lives in its own module because TWO surfaces render the same list and they must not drift: the
 * Register drawer (SchemaAutomations.astro, server-rendered <option>s) and the EntityPanel's edit
 * mode (schemaReadBody.ts, built as an HTML string at runtime). An .astro export cannot be imported
 * by a .ts controller, which is why the constant moved out of the component.
 */
export const TRIGGER_TYPES = [
  'When a record is created',
  'When a record is updated',
  'When a record matches conditions',
  'When a record enters a view',
  'At a scheduled time',
  'When a form is submitted',
  'When a webhook is received',
  'When a button is clicked',
  'Integrated (Google / Outlook)',
];
