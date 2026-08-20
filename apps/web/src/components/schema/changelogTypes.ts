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
  config: { label: 'Config changed', badge: 'badge-ghost', icon: 'lucide--sliders-horizontal' },
  // NOTE: there is deliberately no `view` CHANGE TYPE. "View" is an entity KIND
  // (ChangelogEntry.entityKind), not a kind of change — a view is added / renamed / removed /
  // type-changed like anything else. The old `view` entry made the Change-type filter list a
  // noun among verbs, and it collided with the entityKind of the same name.
  // Airtable exposes no view filters/sorts/grouping to any API, so there is also no
  // `config-changed` event for views: it would have no observable input.
};

/**
 * D43 — the row badge read `CHANGE_TYPE[e.type].badge` with NO fallback. The map is a closed set of
 * five, the feed’s `type` is an open string, and every other value in this app’s history has turned
 * out to be open in the end. An unmapped type therefore did not degrade: it dereferenced
 * `undefined` inside the template and returned HTTP 500 with an empty body on `/schema` — the exact
 * failure mode `pnpm smoke` exists to catch, and one no static gate can see.
 *
 * The fallback is a NEW neutral entry, never an alias onto one of the five. Each of those is a
 * VERB — a claim that Baseout knows what happened to the user’s schema — so borrowing one would
 * invent a claim. `badge-ghost` is the neutral that works (17.40:1 dark / 16.29:1 light); the
 * banned `badge-soft badge-neutral` is 1.34:1 and would have made the word unreadable anyway.
 */
export const CHANGE_TYPE_UNKNOWN = { label: 'Unknown', badge: 'badge-ghost', icon: 'lucide--circle-help' };

/** Always read the map through this — it is the only access that cannot 500 on an open enum. */
export const changeType = (t: string) => CHANGE_TYPE[t] ?? CHANGE_TYPE_UNKNOWN;
