/**
 * Inbox — the notification/inbox center's data model and pure helpers.
 *
 * Kept out of the .astro frontmatter on purpose: union-heavy types plus inline
 * markup tags there break the esbuild build even though `astro check` passes.
 *
 * The model encodes three research-backed rules (see research/notifications-inbox):
 *   1. Two lanes. `attention` needs a decision; `activity` is FYI. A flat list
 *      (Linear's actual weakness) buries the one row that matters.
 *   2. Successes roll up per base; failures, breaking changes and reconnect never do.
 *   3. State-backed alerts self-heal. When the underlying state clears (the user
 *      reconnects), the row resolves silently — it does not mint a "it's fixed!" row.
 */

export type InboxKind =
  | 'connection-broken'
  | 'backup-failed'
  | 'schema-breaking'
  | 'health-drop'
  | 'backup-ok'
  | 'schema-changed'
  | 'automation-off'
  | 'interface-unpublished'
  | 'chat-doc';

/** Which half of the panel a row belongs in. */
export type InboxLane = 'attention' | 'activity';

export interface InboxAction {
  label: string;
  href: string;
  /** Lucide token, e.g. `lucide--refresh-cw`. */
  icon: string;
  /**
   * The one action on the row that UNBLOCKS something (reconnect a dead source). It gets the primary
   * emphasis; everything else stays tertiary so the notification's own sentence is what you read first.
   * At most one per row, by construction — a row with two urgent actions has no urgent action.
   */
  primary?: boolean;
}

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** Row copy. `*markers*` render bold — same convention as the connection banner. */
  title: string;
  detail?: string;
  /** The base this concerns (display name). Doubles as the rollup key. */
  base?: string;
  /**
   * Airtable base id — the persistence key for `Mute this base`
   * (web-notifications-inbox §5.1). Absent on rows that predate the engine
   * feed (fixtures); muting those stays client-only.
   */
  baseId?: string;
  /**
   * The Space this row came from. The Inbox is ACCOUNT-level (Dan agreed, on the
   * condition that each row says where it is from), so with two or more Spaces every
   * row is labelled and a Space filter appears. With exactly one, both are pointless
   * noise and are not rendered at all.
   */
  space?: string;
  /**
   * The Space's UUID — the address for the triage/mute proxy routes
   * (`/api/spaces/:spaceId/inbox/*`). Stamped by the SSR fan-out
   * (lib/inbox-feed.ts) even for single-Space accounts, where the display
   * `space` label above is deliberately absent.
   */
  spaceId?: string;
  /** ISO timestamp. */
  at: string;
  /** Deep-link to the exact surface (a run's log, the schema diff, the reconnect flow). */
  href?: string;
  /** Inline action. Reserve for rows the user can resolve from here. */
  action?: InboxAction;

  read?: boolean;
  done?: boolean;
  /** ISO timestamp; the row hides until then, and resurfaces early on new activity. */
  snoozedUntil?: string | null;

  /**
   * Bound to live state rather than describing a past event. A state-backed row
   * resolves itself when the state clears (reconnect done → the alert and the
   * banner both go). Event rows (a backup that failed) are acknowledge-based:
   * a later success does not un-happen the failure.
   */
  stateBacked?: boolean;
  resolved?: boolean;
}

interface KindMeta {
  lane: InboxLane;
  icon: string;
  /** Soft tinted chip behind the icon. Semantic, never a raw colour. */
  chip: string;
  label: string;
}

export const KIND_META: Record<InboxKind, KindMeta> = {
  'connection-broken':     { lane: 'attention', icon: 'lucide--unplug',        chip: 'bg-error/10 text-error',     label: 'Connection' },
  'backup-failed':         { lane: 'attention', icon: 'lucide--triangle-alert', chip: 'bg-error/10 text-error',     label: 'Backup' },
  'schema-breaking':       { lane: 'attention', icon: 'lucide--git-branch',    chip: 'bg-warning/10 text-warning', label: 'Schema' },
  'health-drop':           { lane: 'attention', icon: 'lucide--activity',      chip: 'bg-warning/10 text-warning', label: 'Health' },
  'backup-ok':             { lane: 'activity',  icon: 'lucide--archive',       chip: 'bg-success/10 text-success', label: 'Backup' },
  'schema-changed':        { lane: 'activity',  icon: 'lucide--git-branch',    chip: 'bg-base-200 text-base-content/70', label: 'Schema' },
  'automation-off':        { lane: 'activity',  icon: 'lucide--zap-off',       chip: 'bg-base-200 text-base-content/70', label: 'Automation' },
  'interface-unpublished': { lane: 'activity',  icon: 'lucide--layout-panel-top', chip: 'bg-base-200 text-base-content/70', label: 'Interface' },
  'chat-doc':              { lane: 'activity',  icon: 'lucide--file-text',     chip: 'bg-base-200 text-base-content/70', label: 'Docs' },
};

