# server-schedule-and-cancel

Lights up the two backup-lifecycle features still missing from the MVP per PRD §6 / Features §6.1: **scheduled backups** (the cadence the user picked in wizard step 3 actually runs on a clock) and **cancel a run** (in-flight or future-scheduled). Also locks the "what gets backed up for MVP" scope in writing so the implicit answer ("all tables of every selected base, records only, attachments deferred") stops drifting between sessions.

Cross-app: `apps/server` owns the per-Space DO scheduler + cancel endpoint; `apps/web` owns the cancel button + the next-scheduled-at surface in `IntegrationsView`. One master-DB migration (additive — new status values + a nullable timestamp column).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
