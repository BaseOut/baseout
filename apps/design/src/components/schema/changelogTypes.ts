/**
 * Change-type presentation (label · soft-semantic badge · Lucide icon) for the Schema changelog.
 * ONE source of truth for BOTH the server-rendered feed rows (frontmatter) and the client drill render
 * (`<script>`) — these two maps had been hand-duplicated and drifted (a type once went missing client-side).
 */
export const CHANGE_TYPE: Record<string, { label: string; badge: string; icon: string }> = {
  added: { label: 'Added', badge: 'badge-soft badge-success', icon: 'lucide--plus' },
  removed: { label: 'Removed', badge: 'badge-soft badge-error', icon: 'lucide--minus' },
  renamed: { label: 'Renamed', badge: 'badge-soft badge-primary', icon: 'lucide--pencil-line' },
  typed: { label: 'Type changed', badge: 'badge-soft badge-warning', icon: 'lucide--replace' },
  config: { label: 'Config changed', badge: 'badge-soft badge-info', icon: 'lucide--sliders-horizontal' },
  // NOTE: there is deliberately no `view` CHANGE TYPE. "View" is an entity KIND
  // (ChangelogEntry.entityKind), not a kind of change — a view is added / renamed / removed /
  // type-changed like anything else. The old `view` entry made the Change-type filter list a
  // noun among verbs, and it collided with the entityKind of the same name.
  // Airtable exposes no view filters/sorts/grouping to any API, so there is also no
  // `config-changed` event for views: it would have no observable input.
};
