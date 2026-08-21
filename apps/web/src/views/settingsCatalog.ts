/**
 * settingsCatalog — the categories, sections and rows behind SettingsView (specs/12-settings.md).
 *
 * It lives beside the view rather than inside its frontmatter for two reasons: Astro frontmatter is
 * kept thin here (union-heavy types have broken the esbuild build before), and a plain `.ts` is the
 * part of this surface that real `tsc --strict` (via `astro check`) sees most cleanly.
 *
 * Every identity value is a PARAMETER, never a literal — name, email and Organization arrive from
 * `Astro.locals.account` through `buildCategories()`.
 *
 * SINGLE-OPERATOR V1 (audit decision D18). There is no second user in this product, so there is no
 * per-row `admin` flag and no locked rendering. The `Per org · admin` labels on the rail describe
 * the SCOPE a setting applies at, not a permission the viewer might lack.
 *
 * PROMOTION RECONCILE (apps/web, web-settings). The fork's rows are a fixture-driven PREVIEW that
 * flashes "Saved" without persisting. apps/web has real routes for exactly four sections — API
 * tokens, AI keys, retention and billing — and no route yet for the rest. So rather than fake a
 * save, this catalog:
 *   · WIRES the real ones: billing "Open portal" → `action: 'billing-portal'` (POST /api/billing/portal);
 *     usage → `href: '/reports'`; retention → `href: '/retention'`; API tokens + AI keys render as
 *     real panels inside the Developer pane (SettingsView, not rows here).
 *   · GATES the rest honestly: org identity, notification prefs, and sessions have no persistence
 *     route yet. Account name, Space name, and auto-add now persist. `gated` still renders a text
 *     row `readonly` and a select/toggle `disabled` (no fake "Saved").
 */

/**
 * What sits on the right of a row.
 *
 * `text` / `select` / `toggle` are settings controls (commit contract in `settingsControls.ts`);
 * when `gated`, they render read-only/disabled because no persistence route exists yet. `button` /
 * `link` are deferred actions — the destination is a screen apps/web does not yet contain, so
 * pressing states where it goes instead of pretending to go there — UNLESS a real `href` (link) or
 * `action` (button) is set, in which case the control performs the real navigation/mutation.
 * `avatar` is the picture plus its (still undecided) change control. `destructive` (audit D06) asks
 * first via the catalog `confirm-modal`.
 */
export type SettingsControl = 'text' | 'select' | 'toggle' | 'button' | 'link' | 'avatar' | 'destructive';

export interface SettingsRow {
  /** Stable per-row key — the commit handler uses it for the live-region message. */
  id: string;
  label: string;
  /**
   * One line saying what changing this does. On a `destructive` row it is rendered TWICE — in the
   * row and as the confirm dialog's lead above `consequence` — so it must summarise `consequence`.
   */
  desc: string;
  control: SettingsControl;
  /** Current value for `text`, and the selected option for `select`. */
  value?: string;
  /** The full option list for `select`. `value` must be one of them. */
  options?: string[];
  /** Starting state for `toggle`. */
  on?: boolean;
  /** Button label for `button` / `link` / `avatar`. */
  cta?: string;
  /**
   * The honest answer to "what happens if I press this?", shown on press for a deferred action.
   */
  note?: string;
  /** Destructive action — ghost + error, per the button ladder. */
  danger?: boolean;
  /**
   * `destructive` rows only (D06): the sentence the confirm dialog states in its soft alert.
   */
  consequence?: string;
  /**
   * A fact rather than a setting: rendered read-only, with the reason in `desc`.
   */
  readOnly?: boolean;
  /**
   * apps/web reconcile: no persistence route exists for this control yet. Renders it read-only
   * (`text`) or disabled (`select` / `toggle`) so it shows the real/representative value without
   * claiming a save it cannot make.
   */
  gated?: boolean;
  /**
   * apps/web reconcile: a `link` row that navigates to a REAL route in the app rather than printing
   * a deferred-action note. Renders as an `<a href>`.
   */
  href?: string;
  /**
   * apps/web reconcile: a `button` row that performs a REAL client action. `'billing-portal'` posts
   * to `/api/billing/portal` and hands off to Stripe (settingsControls.ts).
   */
  action?: 'billing-portal';
  /**
   * `button` rows only: hand this row to an affordance that ALREADY exists elsewhere in the shell
   * instead of printing a deferred `note`. Today the one value is `create-space`, which stamps the
   * `data-create-space` attribute the sidebar's document-level delegate already listens for
   * (`AppShellSidebar.astro`), so the row opens the real `CreateSpaceModal`.
   *
   * A row with a `trigger` must not also carry a `note`: it is not deferred. (Audit S32-F1 / D17.)
   */
  trigger?: 'create-space';
}

