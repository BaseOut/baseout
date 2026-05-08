// Trigger.dev v3 project config.
//
// Tasks live under ./trigger/tasks/ and run on the Trigger.dev runner
// (Node, no time limit) — NOT inside the Cloudflare Worker. The Worker
// handler enqueues a task by calling tasks.trigger() through the SDK,
// which posts to Trigger.dev's API; the runner then picks up the work.
//
// `maxDuration: 600` (10 minutes) per project CLAUDE.md §5.3 default.
// Per-base backup tasks override this when bases get large; webhook
// renewal / OAuth refresh / monitor crons stay under the default.
//
// Project ref `proj_lklmptmrmrkeaszrmhcs` mirrors apps/server/.dev.vars
// TRIGGER_PROJECT_REF (the team's existing Trigger.dev project; same
// project across dev/staging/prod for now — Trigger.dev "environments"
// segregate runs within a project).

import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_lklmptmrmrkeaszrmhcs",
  runtime: "node",
  logLevel: "log",
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
});
