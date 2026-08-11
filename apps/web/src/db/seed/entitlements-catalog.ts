/**
 * Entitlement catalog seed data — the single source transcribed from the locked
 * pricing model (research/pricing/pricing-guide.md §3 + §6, version 2026-08-03).
 *
 * shared-entitlements task 1.3. This module is PURE DATA (no DB) so the fixture
 * test can guard it offline and the runner (seed-entitlements.ts) can upsert it
 * idempotently by slug. If a pricing edit lands, update this file AND bump
 * PRICING_GUIDE_VERSION; the fixture test fails if the two transcriptions drift.
 *
 * The admin catalog UI (admin-entitlements) is the durable editor — this seed
 * only bootstraps. The runner inserts-if-absent by slug, so re-running never
 * clobbers admin edits.
 */

import type { FeatureValueType, MeterKind, TypedValue } from '@baseout/db-schema'

export const PRICING_GUIDE_VERSION = '2026-08-03'

export const PLAN_SLUGS = ['lite', 'core', 'plus', 'max', 'trial', 'enterprise'] as const
export type PlanSlug = (typeof PLAN_SLUGS)[number]

// Enterprise sits on a conservative concrete baseline (= Max values) and receives
// its real contracted terms as per-account overrides via admin-entitlements (D10);
// "Custom" cells in the guide are realized per-contract, never seeded as sentinels.

export interface PlanSeed {
  slug: PlanSlug
  name: string
  kind: 'public' | 'trial' | 'custom'
  sortOrder: number
  // Cached amounts in cents; null = no fixed price (Enterprise custom / free trial handled separately).
  monthlyCents: number | null
  annualCents: number | null
}

export const PLANS: PlanSeed[] = [
  { slug: 'lite', name: 'Lite', kind: 'public', sortOrder: 1, monthlyCents: 4900, annualCents: 49900 },
  { slug: 'core', name: 'Core', kind: 'public', sortOrder: 2, monthlyCents: 9900, annualCents: 99900 },
  { slug: 'plus', name: 'Plus', kind: 'public', sortOrder: 3, monthlyCents: 19900, annualCents: 199900 },
  { slug: 'max', name: 'Max', kind: 'public', sortOrder: 4, monthlyCents: 39900, annualCents: 399900 },
  { slug: 'trial', name: 'Trial', kind: 'trial', sortOrder: 5, monthlyCents: 0, annualCents: null },
  { slug: 'enterprise', name: 'Enterprise', kind: 'custom', sortOrder: 6, monthlyCents: null, annualCents: null },
]

export interface FeatureGroupSeed {
  slug: string
  name: string
  sortOrder: number
}

export const FEATURE_GROUPS: FeatureGroupSeed[] = [
  { slug: 'backup', name: 'Backup', sortOrder: 1 },
  { slug: 'restore_retention', name: 'Restore & retention', sortOrder: 2 },
  { slug: 'data_access', name: 'Data access', sortOrder: 3 },
  { slug: 'ai_intelligence', name: 'AI & intelligence', sortOrder: 4 },
  { slug: 'collaboration', name: 'Collaboration', sortOrder: 5 },
  { slug: 'governance_security', name: 'Governance & security', sortOrder: 6 },
  { slug: 'support', name: 'Support', sortOrder: 7 },
]

// Ordered enum ladders (index = rank). Callers compare by rank, never by string (D3).
export const FREQUENCY_LADDER = ['one_time', 'monthly', 'weekly', 'daily', 'instant'] as const
export const DB_CLASS_LADDER = ['d1', 'shared_cluster', 'dedicated_cluster', 'byodb'] as const
export const DESTINATION_TYPE_LADDER = ['cloud_drives', 'cloud_drives_s3'] as const
export const SUPPORT_LADDER = ['email', 'priority_email', 'priority_chat', 'csm_sla'] as const

// ── Typed-value constructors ────────────────────────────────────────────────
const lim = (n: number | null): TypedValue => ({ type: 'limit', limit: n }) // null = fair use
const bool = (b: boolean): TypedValue => ({ type: 'boolean', bool: b })
const en = (s: string): TypedValue => ({ type: 'enum', enum: s })

type PlanValues = Record<PlanSlug, TypedValue>
// lite, core, plus, max, trial(=Lite here unless noted), enterprise(=Max baseline)
const row = (
  lite: TypedValue, core: TypedValue, plus: TypedValue, max: TypedValue,
  trial: TypedValue, enterprise: TypedValue,
): PlanValues => ({ lite, core, plus, max, trial, enterprise })
const allTrue = (): PlanValues => row(bool(true), bool(true), bool(true), bool(true), bool(true), bool(true))

export interface FeatureSeed {
  slug: string
  group: string
  name: string
  valueType: FeatureValueType
  unit?: string
  enumValues?: readonly string[]
  meterable?: boolean
  meterKind?: MeterKind
  sortOrder: number
  values: PlanValues
}