export interface SettingsSection {
  title: string;
  help?: string;
  /**
   * Danger zone (D06): the card takes the error border the registry pages already use for their
   * Remove blocks, so "the part of this page that destroys things" looks the same everywhere.
   */
  danger?: boolean;
  rows: SettingsRow[];
}

export interface SettingsCategory {
  id: string;
  label: string;
  icon: string;
  scope: string;
  sections: SettingsSection[];
}

/** The subject of the page: who is signed in, and what they are signed in to. */
export interface SettingsSubject {
  user: { name: string; email: string; image?: string | null };
  org: { name: string; slug: string } | null;
  space: { id: string; name: string; autoAddFutureBases: boolean } | null;
}

/** Initials for the avatar, from the real name — same derivation the sidebar uses. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * The Space category — a function rather than a literal in `buildCategories`.
 *
 * A Space may not exist yet. Emitting the full category regardless showed a blank name field,
 * confident defaults, and a red **Delete Space** card for an object the user does not have
 * (audit S32-F1, S1). No Space → no editable rows and no destroy action. The category STAYS on
 * the rail (D08 forbids a named dead end) and its pane offers the one real exit: Create Space
 * via the sidebar's existing `[data-create-space]` delegate.
 */
function spaceCategory(space: SettingsSubject['space']): SettingsCategory {
  if (!space) {
    return {
      id: 'space',
      label: 'Space',
      icon: 'lucide--layers',
      scope: 'Per space',
      sections: [
        {
          title: 'No Space yet',
          help:
            'A Space binds one Airtable connection to a backup schedule, and everything on this page ' +
            'is a setting on that Space. Create one and these settings appear.',
          rows: [
            {
              id: 'space-create',
              label: 'Create a Space',
              desc: 'Pick the Airtable connection to back up and the bases inside it. You can change every default here afterwards.',
              control: 'button',
              cta: 'Create Space',
              trigger: 'create-space',
            },
          ],
        },
      ],
    };
  }

  return {
    id: 'space',
    label: 'Space',
    icon: 'lucide--layers',
    scope: 'Per space',
    sections: [
      {
        title: 'This Space',
        rows: [
            {
              id: 'space-name',
              label: 'Space name',
              desc: 'A Space is bound to one platform — currently Airtable.',
              control: 'text',
              value: space.name,
            },
            {
              id: 'space-autoadd',
              label: 'Auto-add new bases',
              desc: 'Back up bases that appear in the source after this Space was set up.',
              control: 'toggle',
              on: space.autoAddFutureBases,
            },
        ],
      },
      {
        title: 'Defaults',
        help: 'Starting points for new backups in this Space. Configured where each thing lives.',
        rows: [
          {
            id: 'space-schedule',
            label: 'Backup schedule',
            desc: 'How often data and schema are captured. Set on the Backups screen.',
            control: 'link',
            cta: 'Open Backups',
            href: '/backups',
          },
          {
            id: 'space-destination',
            label: 'Storage destination',
            desc: 'Where new backups are written. Managed under Destinations.',
            control: 'link',
            cta: 'Open Destinations',
            href: '/destinations',
          },
          {
            id: 'space-retention',
            label: 'Data retention',
            desc: 'How long a backup is kept before cleanup reclaims it.',
            control: 'link',
            cta: 'Edit retention',
            href: '/retention',
          },
        ],
      },
      {
        title: 'Danger zone',
        danger: true,
        rows: [
          {
            id: 'space-delete',
            label: 'Delete Space',
            desc: 'Deletes every backup this Space has taken, with its schedules and reports. This cannot be undone.',
            control: 'destructive',
            cta: 'Delete Space',
            danger: true,
            consequence:
              'Every backup this Space has taken is deleted from Baseout, along with its schedules, its reports and their run history. Your Airtable bases are not touched — but the copies that exist only here are the ones you would restore from, and after this there is nothing to restore. The source and destination connections stay in your account for other Spaces to use. There is no undo.',
            note: 'Deleting a Space isn’t available in-app yet — contact support. Nothing was deleted.',
          },
        ],
      },
    ],
  };
}

