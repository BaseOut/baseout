// Type-only re-exports so apps/server's trigger-client can do
// `tasks.trigger<typeof pingTask>(...)` without bundling the task body.
// Importing from `@baseout/workflows` keeps the Worker's bundle Trigger.dev-
// SDK-only; the task source stays on the Trigger.dev runner.

export type { pingTask } from "./_ping";
export type { backupBaseTask, BackupBaseTaskPayload } from "./backup-base.task";
export type { BackupBaseResult, BackupBaseInput } from "./backup-base";
