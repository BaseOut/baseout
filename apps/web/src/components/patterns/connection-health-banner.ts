// Types + presentation logic for ConnectionHealthBanner.astro / ConnectionHealthPill.astro.
//
// This lives in a plain .ts module on purpose. Astro's frontmatter scanner
// mis-parses some TS (union-heavy types, inline markup tags) and breaks the
// esbuild transform; esbuild handles the exact same code cleanly here. The
// .astro files stay thin and just render what getBannerConfig() returns.
import { emph } from '../../lib/ui';

export type ConnectionBannerState =
  | 'broken'
  | 'expiring'
  | 'degraded'
  | 'reconnecting'
  | 'restored';

export interface ConnectionBannerProps {
  state: ConnectionBannerState;
  /** Connection display name, e.g. "Airtable" or "Google Drive". */
  provider?: string;
  /** Which side of the pipeline is affected — shapes the copy. */
  side?: 'source' | 'destination';
  /** Affected count. >1 renders the grouped roll-up (broken only). */
  count?: number;
  /** Names for the grouped roll-up (used when count > 1). */
  names?: string[];
  /** e.g. "2 days ago" — appended to the broken-source copy. */
  lastBackup?: string;
  /** Days until the token expires — used by `expiring`. */
  daysToExpiry?: number;
  /** Where the Reconnect CTA points. */
  reconnectHref?: string;
  /** Override collapsibility (defaults true for broken). */
  collapsible?: boolean;
  /** Full-bleed bar (no side radius) when slotted edge-to-edge. */
  bleed?: boolean;
  /** Ties a collapsible bar to its topbar pill (same group string). */
  group?: string;
  id?: string;
  class?: string;
}

export interface BannerAction {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  href?: string;
  icon?: string;
}

export interface BannerConfig {
  alertClass: string;
  dotClass: string;
  /** Tinted chip behind the leading icon (translucent bg + semantic text). */
  iconChip: string;
  icon: string;
  spin: boolean;
  titleHtml: string;
  descHtml: string;
  action: BannerAction | null;
  collapsible: boolean;
  dismissible: boolean;
  pillLabel: string;
}

type Severity = 'error' | 'warning' | 'info' | 'success';

const ALERT_CLASS: Record<Severity, string> = {
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
  success: 'alert-success',
};

const DOT_CLASS: Record<Severity, string> = {
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
};

const ICON_CHIP: Record<Severity, string> = {
  error: 'bg-error/15 text-error',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
};

function joinNames(items: string[]): string {
  const marked = items.map((n) => `*${n}*`);
  if (marked.length <= 1) return marked.join('');
  if (marked.length === 2) return `${marked[0]} and ${marked[1]}`;
  return `${marked.slice(0, -1).join(', ')} and ${marked[marked.length - 1]}`;
}

export function getBannerConfig(props: ConnectionBannerProps): BannerConfig {
  const {
    state,
    provider = 'Airtable',
    side = 'source',
    count = 1,
    names = [],
    lastBackup,
    daysToExpiry,
    reconnectHref = '#',
    collapsible,
  } = props;

  const grouped = state === 'broken' && count > 1;

  let sev: Severity;
  let icon: string;
  let spin = false;
  let title: string;
  let desc: string;
  let action: BannerAction | null = null;
  let canCollapse: boolean;
  let dismissible: boolean;

  if (grouped) {
    sev = 'error';
    icon = 'lucide--triangle-alert';
    title = `${count} connections need attention. Backups are paused.`;
    desc = `${joinNames(names)} have stopped working. Reconnect them to get backups running again.`;
    action = { label: 'Review connections', variant: 'primary', href: reconnectHref };
    canCollapse = collapsible ?? true;
    dismissible = false;
  } else if (state === 'broken') {
    const isDest = side === 'destination';
    sev = 'error';
    icon = 'lucide--triangle-alert';
    title = isDest
      ? `Backups paused: can’t write to *${provider}*.`
      : `Backups paused: your *${provider}* connection expired.`;
    desc = isDest
      ? `Your source is fine. The destination needs reconnecting before backups can resume.`
      : `Nothing is being backed up until you reconnect.${lastBackup ? ` Last successful backup: *${lastBackup}*.` : ''}`;
    action = { label: 'Reconnect', variant: 'primary', href: reconnectHref, icon: 'lucide--refresh-cw' };
    canCollapse = collapsible ?? true;
    dismissible = false;
  } else if (state === 'expiring') {
    sev = 'warning';
    icon = 'lucide--clock';
    title = daysToExpiry != null
      ? `Your *${provider}* connection expires in *${daysToExpiry} ${daysToExpiry === 1 ? 'day' : 'days'}*.`
      : `Your *${provider}* connection needs reconnecting soon.`;
    desc = `Reconnect now to keep backups running, with no interruption if you do it in time.`;
    action = { label: 'Reconnect', variant: 'secondary', href: reconnectHref, icon: 'lucide--refresh-cw' };
    canCollapse = collapsible ?? false;
    dismissible = true;
  } else if (state === 'degraded') {
    sev = 'warning';
    icon = 'lucide--triangle-alert';
    title = `No successful backup of *${provider}* in the last 24 hours.`;
    desc = `We’re retrying automatically. If it keeps failing, we’ll ask you to reconnect.`;
    action = { label: 'View details', variant: 'ghost', href: reconnectHref };
    canCollapse = collapsible ?? false;
    dismissible = true;
  } else if (state === 'reconnecting') {
    sev = 'info';
    icon = 'lucide--refresh-cw';
    spin = true;
    title = `Reconnecting *${provider}*…`;
    desc = `Verifying access. Authorization ✓ · Read access ✓ · Checking destination…`;
    canCollapse = false;
    dismissible = false;
  } else {
    sev = 'success';
    icon = 'lucide--circle-check';
    title = `Connection restored. Backups are running again.`;
    desc = `Next backup runs on schedule, and we’ve re-queued the one that was missed.`;
    canCollapse = false;
    dismissible = true;
  }

  return {
    alertClass: ALERT_CLASS[sev],
    dotClass: DOT_CLASS[sev],
    iconChip: ICON_CHIP[sev],
    icon,
    spin,
    titleHtml: emph(title),
    descHtml: emph(desc),
    action,
    collapsible: canCollapse,
    dismissible,
    pillLabel: grouped ? `${count} connections need reconnecting` : `${provider} needs reconnecting`,
  };
}
