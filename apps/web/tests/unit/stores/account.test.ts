// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { $account, hydrateAccountFromDom } from '../../../src/stores/account'
import type { AccountContext } from '../../../src/lib/account'

const SAMPLE: AccountContext = {
  user: {
    id: 'u1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
  },
  organization: { id: 'o1', name: 'Acme', slug: 'acme' },
  membership: { role: 'owner', isDefault: true },
  space: { id: 's1', name: 'Production', status: 'active' },
  spaces: [{ id: 's1', name: 'Production', status: 'active' }],
}

describe('$account store hydration', () => {
  beforeEach(() => {
    $account.set(null)
    document.body.innerHTML = ''
  })

  it('parses #account-state JSON and sets the atom', () => {
    const script = document.createElement('script')
    script.id = 'account-state'
    script.type = 'application/json'
    script.textContent = JSON.stringify(SAMPLE)
    document.body.appendChild(script)

    const result = hydrateAccountFromDom()

    expect(result).toEqual(SAMPLE)
    expect($account.get()).toEqual(SAMPLE)
  })

  it('returns null cleanly when #account-state is missing', () => {
    const result = hydrateAccountFromDom()
    expect(result).toBeNull()
    expect($account.get()).toBeNull()
  })

  it('returns null and leaves the atom alone when JSON is malformed', () => {
    const script = document.createElement('script')
    script.id = 'account-state'
    script.textContent = '{not-json'
    document.body.appendChild(script)

    $account.set(SAMPLE)
    const result = hydrateAccountFromDom()

    expect(result).toBeNull()
    expect($account.get()).toEqual(SAMPLE)
  })
})