export function buildCategories(subject: SettingsSubject): SettingsCategory[] {
  const { user, org, space } = subject;

  return [
    {
      id: 'account',
      label: 'Account',
      icon: 'lucide--user',
      scope: 'Per user',
      sections: [
        {
          title: 'Profile',
          help: 'Your name and picture, as they appear on activity in this Organization.',
          rows: [
            {
              id: 'account-avatar',
              label: 'Profile picture',
              desc: 'Falls back to your initials when there is no image.',
              control: 'avatar',
              cta: 'Change photo',
              note: 'Avatar upload isn’t available yet — this marks the place the flow will land.',
            },
            {
              id: 'account-name',
              label: 'Name',
              desc: 'Shown on activity and in reports.',
              control: 'text',
              value: user.name,
            },
            {
              id: 'account-email',
              label: 'Email',
              desc: 'Baseout signs you in with a magic link, so there is no password. The address is the identity itself — changing it is a support request.',
              control: 'text',
              value: user.email,
              readOnly: true,
            },
          ],
        },
        {
          title: 'Sessions',
          help: 'Where your account is currently signed in.',
          rows: [
            {
              id: 'account-sessions',
              label: 'Signed-in devices',
              desc: 'Review the sessions that can reach your data.',
              control: 'link',
              cta: 'View sessions',
              note: 'A session list isn’t available yet.',
            },
            {
              id: 'account-signout-all',
              label: 'Sign out everywhere',
              desc: 'Ends every session except this one.',
              control: 'button',
              cta: 'Sign out everywhere',
              note: 'Signing out other sessions isn’t available yet.',
            },
          ],
        },
        {
          title: 'Danger zone',
          danger: true,
          rows: [
            {
              id: 'account-delete',
              label: 'Delete account',
              desc: 'Removes your user. Organization data is unaffected.',
              control: 'destructive',
              cta: 'Delete account',
              danger: true,
              consequence:
                'Your sign-in is removed and the magic link to this email stops working, so you lose access to every Organization you belong to. Organization data — Spaces, connections and backups — is not deleted; it stays with the Organization. There is no undo and no grace period: this is not a deactivation.',
              note: 'Account deletion isn’t available in-app yet — contact support to close your account. Nothing was deleted.',
            },
          ],
        },
      ],
    },
    /*
     * Security sits directly under Account. Its pane is a COMPONENT (SecurityPanel), not rows, and
     * only renders when the caller supplies 2FA state. apps/web has not wired that backend yet
     * (SecurityPanel deferred at the Auth promotion), so the view passes no `security` prop and shows
     * an honest "coming soon" note instead. `sections` is empty by design.
     */
    { id: 'security', label: 'Security', icon: 'lucide--shield-check', scope: 'Per user', sections: [] },
    {
      id: 'organization',
      label: 'Organization',
      icon: 'lucide--building-2',
      scope: 'Per org · admin',
      sections: [
        {
          title: 'Identity',
          rows: [
            {
              id: 'org-name',
              label: 'Organization name',
              desc: 'Appears in reports and invitations.',
              control: 'text',
              value: org?.name ?? '',
              gated: true,
            },
            {
              id: 'org-slug',
              label: 'Slug',
              desc: 'Used in URLs. Changing it breaks existing links.',
              control: 'text',
              value: org?.slug ?? '',
              gated: true,
            },
          ],
        },
        {
          title: 'Activity',
          help: 'A record of what has been changed in this Organization.',
          rows: [
            {
              id: 'org-audit',
              label: 'Audit log',
              desc: 'Org-level admin actions, retained per your plan.',
              control: 'link',
              cta: 'Open audit log',
              note: 'The org audit log isn’t surfaced in this app yet.',
            },
          ],
        },
      ],
    },
    spaceCategory(space),
    {
      id: 'billing',      label: 'Billing',
      icon: 'lucide--credit-card',
      scope: 'Per org · admin',
      sections: [
        {
          title: 'Plan',
          rows: [
            {
              id: 'billing-plan',
              label: 'Current plan',
              desc: 'What you are on, and what it includes.',
              control: 'button',
              cta: 'Change plan',
              action: 'billing-portal',
              note: 'Plan changes happen in the Stripe billing portal — Baseout never handles card or plan checkout here.',
            },
            {
              id: 'billing-usage',
              label: 'Usage this month',
              desc: 'Records, attachments and storage against your allowance.',
              control: 'link',
              cta: 'View usage',
              href: '/reports',
              note: 'In-app usage meters are not built yet — Reports is the interim surface until entitlements meters land.',
            },
          ],
        },
        {
          title: 'Payment',
          help: 'Card details are handled by Stripe — Baseout never sees them.',
          rows: [
            {
              id: 'billing-method',
              label: 'Payment method',
              desc: 'Opens the Stripe customer portal to manage your card, plan and invoices.',
              control: 'button',
              cta: 'Open portal',
              action: 'billing-portal',
            },
            {
              id: 'billing-email',
              label: 'Billing email',
              desc: 'Where invoices and receipts are sent. Change it in the Stripe portal — Baseout does not store a separate billing address.',
              control: 'button',
              cta: 'Manage in portal',
              action: 'billing-portal',
            },
            {
              id: 'billing-invoices',
              label: 'Invoices',
              desc: 'Every past receipt, downloadable from the Stripe portal.',
              control: 'button',
              cta: 'View invoices',
              action: 'billing-portal',
            },
          ],
        },
        {
          title: 'Limits',
          rows: [
            {
              id: 'billing-overage',
              label: 'Limit behaviour',
              desc: 'At 90% of a limit you get a warning and an add-on or upgrade offer; at 100% new work that would exceed the limit is blocked. There is no auto-billed overage toggle.',
              control: 'text',
              value: 'Warn at 90% · enforce at 100%',
              readOnly: true,
              note: 'Per the locked pricing model (warn @ 90% / enforce @ 100% + add-ons). Existing in-flight backups still finish.',
            },
          ],
        },
      ],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'lucide--bell',
      scope: 'Per user · per space',
      sections: [
        {
          title: 'Events',
          help: 'Which events are worth interrupting you for. Notification preferences aren’t saved yet — this previews what’s coming.',
          rows: [
            { id: 'notify-failed', label: 'Backup failed', desc: 'A run did not finish. The one alert most teams keep on.', control: 'toggle', on: true, gated: true },
            { id: 'notify-succeeded', label: 'Backup succeeded', desc: 'Every successful run. Noisy on a daily schedule.', control: 'toggle', on: false, gated: true },
            { id: 'notify-drift', label: 'Schema drift', desc: 'A field or table changed in a way that may break a restore.', control: 'toggle', on: true, gated: true },
            { id: 'notify-health', label: 'Health score drop', desc: 'A base fell below its previous score.', control: 'toggle', on: false, gated: true },
            { id: 'notify-overage', label: 'Overage warning', desc: 'You are approaching your plan allowance.', control: 'toggle', on: true, gated: true },
          ],
        },
        {
          title: 'Channels',
          help: 'Inbox already shows in-app events. Email and webhook delivery, and these toggles, are not saved yet.',
          rows: [
            { id: 'notify-email', label: 'Email', desc: 'Sent to your account address.', control: 'toggle', on: true, gated: true },
            { id: 'notify-inapp', label: 'In-app', desc: 'Appears in the Inbox.', control: 'toggle', on: true, gated: true },
            { id: 'notify-webhook', label: 'Webhook', desc: 'Posts to an endpoint you control.', control: 'toggle', on: false, gated: true },
          ],
        },
        {
          title: 'Quiet hours',
          rows: [
            {
              id: 'notify-quiet',
              label: 'Pause notifications',
              desc: 'Hold non-urgent alerts until the window ends. Failures still come through.',
              control: 'select',
              value: 'Off',
              options: ['Off', '22:00 – 07:00', '18:00 – 09:00', 'Weekends'],
              gated: true,
            },
          ],
        },
      ],
    },
    {
      id: 'developer',
      label: 'Developer',
      icon: 'lucide--terminal',
      scope: 'Per org · admin',
      // API tokens and AI keys render as REAL panels in the Developer pane (SettingsView) — wired to
      // the live `/api/tokens/*` and `/api/ai-keys` routes. The rows below are the not-yet-built
      // remainder, gated honestly.
      sections: [
        {
          title: 'Webhooks',
          rows: [
            {
              id: 'dev-secret',
              label: 'Webhook signing secret',
              desc: 'Verify that a webhook really came from Baseout.',
              control: 'button',
              cta: 'Reveal secret',
              note: 'Webhook signing secrets aren’t available in this app yet.',
            },
          ],
        },
        {
          title: 'Direct access',
          help: 'Available on Business plans and above.',
          rows: [
            {
              id: 'dev-sql',
              label: 'SQL connection details',
              desc: 'Query your backups directly, read-only.',
              control: 'link',
              cta: 'View details',
              note: 'The read-only SQL connection surface isn’t available in this app yet.',
            },
          ],
        },
      ],
    },
  ];
}

