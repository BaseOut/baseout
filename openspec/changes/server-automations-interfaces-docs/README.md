# server-automations-interfaces-docs

Adds user-submitted backup of the three Airtable entities that are NOT available via the REST API per [PRD §2.9](../../../shared/Baseout_PRD.md): **Automations** (Growth+), **Interfaces** (Growth+), and **Custom Documentation** (Pro+). Per PRD: "These entities must be submitted by the user through a Baseout intake method (Inbound API, Airtable Scripts, Airtable Automations, or Manual Forms)." Today none of this exists.

Cross-app: `apps/api` owns the Inbound API intake endpoint; `apps/web` owns the Manual Form UI + the per-Space view of submitted entities + the Airtable Script generator; `apps/server` is largely untouched (these entities don't run through `backup-base.task.ts` since they're not from the REST API).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
