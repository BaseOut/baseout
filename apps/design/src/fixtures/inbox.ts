import type { InboxItem } from '@web/components/layout/inbox';

/**
 * Fake inbox rows. Timestamps are relative to load so the panel always reads
 * "2h ago" rather than a frozen date. There is no backend: triage actions mutate
 * client state only and a refresh resets everything to this fixture.
 *
 * The Inbox is ACCOUNT-level, so rows span BOTH Spaces from `account.ts`
 * (Core CRM · Marketing Ops) — that is what makes the Space label and filter appear.
 * `space` is the Space; `base` is an Airtable base inside it. The two were conflated
 * here before ("Marketing Ops" sat in `base`), which made the rollup key ambiguous.
 */
const now = Date.now();
const hours = (h: number) => new Date(now - h * 3_600_000).toISOString();

export const inboxItems: InboxItem[] = [
  // ── Needs attention ──────────────────────────────────────────────────────
  {
    id: 'n-conn-airtable',
    kind: 'connection-broken',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: '*Airtable* needs reconnecting — backups are paused.',
    detail: 'Nothing is being backed up until you reconnect. Last successful backup: 2 days ago.',
    at: hours(2),
    href: '/sources',
    action: { label: 'Reconnect', href: '/sources', icon: 'lucide--refresh-cw', primary: true },
    stateBacked: true,
  },
  {
    id: 'n-backup-failed',
    kind: 'backup-failed',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: '*Sales CRM* backup failed — 3 of 12 bases incomplete.',
    detail: 'Two bases hit Airtable rate limits; one was deleted mid-run.',
    at: hours(5),
    href: '/backups',
    action: { label: 'View log', href: '/backups', icon: 'lucide--scroll-text' },
  },
  {
    id: 'n-schema-breaking',
    kind: 'schema-breaking',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: 'Breaking schema change in *Sales CRM* — field *Amount* changed type.',
    detail: 'Currency → Number. 4 formulas and 1 rollup reference this field.',
    at: hours(9),
    href: '/schema',
    action: { label: 'Review diff', href: '/schema', icon: 'lucide--git-compare' },
  },
  {
    id: 'n-health-drop',
    kind: 'health-drop',
    space: 'Marketing Ops',
    base: 'Campaigns',
    title: 'Health score for *Campaigns* dropped to *62* (was 78).',
    detail: 'Driven by 11 new fields with no description and 2 orphaned tables.',
    at: hours(26),
    href: '/schema',
    stateBacked: true,
  },

  // ── Activity — successes roll up per base ────────────────────────────────
  { id: 'a-ok-1', kind: 'backup-ok', space: 'Marketing Ops', base: 'Campaigns', title: '*Campaigns* backup completed', at: hours(6),  href: '/backups' },
  { id: 'a-ok-2', kind: 'backup-ok', space: 'Marketing Ops', base: 'Campaigns', title: '*Campaigns* backup completed', at: hours(30), href: '/backups' },
  { id: 'a-ok-3', kind: 'backup-ok', space: 'Marketing Ops', base: 'Campaigns', title: '*Campaigns* backup completed', at: hours(54), href: '/backups' },
  { id: 'a-ok-4', kind: 'backup-ok', space: 'Core CRM',      base: 'Sales CRM', title: '*Sales CRM* backup completed', at: hours(53), href: '/backups', read: true },

  {
    id: 'a-schema-1',
    kind: 'schema-changed',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: '*Sales CRM* — field *Notes* added to *Deals*',
    at: hours(12),
    href: '/schema',
  },
  {
    id: 'a-schema-2',
    kind: 'schema-changed',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: '*Sales CRM* — table *Archive* renamed to *Archive 2025*',
    at: hours(31),
    href: '/schema',
  },
  {
    id: 'a-automation',
    kind: 'automation-off',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: 'Automation *Nightly digest* was turned off in Airtable.',
    at: hours(20),
    href: '/schema',
    read: true,
  },
  {
    id: 'a-interface',
    kind: 'interface-unpublished',
    space: 'Marketing Ops',
    base: 'Campaigns',
    title: 'Interface *Campaign tracker* is no longer published.',
    at: hours(44),
    href: '/schema',
  },
  {
    id: 'a-chat-doc',
    kind: 'chat-doc',
    space: 'Core CRM',
    base: 'Sales CRM',
    title: 'Chat answer saved as a doc: *How Deals links to Contacts*',
    at: hours(47),
    href: '/schema',
    read: true,
  },

  // ── A state-backed row that already healed itself. Hidden from both lanes;
  //    it demonstrates the silent-resolve model rather than minting a new row.
  {
    id: 'a-resolved',
    kind: 'connection-broken',
    space: 'Marketing Ops',
    base: 'Campaigns',
    title: '*Google Drive* needs reconnecting',
    at: hours(70),
    stateBacked: true,
    resolved: true,
    read: true,
  },
];

/** Zero-state: nothing to triage. */
export const inboxEmpty: InboxItem[] = [];

/**
 * A single-Space account (`?fixture=one-space`). Proves the other half of the Space rule: with one
 * Space, the per-row Space caption and the Space group in the filter menu must not render at all —
 * they would repeat the same word on every row and say nothing.
 */
export const inboxOneSpace: InboxItem[] = inboxItems.filter((i) => i.space === 'Core CRM');