/**
 * The drill-down's address (catalog: `pattern-mobile-drilldown`).
 *
 * Below 1280 `/settings` is a LIST of the categories you enter, not a rail stacked above the pane it
 * swaps. `?tab=` (the same parameter the desktop rail writes) addresses the two states:
 *
 *   no `?tab=` (and no `?state=`)  →  LIST      · desktop still opens the default category
 *   `?tab=security`               →  SECTION   · back link = the same URL with `tab`/`state` removed
 *
 * Every other parameter is carried forward; only `state` is dropped when a tab is chosen.
 */
export interface SettingsLinks {
  /** True when the URL names a section — the narrow tier shows the pane instead of the list. */
  drilled: boolean;
  /** The list state: this URL with `tab` and `state` removed. */
  listHref: string;
  /** The href for one category row, preserving every unrelated query parameter. */
  tabHref: (id: string) => string;
}

export function buildSettingsLinks(url: URL): SettingsLinks {
  const withParams = (mutate: (p: URLSearchParams) => void): string => {
    const p = new URLSearchParams(url.searchParams);
    mutate(p);
    const q = p.toString();
    return q ? `${url.pathname}?${q}` : url.pathname;
  };
  return {
    drilled: url.searchParams.has('tab') || url.searchParams.has('state'),
    listHref: withParams((p) => {
      p.delete('tab');
      p.delete('state');
    }),
    tabHref: (id: string) =>
      withParams((p) => {
        p.delete('state');
        p.set('tab', id);
      }),
  };
}
