import { describe, expect, it } from 'vitest'

import { AIRTABLE_SCOPES } from './config'

describe('AIRTABLE_SCOPES (Connect grant contract)', () => {
  // The exact consent screen customers approve at Connect. Changing this set
  // is a re-consent event for every existing Connection (oauth-setup.md §3.1,
  // Features §17 Q20) — update the runbook in the same change.
  it('is the pinned five-scope grant', () => {
    expect([...AIRTABLE_SCOPES]).toEqual([
      'data.records:read',
      'data.recordComments:read',
      'schema.bases:read',
      'webhook:manage',
      'workspacesAndBases:read',
    ])
  })
})