export const FEATURES: FeatureSeed[] = [
  // ── Meters ────────────────────────────────────────────────────────────────
  {
    slug: 'records_under_management', group: 'backup', name: 'Records under management',
    valueType: 'limit', unit: 'records', meterable: true, meterKind: 'stock', sortOrder: 10,
    values: row(lim(250_000), lim(750_000), lim(1_500_000), lim(5_000_000), lim(250_000), lim(5_000_000)),
  },
  {
    slug: 'file_storage_gb', group: 'data_access', name: 'File storage under management',
    valueType: 'limit', unit: 'gb', meterable: true, meterKind: 'stock', sortOrder: 20,
    values: row(lim(50), lim(250), lim(500), lim(1500), lim(50), lim(1500)),
  },
  {
    slug: 'ai_credits_monthly', group: 'ai_intelligence', name: 'AI credits per month',
    valueType: 'limit', unit: 'credits', meterable: true, meterKind: 'flow', sortOrder: 30,
    values: row(lim(200), lim(1000), lim(5000), lim(15000), lim(200), lim(15000)),
  },
  {
    slug: 'monthly_call_allowance', group: 'data_access', name: 'Monthly call allowance (API + MCP + Direct SQL)',
    valueType: 'limit', unit: 'calls', meterable: true, meterKind: 'flow', sortOrder: 40,
    values: row(lim(10_000), lim(50_000), lim(250_000), lim(1_000_000), lim(10_000), lim(1_000_000)),
  },
  {
    slug: 'database_size_gb', group: 'data_access', name: 'Database size (org-wide, record data)',
    valueType: 'limit', unit: 'gb', meterable: true, meterKind: 'stock', sortOrder: 50,
    values: row(lim(5), lim(10), lim(25), lim(50), lim(5), lim(50)),
  },

  // ── Structural gates ────────────────────────────────────────────────────────
  {
    slug: 'bases_under_management', group: 'backup', name: 'Bases under management',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 60,
    values: row(lim(15), lim(50), lim(150), lim(500), lim(15), lim(500)),
  },
  {
    slug: 'backup_frequency_max', group: 'backup', name: 'Backup frequency (max cadence)',
    valueType: 'enum', enumValues: FREQUENCY_LADDER, sortOrder: 70,
    values: row(en('monthly'), en('weekly'), en('daily'), en('instant'), en('one_time'), en('instant')),
  },
  {
    slug: 'manual_backups_monthly', group: 'backup', name: 'Manual (on-demand) backups per month',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'flow', sortOrder: 80,
    values: row(lim(1), lim(5), lim(10), lim(25), lim(1), lim(25)),
  },
  {
    slug: 'spaces', group: 'collaboration', name: 'Spaces',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 90,
    values: row(lim(3), lim(10), lim(25), lim(100), lim(3), lim(100)),
  },
  {
    slug: 'database_isolation_class', group: 'data_access', name: 'Database isolation class',
    valueType: 'enum', enumValues: DB_CLASS_LADDER, sortOrder: 100,
    values: row(en('d1'), en('shared_cluster'), en('dedicated_cluster'), en('byodb'), en('d1'), en('byodb')),
  },
  {
    slug: 'seats', group: 'collaboration', name: 'Seats',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 110,
    values: row(lim(1), lim(5), lim(10), lim(25), lim(1), lim(25)),
  },
  {
    slug: 'restores_monthly', group: 'restore_retention', name: 'Restores per month',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'flow', sortOrder: 120,
    // Max + Enterprise = fair use (null sentinel).
    values: row(lim(3), lim(10), lim(30), lim(null), lim(3), lim(null)),
  },
  {
    slug: 'schema_history_retention_days', group: 'restore_retention', name: 'Schema history retention',
    valueType: 'limit', unit: 'days', sortOrder: 130,
    values: row(lim(90), lim(180), lim(365), lim(1095), lim(90), lim(1095)),
  },
  {
    slug: 'record_history_retention_days', group: 'restore_retention', name: 'Record history retention',
    valueType: 'limit', unit: 'days', sortOrder: 140,
    values: row(lim(90), lim(180), lim(365), lim(1095), lim(90), lim(1095)),
  },
  {
    slug: 'snapshot_destinations_external', group: 'backup', name: 'Snapshot destinations (external)',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 150,
    values: row(lim(1), lim(2), lim(3), lim(5), lim(1), lim(5)),
  },
  {
    slug: 'snapshot_destination_types', group: 'backup', name: 'Snapshot destination types',
    valueType: 'enum', enumValues: DESTINATION_TYPE_LADDER, sortOrder: 160,
    values: row(en('cloud_drives'), en('cloud_drives'), en('cloud_drives_s3'), en('cloud_drives_s3'), en('cloud_drives'), en('cloud_drives_s3')),
  },
  {
    slug: 'active_reports', group: 'ai_intelligence', name: 'Active reports',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 170,
    values: row(lim(5), lim(25), lim(50), lim(100), lim(5), lim(100)),
  },
  {
    slug: 'documents', group: 'data_access', name: 'Documents',
    valueType: 'limit', unit: 'count', meterable: true, meterKind: 'creation', sortOrder: 180,
    values: row(lim(10), lim(25), lim(50), lim(100), lim(10), lim(100)),
  },

  // ── Feature gates ────────────────────────────────────────────────────────────
  {
    slug: 'byo_ai_key', group: 'ai_intelligence', name: 'Bring your own AI key',
    valueType: 'boolean', sortOrder: 190,
    values: row(bool(false), bool(false), bool(true), bool(true), bool(false), bool(true)),
  },
  {
    slug: 'audit_logs', group: 'governance_security', name: 'Audit logs',
    valueType: 'boolean', sortOrder: 200,
    values: row(bool(false), bool(false), bool(false), bool(true), bool(false), bool(true)),
  },
  { slug: 'internal_snapshots', group: 'backup', name: 'Internal snapshots', valueType: 'boolean', sortOrder: 210, values: allTrue() },
  { slug: 'mcp_access', group: 'data_access', name: 'MCP access', valueType: 'boolean', sortOrder: 220, values: allTrue() },
  { slug: 'automations_interfaces_backup', group: 'backup', name: 'Automations & interfaces backup', valueType: 'boolean', sortOrder: 230, values: allTrue() },
  { slug: 'comments_backup', group: 'backup', name: 'Comments backup', valueType: 'boolean', sortOrder: 240, values: allTrue() },
  { slug: 'api_access', group: 'data_access', name: 'API access', valueType: 'boolean', sortOrder: 250, values: allTrue() },
  { slug: 'sso_saml', group: 'governance_security', name: 'SSO / SAML', valueType: 'boolean', sortOrder: 260, values: allTrue() },
  { slug: 'pii_detection', group: 'governance_security', name: 'PII detection', valueType: 'boolean', sortOrder: 270, values: allTrue() },
  { slug: 'direct_sql_access', group: 'governance_security', name: 'Direct SQL access', valueType: 'boolean', sortOrder: 280, values: allTrue() },
  {
    slug: 'support_level', group: 'support', name: 'Support',
    valueType: 'enum', enumValues: SUPPORT_LADDER, sortOrder: 290,
    values: row(en('email'), en('priority_email'), en('priority_email'), en('priority_chat'), en('email'), en('csm_sla')),
  },
]