export const laneOf = (item: InboxItem): InboxLane => KIND_META[item.kind].lane;

/** Hidden from both lanes: done, resolved, or still snoozed. */
export function isHidden(item: InboxItem, now: Date): boolean {
  return handledReason(item, now) !== null;
}

export type HandledReason = 'done' | 'resolved' | 'snoozed';

/**
 * Why a row is out of the active lanes — or null if it is still live.
 *
 * "Handled" rows are rendered but hidden behind the Activity lane's `Show handled`
 * toggle, so a mis-click on Done is recoverable instead of a one-way door.
 */
export function handledReason(item: InboxItem, now: Date): HandledReason | null {
  if (item.resolved) return 'resolved';
  if (item.done) return 'done';
  if (item.snoozedUntil && new Date(item.snoozedUntil) > now) return 'snoozed';
  return null;
}

/**
 * Handled rows always sit in Activity, whatever their kind. A resolved
 * "reconnect!" needs no decision any more, so it must not sit in the lane whose
 * entire meaning is "you still have to do something".
 */
export const HANDLED_LABEL: Record<HandledReason, string> = {
  done: 'Done',
  resolved: 'Resolved',
  snoozed: 'Snoozed',
};

/**
 * A rolled-up group. Successful backups for one base collapse into a single row
 * ("Sales CRM — 3 backups completed"), expandable to the individual runs. A group
 * of one renders as a plain row.
 */
export interface InboxGroup {
  /** Stable id — the group's own row id, or the single item's id. */
  id: string;
  lead: InboxItem;
  children: InboxItem[];
}

/** Kinds that may roll up. Everything else stays standalone, by design. */
const ROLLABLE: ReadonlySet<InboxKind> = new Set<InboxKind>(['backup-ok', 'schema-changed']);

/**
 * Batch-on-read: collapse at display time. Groups by (kind, base) and only when
 * there are 2+ — a lone success is clearer as itself.
 */
export function rollUp(items: InboxItem[]): InboxGroup[] {
  const buckets = new Map<string, InboxItem[]>();
  const out: InboxGroup[] = [];

  for (const item of items) {
    if (!ROLLABLE.has(item.kind) || !item.base) {
      out.push({ id: item.id, lead: item, children: [] });
      continue;
    }
    const key = `${item.kind}::${item.space ?? ''}::${item.base}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  for (const [key, bucket] of buckets) {
    const [lead, ...rest] = bucket;
    if (rest.length === 0) {
      out.push({ id: lead.id, lead, children: [] });
      continue;
    }
    out.push({ id: `group-${key}`, lead, children: rest });
  }

  return out.sort((a, b) => +new Date(b.lead.at) - +new Date(a.lead.at));
}

/** "3 backups completed" — the rolled-up lead's title. */
export function groupTitle(group: InboxGroup): string {
  if (group.children.length === 0) return group.lead.title;
  const n = group.children.length + 1;
  const noun = group.lead.kind === 'backup-ok' ? 'backups completed' : 'schema changes';
  return `*${group.lead.base}* — ${n} ${noun}`;
}

/** "Show 3 runs" / "Show 2 changes" — the disclosure label must match the group's noun. */
export function groupToggleLabel(group: InboxGroup): string {
  const n = group.children.length + 1;
  const noun = group.lead.kind === 'backup-ok' ? 'runs' : 'changes';
  return `Show ${n} ${noun}`;
}

export function unreadCount(items: InboxItem[], now: Date): number {
  return items.filter((i) => !isHidden(i, now) && !i.read).length;
}

export function attentionCount(items: InboxItem[], now: Date): number {
  return items.filter((i) => !isHidden(i, now) && laneOf(i) === 'attention').length;
}

/** Strip `*emphasis*` markers — for places that render as plain text, not HTML. */
export const plain = (text: string): string => text.replace(/\*/g, '');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative stamp: 4m · 2h · 3d · then a date. */
export function ago(iso: string, now: Date): string {
  const delta = now.getTime() - new Date(iso).getTime();
  if (delta < MINUTE) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
