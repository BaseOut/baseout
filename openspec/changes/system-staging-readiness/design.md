# Design — system-staging-readiness

## D1 — Triage order is evidence-first: build command before anything else

The single highest-probability explanation for BOTH reported symptoms (dead magic-link email AND inert refresh cron) is the same dashboard setting: a Workers Builds build command that omits `CLOUDFLARE_ENV=staging`. `launch.mjs` flattens exactly one env block into the deployed artifact, and the local `dist/server/wrangler.json` proves the default build produces the **dev** artifact (`BASEOUT_DEV=true`, dummy Hyperdrive, `baseout-server-dev` binding). Therefore the Dan ask leads with "paste the current build command for `baseout-web` and `baseout-server` staging" as a **read**, not a change request — if it's wrong, one setting fixes email, cookies, trusted origins, DB binding, and the engine's cron behavior at once. Every other ask is sequenced after that answer so we don't burn Dan's time provisioning things that were never the problem.

A cheap runtime tripwire is worth adding later (e.g. `/api/health` reporting `BASEOUT_ENV`), but is out of scope here; the immediate check is `curl https://console.baseout.dev/api/health` style probes listed in the verification phase.

## D2 — One consolidated Dan message, structured as verify/set/report

Dan owns every account surface (memory + explicit constraint: no Cloudflare/Trigger.dev/DO access for us, ever). Scattered asks get dropped; the ask is ONE message with three sections per item: **verify** (read a value back to us), **set** (exact value or generation instruction — never a secret over chat where avoidable; byte-parity items name which existing secret to copy from), **report** (what to paste back). Secrets parity is expressed as equality constraints, not values:

- `BASEOUT_ENCRYPTION_KEY`: byte-identical on `baseout-web` and `baseout-server` (staging env). Drift is silent and unfixable from outside (decrypt throws mid-claim; connection never even flips `pending_reauth`).
- `INTERNAL_TOKEN` (server, api, workflows/Trigger.dev) ≡ `BACKUP_ENGINE_INTERNAL_TOKEN` (web, admin): three names, one value.
- `AIRTABLE_OAUTH_CLIENT_ID`/`_SECRET`: identical on web and server.
- `TRIGGER_SECRET_KEY` on staging `baseout-server` = the Trigger.dev **Staging** environment key for `proj_lklmptmrmrkeaszrmhcs` (the key alone routes runs to an environment).

## D3 — Repo fixes land regardless of Dan's timeline

Phases 1–2 (code + docs) have zero dependency on account access and land first: the `allowedHosts`/`PROD_TRUSTED_ORIGINS` hardening removes a real single-point-of-failure whether or not the build command was wrong; the guardrail resurrection (`secrets:check` as a real script + CI on `staging` pushes) prevents the next drift class from shipping silently. Rule: no fix beyond what the audit names (§3.2 no drive-bys) — e.g. we fix `check-cron-config.mjs` to parse the committed `wrangler.jsonc` across all three envs OR delete it in favor of extending `check-wrangler-secrets.mjs`, whichever is smaller; we do not redesign the cron system.

## D4 — `E2E_TEST_MODE` on staging: keep, but close the loop

The comment says Playwright deliberately targets staging, so removing the flag breaks intent. Decision: keep `E2E_TEST_MODE=true`, add `E2E_TEST_TOKEN` to `env.staging.secrets.required` (it gates the bypass endpoints with an HMAC — without the secret set they 401), and surface the pairing in the Dan ask (he must set the secret). Flag in the security-review notes that the bypass surface exists on a public host and is token-gated; production keeps neither the var nor the secret.

## D5 — Verification is read-only where possible, and logged

We can't read dashboards, but we can read the deployed behavior and the DB. Cron health comes from `service_runs` rows (the `*/15` sweep writes them) via the admin surface or a tunnel psql; magic-link health from an actual login on `console.baseout.dev`; build-env health from response headers/behavior probes. Each verification outcome gets a dated entry in the tasks file; anything that fails becomes a follow-up bug, not an in-place scope expansion. The backup smoke is explicitly NOT run here — it belongs to `shared-managed-r2-staging` §5 and only starts after this change's asks land.

## Risks

- **Dan latency** gates Phases 3–5; Phases 1–2 are deliberately independent.
- **Two WIP threads in the working tree** (per-Connection queue serialization; the R2 wizard/runbook edits) are uncommitted and interleaved with this audit's files. Commits must stage files by name per thread — nothing from another thread rides along.
- **Staging shares the 15-conn Hyperdrive pool across six Workers** — under load, DB saturation can mimic several of these failures (silent hangs). If verification behaves erratically, probe connection count before re-opening root-cause work.
- `ops-setup.md` rewrite risks documenting Dan's dashboard from assumption; every statement about the dashboard must be marked verified-by-Dan or left as ❓ (same verify-then-record rule as `shared-managed-r2-staging` D2).
