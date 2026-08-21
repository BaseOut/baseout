/**
 * The default Records preset shown when the Space has no saved views yet.
 * It is a system preset — not a user Draft.
 */
export function defaultRecordsPreset(tableId: string): {
  id: string
  name: string
  tableId: string
  pinned: boolean
  temporary: boolean
  saved: boolean
} {
  return {
    id: 'v0',
    name: 'All records',
    tableId,
    pinned: false,
    temporary: false,
    saved: true,
  }
}
