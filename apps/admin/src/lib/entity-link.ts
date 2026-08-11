// Single route authority for admin entity links (admin-entity-linking D3).
// Supersedes the interim entityHref in ui.ts (which fell back space/user to the
// owning org until these detail routes existed). Org/space/user have [id] pages;
// connections + restore-runs have no detail page, so they anchor into their list
// page (`/connections#<id>` etc.) — the list rows carry matching `id=` anchors.

export type EntityType = 'org' | 'space' | 'user' | 'connection' | 'backup_run' | 'restore_run'

export function entityHref(type: EntityType, id: string): string {
  switch (type) {
    case 'org':
      return `/organizations/${id}`
    case 'space':
      return `/spaces/${id}`
    case 'user':
      return `/users/${id}`
    case 'backup_run':
      return `/backups/${id}`
    case 'connection':
      return `/connections#${id}`
    case 'restore_run':
      return `/restores#${id}`
  }
}

/** Peek types that have a summary endpoint (subset of EntityType). */
export const PEEKABLE: readonly EntityType[] = ['org', 'space', 'user', 'connection', 'backup_run']
export function isPeekable(type: EntityType): boolean {
  return PEEKABLE.includes(type)
}
