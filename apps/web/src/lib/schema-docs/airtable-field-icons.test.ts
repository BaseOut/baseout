import { describe, expect, it } from 'vitest'
import { AIRTABLE_FIELD_ICONS, airtableIconKey, fieldTypeLabel } from './airtable-field-icons'

describe('airtableIconKey', () => {
  it('resolves the engine payload camelCase types to icon keys', () => {
    // Types observed in real per-Space schemas (engine schema-read payload).
    for (const t of [
      'singleLineText',
      'multilineText',
      'multipleAttachments',
      'singleSelect',
      'multipleRecordLinks',
      'singleRecordLink',
      'multipleLookupValues',
      'rollup',
      'formula',
      'checkbox',
      'date',
      'dateTime',
      'number',
      'url',
      'autoNumber',
      'singleCollaborator',
      'aiText',
    ]) {
      const key = airtableIconKey(t)
      expect(key, `no icon for ${t}`).toBeTruthy()
      expect(AIRTABLE_FIELD_ICONS[key!]).toBeTruthy()
    }
  })

  it('returns null for unknown types (caller renders the neutral fallback)', () => {
    expect(airtableIconKey('someBrandNewType')).toBeNull()
  })
})

describe('fieldTypeLabel', () => {
  it('labels camelCase and snake_case types', () => {
    expect(fieldTypeLabel('singleLineText')).toBe('Single line text')
    expect(fieldTypeLabel('multipleRecordLinks')).toBe('Multiple record links')
    expect(fieldTypeLabel('single_line_text')).toBe('Single line text')
    expect(fieldTypeLabel(undefined)).toBe('')
  })
})
