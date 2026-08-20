import { describe, it, expect } from 'vitest'
import { connectFailure, CONNECT_FAILURE_CODES } from './failureCopy'

describe('connectFailure', () => {
  it('returns null for a missing code', () => {
    expect(connectFailure(null, 'Airtable')).toBeNull()
    expect(connectFailure(undefined, 'Airtable')).toBeNull()
    expect(connectFailure('', 'Airtable')).toBeNull()
  })

  it('resolves every known code without leaving a {provider} placeholder', () => {
    for (const code of CONNECT_FAILURE_CODES) {
      const result = connectFailure(code, 'Airtable')
      expect(result).not.toBeNull()
      expect(result!.code).toBe(code)
      expect(result!.message.length).toBeGreaterThan(0)
      expect(result!.message).not.toContain('{provider}')
    }
  })

  it('keeps access_denied actionable and second-person', () => {
    const result = connectFailure('access_denied', 'Airtable')
    expect(result?.message).toBe('You declined to give Baseout access to your Airtable account.')
  })

  it('falls back for an unknown code', () => {
    const result = connectFailure('not_a_real_code', 'Airtable')
    expect(result?.code).toBe('not_a_real_code')
    expect(result?.message).toBe('Connection failed. Please try again.')
  })
})
