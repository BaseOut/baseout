import type { AccountContext } from './account'

export type DashboardState =
  | 'signed-out'
  | 'no-space'
  | 'setup-incomplete'
  | 'active'
  | 'other'

export interface DashboardNextStep {
  label: string
  href: string
  icon: string
}

export interface DashboardModel {
  state: DashboardState
  greeting: string
  orgName: string | null
  spaceName: string | null
  spaceStatusLabel: string | null
  nextStep: DashboardNextStep | null
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1)
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0]
}

export function buildDashboardModel(
  account: AccountContext | null,
): DashboardModel {
  if (!account) {
    return {
      state: 'signed-out',
      greeting: 'Welcome',
      orgName: null,
      spaceName: null,
      spaceStatusLabel: null,
      nextStep: null,
    }
  }

  const name = firstName(account.user.name)
  const greeting = name ? `Welcome, ${name}` : 'Welcome'
  const orgName = account.organization?.name ?? null

  if (!account.space) {
    return {
      state: 'no-space',
      greeting,
      orgName,
      spaceName: null,
      spaceStatusLabel: null,
      nextStep: null,
    }
  }

  const { name: spaceName, status } = account.space

  if (status === 'setup_incomplete') {
    return {
      state: 'setup-incomplete',
      greeting,
      orgName,
      spaceName,
      spaceStatusLabel: 'Setup in progress',
      nextStep: {
        label: 'Connect your first Airtable base',
        href: '/integrations',
        icon: 'link',
      },
    }
  }

  if (status === 'active') {
    return {
      state: 'active',
      greeting,
      orgName,
      spaceName,
      spaceStatusLabel: 'Active',
      nextStep: null,
    }
  }

  return {
    state: 'other',
    greeting,
    orgName,
    spaceName,
    spaceStatusLabel: capitalize(status),
    nextStep: null,
  }
}
