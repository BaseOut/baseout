/**
 * Airtable's fixed set of automation trigger types
 * (support.airtable.com/docs/automations-overview). Shared by SchemaAutomations
 * (server-rendered <option>s) and any client-side form rebuild — keep one list.
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
] as const
