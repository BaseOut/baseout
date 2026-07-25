// Grouped sidebar navigation (admin-operations-overview D5). navGroups replaces
// the flat list; each sibling change appends its own entry as it lands, but the
// grouping structure is owned here. A guard test (nav.test.ts) asserts every href
// resolves to an existing page file (no dead links).

export interface NavItem { href: string; label: string; icon: string }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { href: '/', label: 'Overview', icon: 'iconify lucide--layout-dashboard' },
      { href: '/errors', label: 'Errors', icon: 'iconify lucide--triangle-alert' },
      { href: '/backups', label: 'Backups', icon: 'iconify lucide--database-backup' },
      { href: '/restores', label: 'Restores', icon: 'iconify lucide--archive-restore' },
      { href: '/connections', label: 'Connections', icon: 'iconify lucide--plug' },
      { href: '/databases', label: 'Databases', icon: 'iconify lucide--database' },
      { href: '/services', label: 'Services', icon: 'iconify lucide--activity' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/customers', label: 'Customers', icon: 'iconify lucide--users-round' },
      { href: '/users', label: 'Users', icon: 'iconify lucide--user' },
      { href: '/spaces', label: 'Spaces', icon: 'iconify lucide--layers' },
    ],
  },
  {
    label: 'Billing',
    items: [{ href: '/subscriptions', label: 'Subscriptions', icon: 'iconify lucide--credit-card' }],
  },
  {
    label: 'System',
    items: [
      { href: '/migration', label: 'Migration', icon: 'iconify lucide--arrow-right-left' },
      { href: '/audit', label: 'Audit', icon: 'iconify lucide--scroll-text' },
    ],
  },
]
