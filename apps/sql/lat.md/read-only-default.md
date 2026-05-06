# Read-Only by Default

Per [shared/Baseout_PRD.md §10](../../../shared/Baseout_PRD.md) and [shared/Baseout_Features.md §14.2](../../../shared/Baseout_Features.md), the SQL API is **read-only by default**. Write access is an explicit Enterprise opt-in.

This is enforced at the connection level — the DB user `apps/sql` connects as has only `SELECT` privilege. No software-level allowlist replaces that.

## Enforcement

How read-only is enforced, in priority order:

1. The DB role used by `apps/sql` has only `SELECT` and `USAGE` privileges. Attempting `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, etc. fails at the database, not in our code.
2. Statement parser (best-effort) blocks DDL/DML keywords before sending to Hyperdrive — primarily a UX win (better error messages) rather than the security boundary.
3. Per-request statement timeout (e.g. 30s) prevents long-running queries from monopolising the connection.

## Enterprise Write Opt-In

Enterprise customers can opt in to write access. This is **not** a flag flip — it is a separate provisioning flow:

- A separate API key is issued, scoped to a separate "writable" DB role with `INSERT`/`UPDATE`/`DELETE` granted on customer-data tables only.
- The opt-in is recorded in the master DB and surfaced in the `apps/web` settings UI for audit.
- The customer's contract documents the data-handling implications.

## Where to Look

Pointers to canonical specs and related rules.

- PRD §10: [shared/Baseout_PRD.md](../../../shared/Baseout_PRD.md)
- Features §14.2: [shared/Baseout_Features.md](../../../shared/Baseout_Features.md)
- Root security model: [root security-model](../../../lat.md/security-model.md)
