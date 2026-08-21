import { describe, expect, it } from 'vitest'
import { shouldPromoteToStaff } from './account'

describe('shouldPromoteToStaff', () => {
  it('promotes an openside.com customer account to staff', () => {
    expect(shouldPromoteToStaff({ role: 'customer', email: 'Autumn@OpenSide.COM' })).toBe(true)
  })

  it('does not re-promote existing super users', () => {
    expect(shouldPromoteToStaff({ role: 'super', email: 'staff@openside.com' })).toBe(false)
  })

  it('rejects external and lookalike domains', () => {
    expect(shouldPromoteToStaff({ role: 'customer', email: 'user@gmail.com' })).toBe(false)
    expect(shouldPromoteToStaff({ role: 'customer', email: 'user@evil-openside.com' })).toBe(false)
    expect(shouldPromoteToStaff({ role: 'customer', email: 'user@openside.com.evil.net' })).toBe(false)
  })
})
