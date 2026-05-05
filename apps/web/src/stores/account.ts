import { atom } from 'nanostores'
import type { AccountContext } from '../lib/account'

export const $account = atom<AccountContext | null>(null)
