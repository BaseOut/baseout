-- ============================================================================
-- On2Air Backups — Usage Extraction Queries for Baseout Pricing Analysis
-- Target: PostgreSQL
-- Purpose: per-account usage distributions by tier (records, attachments,
--          storage, bases, frequency, restores) + cost-model inputs
--          (initial-sync spike, monthly processing volume).
--
-- HOW TO RUN:
--   Run each query separately and export its result set as CSV, named with
--   the query number (q00a.csv, q01.csv, ...). All output is aggregated or
--   keyed by internal integer account id — no names/emails/content.
--
-- CONFIRMED from q00a discovery (2026-07-29):
--   app = 'backups', type = 'single' identifies Backups plan subscriptions
--   (type = 'addon' rows are small/medium/large add-on packs — counted apart).
--   Active statuses: 'active'. Churned: BOTH 'canceled' AND 'cancelled'
--   spellings exist, plus 'incomplete_expired'.
--   Tiers: trial, free, starter, essentials, professional, premium.
-- CONFIRMED from q00c/q00d: schedule path = {schedule,interval,value}
--   (values: once, weekly, daily, monthly, hourly, empty). No ADJUST left.
-- CONFIRMED from q00f: stored attachments = upload_status='uploaded' AND
--   removed_at IS NULL (~12.6M files, ~20.1 TB). 'ready' (~3.3M, ~4.6 TB) is
--   tracked-but-not-uploaded — reported separately as pending_gb.
-- CONFIRMED from q00e: backups_history.metrics carries per-run totals AND
--   delta_* incrementals → q04c uses them for monthly processed volume.
-- q00g came back empty: restore metrics jsonb is unused; restore analysis
--   relies on row counts only (q05).
-- ============================================================================


-- ============================================================================
-- SECTION 0 — DISCOVERY (run these first, send results back)
-- ============================================================================

-- q00a: subscription landscape — what apps/tiers/statuses exist and counts
SELECT app, platform, "type", status, tier, count(*) AS subs,
       count(DISTINCT account) AS accounts
FROM account_subscriptions
GROUP BY 1, 2, 3, 4, 5
ORDER BY accounts DESC;

-- q00b: backup job status/paused landscape
SELECT status, paused, count(*) AS jobs, count(DISTINCT account) AS accounts
FROM backups
GROUP BY 1, 2
ORDER BY jobs DESC;

-- q00c: top-level keys in backups.config (find schedule + destination struct)
SELECT k AS config_key, count(*) AS jobs
FROM backups, LATERAL jsonb_object_keys(config) AS k
WHERE config IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;

-- q00d: schedule interval values (assumes audit-style path; adjust if q00c
-- shows a different structure)
SELECT config #>> '{schedule,interval,value}' AS interval, count(*) AS jobs
FROM backups
WHERE config IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;

-- q00e: keys in backups_history.metrics (what per-run metrics exist)
SELECT k AS metrics_key, count(*) AS runs
FROM backups_history, LATERAL jsonb_object_keys(metrics) AS k
WHERE metrics IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;

-- q00f: attachment status/upload_status landscape (which states = "stored")
SELECT status, upload_status,
       (removed_at IS NOT NULL) AS removed,
       count(*) AS atts,
       round(sum("size") / 1e9::numeric, 2) AS total_gb
FROM backups_attachments
GROUP BY 1, 2, 3
ORDER BY atts DESC;

-- q00g: keys in backups_restore.metrics + restore_table.metrics
SELECT 'restore' AS src, k AS metrics_key, count(*) AS rows_with_key
FROM backups_restore, LATERAL jsonb_object_keys(metrics) AS k
WHERE metrics IS NOT NULL
GROUP BY 1, 2
UNION ALL
SELECT 'restore_table', k, count(*)
FROM backups_restore_table, LATERAL jsonb_object_keys(metrics) AS k
WHERE metrics IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, 3 DESC;