export interface AddonSeed {
  slug: string
  name: string
  featureSlug: string
  unitQuantity: number
  kind: 'recurring' | 'one_time'
  priceCents: number
}

// pricing-guide §6 — flat, identical at every tier. Recurring $10/mo; one-time packs $12.
export const ADDONS: AddonSeed[] = [
  { slug: 'records_100k', name: '+100K records', featureSlug: 'records_under_management', unitQuantity: 100_000, kind: 'recurring', priceCents: 1000 },
  { slug: 'file_storage_50gb', name: '+50 GB file storage', featureSlug: 'file_storage_gb', unitQuantity: 50, kind: 'recurring', priceCents: 1000 },
  { slug: 'database_size_2gb', name: '+2 GB database size', featureSlug: 'database_size_gb', unitQuantity: 2, kind: 'recurring', priceCents: 1000 },
  { slug: 'bases_3', name: '+3 bases', featureSlug: 'bases_under_management', unitQuantity: 3, kind: 'recurring', priceCents: 1000 },
  { slug: 'spaces_1', name: '+1 Space', featureSlug: 'spaces', unitQuantity: 1, kind: 'recurring', priceCents: 1000 },
  { slug: 'seats_2', name: '+2 seats', featureSlug: 'seats', unitQuantity: 2, kind: 'recurring', priceCents: 1000 },
  { slug: 'destinations_1', name: '+1 external destination', featureSlug: 'snapshot_destinations_external', unitQuantity: 1, kind: 'recurring', priceCents: 1000 },
  { slug: 'reports_5', name: '+5 reports', featureSlug: 'active_reports', unitQuantity: 5, kind: 'recurring', priceCents: 1000 },
  { slug: 'documents_10', name: '+10 documents', featureSlug: 'documents', unitQuantity: 10, kind: 'recurring', priceCents: 1000 },
  { slug: 'ai_credits_1000', name: '+1,000 AI credits/mo', featureSlug: 'ai_credits_monthly', unitQuantity: 1000, kind: 'recurring', priceCents: 1000 },
  { slug: 'calls_50k', name: '+50K calls/mo', featureSlug: 'monthly_call_allowance', unitQuantity: 50_000, kind: 'recurring', priceCents: 1000 },
  { slug: 'restores_3', name: '+3 restores/mo', featureSlug: 'restores_monthly', unitQuantity: 3, kind: 'recurring', priceCents: 1000 },
  // One-time packs (this cycle only; $12).
  { slug: 'ai_credits_1000_pack', name: '+1,000 AI credits (one-time)', featureSlug: 'ai_credits_monthly', unitQuantity: 1000, kind: 'one_time', priceCents: 1200 },
  { slug: 'calls_50k_pack', name: '+50K calls (one-time)', featureSlug: 'monthly_call_allowance', unitQuantity: 50_000, kind: 'one_time', priceCents: 1200 },
  { slug: 'restores_3_pack', name: '+3 restores (one-time)', featureSlug: 'restores_monthly', unitQuantity: 3, kind: 'one_time', priceCents: 1200 },
]
