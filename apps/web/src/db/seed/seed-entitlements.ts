/**
 * Entitlement catalog seed runner — shared-entitlements task 1.3.
 *
 * Idempotent: every insert is insert-if-absent by its natural key (slug, or
 * plan×feature / plan×period). Re-running never clobbers admin-entitlements
 * edits — the admin catalog UI is the durable editor; this only bootstraps.
 *
 * `buildPlanFeatureRows()` is pure (typed-value → storage columns) so the
 * encoding is unit-tested without a DB; `seedEntitlements(db)` applies the whole
 * catalog. Run via `pnpm --filter @baseout/web db:seed:entitlements` (needs the
 * 0034 migration applied).
 */

import { toValueColumns } from '@baseout/db-schema'
import {
  addonCatalog,
  featureGroups,
  features,
  planFeatures,
  planPrices,
  plans,
} from '../schema'
import {
  ADDONS,
  FEATURES,
  FEATURE_GROUPS,
  PLANS,
  PLAN_SLUGS,
  type PlanSlug,
} from './entitlements-catalog'

export interface PlanFeatureRow {
  planSlug: PlanSlug
  featureSlug: string
  valueBool: boolean | null
  valueNumeric: number | null
  valueEnum: string | null
}

/** Pure: expand the FEATURES × plans matrix into typed storage-column rows. */
export function buildPlanFeatureRows(): PlanFeatureRow[] {
  const rows: PlanFeatureRow[] = []
  for (const f of FEATURES) {
    for (const planSlug of PLAN_SLUGS) {
      const cols = toValueColumns(f.values[planSlug])
      rows.push({
        planSlug,
        featureSlug: f.slug,
        valueBool: cols.valueBool,
        valueNumeric: typeof cols.valueNumeric === 'number' ? cols.valueNumeric : null,
        valueEnum: cols.valueEnum,
      })
    }
  }
  return rows
}

// Minimal structural client so the applier stays decoupled from the concrete
// Drizzle instance — the node singleton, a per-request client, and the test fake
// all satisfy it. `any` in the argument positions is intentional: this is a
// decoupling shim, and it keeps the real Drizzle builders assignable without a
// cast (their args are invariant table objects; their results are PromiseLike).
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = {
  insert: (table: any) => {
    values: (v: any) => { onConflictDoNothing: (cfg?: any) => PromiseLike<unknown> }
  }
  select: (cols: any) => { from: (table: any) => PromiseLike<Array<Record<string, string>>> }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Apply the full catalog idempotently. Safe to re-run. */
export async function seedEntitlements(db: Db): Promise<void> {
  for (const g of FEATURE_GROUPS) {
    await db
      .insert(featureGroups)
      .values({ slug: g.slug, name: g.name, sortOrder: g.sortOrder })
      .onConflictDoNothing({ target: featureGroups.slug })
  }

  const groupId = idBySlug(
    await db.select({ id: featureGroups.id, slug: featureGroups.slug }).from(featureGroups),
  )

  for (const f of FEATURES) {
    await db
      .insert(features)
      .values({
        groupId: groupId.get(f.group)!,
        slug: f.slug,
        name: f.name,
        valueType: f.valueType,
        unit: f.unit ?? null,
        enumValues: f.enumValues ? [...f.enumValues] : null,
        meterable: f.meterable ?? false,
        meterKind: f.meterKind ?? null,
        sortOrder: f.sortOrder,
      })
      .onConflictDoNothing({ target: features.slug })
  }

  for (const p of PLANS) {
    await db
      .insert(plans)
      .values({ slug: p.slug, name: p.name, kind: p.kind, sortOrder: p.sortOrder })
      .onConflictDoNothing({ target: plans.slug })
  }

  const planId = idBySlug(await db.select({ id: plans.id, slug: plans.slug }).from(plans))
  const featureId = idBySlug(await db.select({ id: features.id, slug: features.slug }).from(features))

  for (const p of PLANS) {
    for (const [period, cents] of [
      ['monthly', p.monthlyCents],
      ['annual', p.annualCents],
    ] as const) {
      if (cents === null) continue
      await db
        .insert(planPrices)
        .values({ planId: planId.get(p.slug)!, billingPeriod: period, amountCents: cents })
        .onConflictDoNothing()
    }
  }

  for (const r of buildPlanFeatureRows()) {
    await db
      .insert(planFeatures)
      .values({
        planId: planId.get(r.planSlug)!,
        featureId: featureId.get(r.featureSlug)!,
        valueBool: r.valueBool,
        // Drizzle numeric takes a string; null stays null (fair-use sentinel).
        valueNumeric: r.valueNumeric === null ? null : String(r.valueNumeric),
        valueEnum: r.valueEnum,
      })
      .onConflictDoNothing()
  }

  for (const a of ADDONS) {
    await db
      .insert(addonCatalog)
      .values({
        slug: a.slug,
        name: a.name,
        featureSlug: a.featureSlug,
        unitQuantity: String(a.unitQuantity),
        kind: a.kind,
        priceCents: a.priceCents,
      })
      .onConflictDoNothing({ target: addonCatalog.slug })
  }
}

function idBySlug(rows: Array<Record<string, string>>): Map<string, string> {
  return new Map(rows.map((r) => [r.slug, r.id]))
}
