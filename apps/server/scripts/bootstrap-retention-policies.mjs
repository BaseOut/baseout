#!/usr/bin/env node
// Bootstrap script — INSERT a default retention policy row for every Space.
//
// Phase C.4 of openspec/changes/server-retention-and-cleanup. The cleanup pass
// falls back to the tier default when a Space has no backup_retention_policies
// row, so the engine works without this script; but seeding explicit rows gives
// the (deferred) settings UI something to load and makes the persisted state
// auditable. Idempotent — ON CONFLICT (space_id) DO NOTHING, so re-running never
// clobbers a user-customised policy.
//
// The per-tier default map below MIRRORS apps/server/src/lib/retention/
// policy-defaults.ts (getDefaultPolicy), which is unit-tested. Plain .mjs can't
// import the TS module, so the table is duplicated here intentionally; keep the
// two in sync.
//
// Invoked via:
//   node --env-file-if-exists=.env scripts/bootstrap-retention-policies.mjs
//
// Required env:
//   DATABASE_URL — master DB connection string

import postgres from "postgres";

// tier → default policy values. `null` tier (no active/trialing subscription)
// inherits 'starter' per Features §5.5.4.
const DEFAULTS = {
  starter: { policyTier: "basic", keepLastN: 10 },
  launch: { policyTier: "time_based", dailyWindowDays: 30 },
  growth: { policyTier: "two_tier", dailyWindowDays: 30, weeklyWindowDays: 120 },
  pro: {
    policyTier: "three_tier",
    dailyWindowDays: 30,
    weeklyWindowDays: 120,
    monthlyIndefinite: true,
  },
  business: { policyTier: "custom" },
  enterprise: { policyTier: "custom" },
};

function defaultsFor(tier) {
  return DEFAULTS[tier] ?? DEFAULTS.starter;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("bootstrap-retention-policies: DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { onnotice: () => {} });

  try {
    // Resolve each Space's tier the same way resolveCapabilities does: the
    // org's active/trialing Airtable subscription_items.tier (NULL → starter).
    const rows = await sql`
      SELECT s.id AS space_id, si.tier AS tier
      FROM baseout.spaces s
      LEFT JOIN LATERAL (
        SELECT si.tier
        FROM baseout.subscription_items si
        JOIN baseout.subscriptions sub ON sub.id = si.subscription_id
        JOIN baseout.platforms p ON p.id = si.platform_id
        WHERE sub.organization_id = s.organization_id
          AND p.slug = 'airtable'
          AND sub.status IN ('active', 'trialing')
        LIMIT 1
      ) si ON TRUE
      ORDER BY s.id ASC
    `;

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const p = defaultsFor(row.tier);
      const res = await sql`
        INSERT INTO baseout.backup_retention_policies
          (space_id, policy_tier, keep_last_n, daily_window_days,
           weekly_window_days, monthly_indefinite, custom_rules)
        VALUES (
          ${row.space_id}, ${p.policyTier}, ${p.keepLastN ?? null},
          ${p.dailyWindowDays ?? null}, ${p.weeklyWindowDays ?? null},
          ${p.monthlyIndefinite ?? false}, ${null}
        )
        ON CONFLICT (space_id) DO NOTHING
        RETURNING id
      `;
      if (res.length > 0) inserted += 1;
      else skipped += 1;
    }

    // eslint-disable-next-line no-console -- bootstrap script: stdout is the product
    console.log(
      JSON.stringify({
        event: "bootstrap_retention_policies_done",
        considered: rows.length,
        inserted,
        skipped,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      event: "bootstrap_retention_policies_fatal",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
