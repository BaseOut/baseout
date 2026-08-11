/**
 * Derive the /backups destination indicator from the Space's backup policy.
 *
 * Dev/local is the default destination right now: `local_fs` is the explicit
 * dev writer and `r2_managed` is parked (the workflows task routes it to the
 * local-disk LocalFsWriter), so both — and a Space with no config yet — display
 * as "Dev backups (local disk)" and never need setup.
 *
 * A cloud (BYOS) storageType is "set up" only when a matching storage_destinations
 * row exists for the Space; otherwise the page prompts the user to set it up.
 */

import type { StorageDestinationSummary } from '../../stores/connections'

export interface DestinationDisplay {
  /** Human label for where backups currently go. */
  label: string
  /** True when the chosen destination is a cloud provider not yet connected. */
  needsSetup: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  box: 'Box',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
}

const DEV_LOCAL_LABEL = 'Dev backups (local disk)'

/**
 * True when backups go to the dev local-disk writer. `local_fs` is the explicit
 * dev destination; `r2_managed` is parked and routes there too; a Space with no
 * config yet defaults to local. These need no setup and have no cloud account.
 */
export function isLocalDestination(
  storageType: string | null | undefined,
): boolean {
  return !storageType || storageType === 'local_fs' || storageType === 'r2_managed'
}

export function describeDestination(
  storageType: string | null | undefined,
  destination: StorageDestinationSummary | null,
): DestinationDisplay {
  if (isLocalDestination(storageType)) {
    return { label: DEV_LOCAL_LABEL, needsSetup: false }
  }

  // isLocalDestination returned false, so storageType is a non-empty cloud slug.
  const cloudType = storageType as string
  const provider = PROVIDER_LABELS[cloudType] ?? cloudType
  const connected = destination?.type === cloudType
  if (!connected) {
    return { label: provider, needsSetup: true }
  }
  const label = destination?.accountEmail
    ? `${provider} (${destination.accountEmail})`
    : provider
  return { label, needsSetup: false }
}
