import type { AppDb } from '../../db'
import { reportDefinitions } from '../../db/schema'

/**
 * A Drizzle executor: either the request-scoped db or a transaction handle.
 * The default-report insert runs inside the Space-creation transaction, so it
 * must accept the `tx` the transaction callback receives.
 */
type DbExecutor = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0]

/**
 * The default report covers every section. Empty or new-capture sections
 * (trends / dataHealth) render a clean state rather than being omitted — see
 * openspec/changes/server-reports/design.md.
 */
export const DEFAULT_REPORT_SECTIONS = [
  'backups',
  'connections',
  'schema',
  'docs',
  'trends',
  'dataHealth',
] as const

/** The auto-created default report's name for a Space. */
export function defaultReportName(spaceName: string): string {
  return `Full ${spaceName} Report`
}

/**
 * Insert the non-deletable default "Full <Space> Report" for a Space. Called in
 * the same transaction as Space creation (createSpaceForOrg + onboarding
 * complete) so every Space has exactly one default. Idempotent: the partial-
 * unique (space_id) WHERE is_default index plus `onConflictDoNothing` mean a
 * repeated create can't error or duplicate.
 */
export async function insertDefaultReport(
  db: DbExecutor,
  input: { spaceId: string; spaceName: string },
): Promise<void> {
  await db
    .insert(reportDefinitions)
    .values({
      spaceId: input.spaceId,
      name: defaultReportName(input.spaceName),
      sections: [...DEFAULT_REPORT_SECTIONS],
      windowKind: 'since_last',
      isDefault: true,
    })
    .onConflictDoNothing()
}
