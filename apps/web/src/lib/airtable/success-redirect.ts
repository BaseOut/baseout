/**
 * Post-OAuth-success redirect decision (integrations redesign).
 *
 * A first-time connect — the Space has no backup configuration yet — lands
 * straight in Configure setup (`?first=1`), matching the design flow where
 * Connect hands off to setup rather than the overview. Returning users
 * (reconnects, extra connections) keep the original behavior: back to the
 * page they started from with the `?connected=1` toast.
 */

export function appendQuery(path: string, key: string, value: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${key}=${encodeURIComponent(value)}`
}

export function resolveSuccessRedirect(opts: {
  returnTo: string
  hasBackupConfig: boolean
}): string {
  if (!opts.hasBackupConfig) return '/integrations/configure?first=1'
  return appendQuery(opts.returnTo, 'connected', '1')
}