-- q00h: backup format distribution (CSV vs other)
SELECT config #>> '{backup_format,value}' AS format, count(*) AS bases
FROM backups_bases
GROUP BY 1
ORDER BY 2 DESC;

-- q00i: structure of backups.config->'storage' (q00c showed 2,763 jobs have
-- it — likely the storage DESTINATION; this may answer internal-vs-external
-- without needing the connections table)
SELECT k AS storage_key, count(*) AS jobs
FROM backups, LATERAL jsonb_object_keys(config -> 'storage') AS k
WHERE jsonb_typeof(config -> 'storage') = 'object'
GROUP BY 1
ORDER BY 2 DESC;

-- q00j: storage destination values (catch-all over likely paths; refine
-- after q00i reveals the actual key names)
SELECT coalesce(config #>> '{storage,provider,value}',
                config #>> '{storage,provider}',
                config #>> '{storage,type,value}',
                config #>> '{storage,type}',
                config #>> '{storage,service}') AS provider,
       count(*) AS jobs,
       count(DISTINCT account) AS accounts
FROM backups
WHERE config -> 'storage' IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;


-- ============================================================================
-- SECTION 1 — PER-ACCOUNT USAGE ROLLUP (the core dataset)
-- One row per account with subscription tier + all usage levers.
-- ============================================================================

-- q01: per-account rollup
WITH sub AS (
    -- latest Backups subscription per account
    SELECT DISTINCT ON (account)
           account, tier, "type" AS billing_type, status AS sub_status
    FROM account_subscriptions
    WHERE app = 'backups' AND "type" = 'single'
    ORDER BY account, updated_at DESC NULLS LAST, id DESC
),
jobs AS (
    SELECT account,
           count(*)                                           AS backup_jobs,
           count(*) FILTER (WHERE status = 'active'
                              AND NOT paused)                 AS active_jobs,
           max(last_ran)                                      AS last_backup_ran
    FROM backups
    GROUP BY account
),
bases AS (
    SELECT account,
           count(*)                                           AS base_configs,
           count(DISTINCT at_id)                              AS distinct_bases,
           round(sum(meta_file_size) / 1e9::numeric, 3)       AS base_meta_gb
    FROM backups_bases
    GROUP BY account
),
tbls AS (
    SELECT account,
           count(*)                                           AS table_configs,
           sum(records)                                       AS records,
           sum("comments")                                    AS comments,
           sum(fields)                                        AS fields,
           sum(atts)                                          AS att_refs,
           round(sum(file_size) / 1e9::numeric, 3)            AS data_gb
    FROM backups_tables
    GROUP BY account
),
atts AS (
    SELECT account,
           count(*)                                           AS attachments,
           count(*) FILTER (WHERE upload_status = 'uploaded'
                              AND removed_at IS NULL)         AS stored_attachments,
           round(sum("size") FILTER (WHERE upload_status = 'uploaded'
                              AND removed_at IS NULL)
                 / 1e9::numeric, 3)                           AS stored_gb,
           round(sum("size") FILTER (WHERE upload_status = 'ready'
                              AND removed_at IS NULL)
                 / 1e9::numeric, 3)                           AS pending_gb
    FROM backups_attachments
    GROUP BY account
),
rst AS (
    SELECT account,
           count(*)                                           AS restores_all_time,
           count(*) FILTER (WHERE created_at >= now()
                                 - interval '12 months')      AS restores_12mo
    FROM backups_restore
    GROUP BY account
)
SELECT
    s.account, s.tier, s.billing_type, s.sub_status,
    coalesce(j.backup_jobs, 0)        AS backup_jobs,
    coalesce(j.active_jobs, 0)        AS active_jobs,
    j.last_backup_ran,
    coalesce(b.base_configs, 0)       AS base_configs,
    coalesce(b.distinct_bases, 0)     AS distinct_bases,
    coalesce(t.table_configs, 0)      AS table_configs,
    coalesce(t.records, 0)            AS records,
    coalesce(t.comments, 0)           AS comments,
    coalesce(t.fields, 0)             AS fields,
    coalesce(t.att_refs, 0)           AS att_refs,
    coalesce(t.data_gb, 0)            AS data_gb,
    coalesce(a.attachments, 0)        AS attachments,
    coalesce(a.stored_attachments, 0) AS stored_attachments,
    coalesce(a.stored_gb, 0)          AS stored_gb,
    coalesce(a.pending_gb, 0)         AS pending_gb,
    coalesce(r.restores_all_time, 0)  AS restores_all_time,
    coalesce(r.restores_12mo, 0)      AS restores_12mo
FROM sub s
LEFT JOIN jobs  j ON j.account = s.account
LEFT JOIN bases b ON b.account = s.account
LEFT JOIN tbls  t ON t.account = s.account
LEFT JOIN atts  a ON a.account = s.account
LEFT JOIN rst   r ON r.account = s.account
ORDER BY s.tier, records DESC NULLS LAST;

-- q01b: usage that exists WITHOUT a matching subscription row (sanity check —
-- catches free/legacy/internal accounts that would otherwise skew nothing
-- but should be understood)
SELECT bt.account,
       sum(bt.records) AS records,
       round(sum(bt.file_size) / 1e9::numeric, 3) AS data_gb
FROM backups_tables bt
WHERE NOT EXISTS (
    SELECT 1 FROM account_subscriptions s
    WHERE s.account = bt.account
      AND s.app = 'backups' AND s."type" = 'single'
)
GROUP BY bt.account
ORDER BY records DESC
LIMIT 100;


-- ============================================================================
-- SECTION 2 — DISTRIBUTIONS BY TIER (percentiles per lever)
-- Same rollup, aggregated — this is the headline table for setting limits.
-- ============================================================================

-- q02: SUPERSEDED — do not run. The original correlated-subquery version
-- re-scanned backups_attachments per account (pathologically slow). The
-- percentile distributions are computed offline from the full q01 export
-- instead (same per-account values, active-only filter applied in analysis).


-- ============================================================================
-- SECTION 3 — BACKUP FREQUENCY BY TIER
-- ============================================================================

-- q03: schedule interval × tier (informs frequency-gate placement)
WITH sub AS (
    SELECT DISTINCT ON (account) account, tier
    FROM account_subscriptions
    WHERE app = 'backups' AND "type" = 'single'
    ORDER BY account, updated_at DESC NULLS LAST, id DESC
)
SELECT s.tier,
       b.config #>> '{schedule,interval,value}' AS interval,   -- [ADJUST-2]
       count(*) AS jobs,
       count(DISTINCT b.account) AS accounts
FROM backups b
JOIN sub s ON s.account = b.account
WHERE b.status = 'active' AND NOT b.paused
GROUP BY 1, 2
ORDER BY 1, 3 DESC;


-- ============================================================================
-- SECTION 4 — RUN ACTIVITY & PROCESSING VOLUME (cost-model inputs)
-- ============================================================================

-- q04a: backup runs per month, last 12 months (system-wide compute load)
SELECT date_trunc('month', ran)::date AS month,
       count(*) AS runs,
       count(DISTINCT account) AS active_accounts,
       round(avg(EXTRACT(epoch FROM (completed_at - ran)))) AS avg_run_secs,
       percentile_cont(0.95) WITHIN GROUP
           (ORDER BY EXTRACT(epoch FROM (completed_at - ran))) AS p95_run_secs
FROM backups_history
WHERE ran >= now() - interval '12 months'
  AND completed_at IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- q04c: monthly processed volume from run metrics (q00e confirmed metrics
-- carries totals + delta_* incrementals — this is the direct flow/processing
-- measurement for the cost model: full-copy volume AND net-new volume)
SELECT date_trunc('month', ran)::date AS month,
       count(*) AS runs,
       sum((metrics ->> 'records')::numeric)                        AS records_processed,
       sum((metrics ->> 'delta_records')::numeric)                  AS delta_records,
       round(sum((metrics ->> 'file_size')::numeric)  / 1e9, 2)     AS file_gb_processed,
       round(sum((metrics ->> 'delta_file_size')::numeric) / 1e9, 2) AS delta_file_gb,
       sum((metrics ->> 'attachment_count')::numeric)               AS atts_processed,
       sum((metrics ->> 'delta_attachment_count')::numeric)         AS delta_atts
FROM backups_history
WHERE ran >= now() - interval '12 months'
  AND metrics IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- q04b: runs per account, last 90 days (per-account compute intensity)
SELECT account,
       count(*) AS runs_90d,
       round(sum(EXTRACT(epoch FROM (completed_at - ran))) / 3600, 2) AS total_run_hours_90d
FROM backups_history
WHERE ran >= now() - interval '90 days'
  AND completed_at IS NOT NULL
GROUP BY account
ORDER BY runs_90d DESC;


-- ============================================================================
-- SECTION 5 — RESTORE USAGE (informs restore-per-month tier caps)
-- ============================================================================

-- q05: restores per month + completion, last 24 months
SELECT date_trunc('month', created_at)::date AS month,
       count(*) AS restores,
       count(DISTINCT account) AS accounts_restoring,
       count(*) FILTER (WHERE completed_at IS NOT NULL) AS completed
FROM backups_restore
WHERE created_at >= now() - interval '24 months'
GROUP BY 1
ORDER BY 1;


-- ============================================================================
-- SECTION 6 — INITIAL-SYNC SPIKE vs STEADY STATE (the Q4 cost question)
-- Attachment bytes uploaded per account per month. First month(s) vs
-- later months quantifies the onboarding-absorption cost and the
-- "free up to X GB initial sync" threshold.
-- ============================================================================

-- q06: attachment upload timeline per account
SELECT account,
       date_trunc('month', uploaded_at)::date AS month,
       count(*) AS atts_uploaded,
       round(sum("size") / 1e9::numeric, 3) AS gb_uploaded
FROM backups_attachments
WHERE uploaded_at IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, 2;

-- ============================================================================
-- SECTION 7 — STORAGE DESTINATIONS (internal vs external — the GB-under-
-- management model input). Sources lookup confirmed: 2=Google Drive,
-- 3=Dropbox, 4=Box, 6=OneDrive (1=Jotform and 5=Airtable are source-side).
-- ============================================================================

-- q07a: backup jobs + accounts by destination provider
SELECT s.name AS provider,
       count(*) AS jobs,
       count(*) FILTER (WHERE b.status = 'active' AND NOT b.paused) AS active_jobs,
       count(DISTINCT b.account) AS accounts
FROM backups b
JOIN connections c ON c.id = (b.config #>> '{storage,connection}')::int
JOIN sources s ON s.id = c.source
WHERE b.config #>> '{storage,connection}' ~ '^[0-9]+$'
GROUP BY 1
ORDER BY 2 DESC;

-- q07b: stored attachment footprint by destination provider
SELECT s.name AS provider,
       count(*) AS stored_atts,
       round(sum(ba."size") / 1e9::numeric, 2) AS stored_gb,
       count(DISTINCT ba.account) AS accounts
FROM backups_attachments ba
JOIN backups b ON b.id = ba.backup
JOIN connections c ON c.id = (b.config #>> '{storage,connection}')::int
JOIN sources s ON s.id = c.source
WHERE ba.upload_status = 'uploaded' AND ba.removed_at IS NULL
  AND b.config #>> '{storage,connection}' ~ '^[0-9]+$'
GROUP BY 1
ORDER BY 3 DESC;

-- q06b: system-wide monthly attachment processing (cost-model headline)
SELECT date_trunc('month', uploaded_at)::date AS month,
       count(*) AS atts_uploaded,
       round(sum("size") / 1e9::numeric, 2) AS gb_uploaded,
       count(DISTINCT account) AS accounts_uploading
FROM backups_attachments
WHERE uploaded_at IS NOT NULL
  AND uploaded_at >= now() - interval '24 months'
GROUP BY 1
ORDER BY 1;
