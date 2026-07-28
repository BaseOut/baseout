import { describe, expect, it } from 'vitest'

import {
  AIRTABLE_API_BASE,
  AIRTABLE_AUTHORIZE_URL,
  AIRTABLE_SCOPES,
  AIRTABLE_TOKEN_URL,
  resolveAirtableUrls,
} from './config'

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

describe('resolveAirtableUrls', () => {
  it('returns the real Airtable endpoints when stubs are off', () => {
    expect(resolveAirtableUrls({}, 'https://baseout.local:4331')).toEqual({
      authorizeUrl: AIRTABLE_AUTHORIZE_URL,
      tokenUrl: AIRTABLE_TOKEN_URL,
      apiBase: AIRTABLE_API_BASE,
    })
  })

  // The stub routes live at src/pages/api/stub/airtable/* — Astro never
  // routes underscore-prefixed page dirs, so `/api/_stub/...` would 404.
  it('points at the ROUTED stub paths (no underscore) when stubs are on', () => {
    expect(
      resolveAirtableUrls(
        { AIRTABLE_STUBS_ENABLED: '1' },
        'https://baseout.local:4331/',
      ),
    ).toEqual({
      authorizeUrl: 'https://baseout.local:4331/api/stub/airtable/authorize',
      tokenUrl: 'https://baseout.local:4331/api/stub/airtable/token',
      apiBase: 'https://baseout.local:4331/api/stub/airtable',
    })
  })
})
