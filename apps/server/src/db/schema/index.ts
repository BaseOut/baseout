// Schema barrel — mirrors specific tables from apps/web's canonical Drizzle schema.
//
// Migrations are owned by the frontend (apps/web/drizzle/). The server only
// mirrors tables it reads/writes (e.g. connections, backup_runs,
// backup_configuration_bases) with header comments naming the canonical
// migration source. Per CLAUDE.md §5.3.

export * from "./connections";
export * from "./backup-runs";
export * from "./backup-configurations";
export * from "./backup-configuration-bases";
export * from "./at-bases";
export * from "./spaces";
export * from "./platforms";
export * from "./subscriptions";
export * from "./subscription-items";
export * from "./space-events";
