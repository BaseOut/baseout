// Trigger.dev project config.
//
// Tasks live under ./trigger/tasks/ and run on the Trigger.dev runner
// (Node, no time limit) — NOT inside the Cloudflare Worker. The apps/server
// Worker enqueues a task by calling tasks.trigger() through the SDK, which
// posts to Trigger.dev's API; the runner then picks up the work.
//
// `maxDuration: 600` (10 minutes) per project CLAUDE.md default. Per-base
// backup tasks override this when bases get large; webhook renewal / OAuth
// refresh / monitor crons stay under the default.
//
// PROJECT REF COMES FROM THE ENVIRONMENT, not a literal.
//
// It used to be hardcoded to the staging project, which cannot survive the
// account split: production lives in a SEPARATE Trigger.dev account
// (architecture/systems-overview.md §2, §7), so its project ref differs. One
// literal here would silently deploy production tasks into the staging project.
//
// The CLI loads the env file into its own process before evaluating this
// module, so `--env-file .dev.vars` on the dev/deploy scripts is what populates
// this. In CI there is no file — Workers Builds supplies TRIGGER_PROJECT_REF as
// a build variable alongside TRIGGER_ACCESS_TOKEN.
//
// Note this mirrors apps/server's TRIGGER_PROJECT_REF, which is the value the
// Worker enqueues against. The two must name the same project or enqueued work
// is never picked up.

import { defineConfig } from "@trigger.dev/sdk";

const project = process.env.TRIGGER_PROJECT_REF;

if (!project) {
  // Fail loudly here rather than letting `defineConfig({ project: undefined })`
  // produce a confusing downstream error about a missing/!unknown project.
  throw new Error(
    "TRIGGER_PROJECT_REF is not set.\n" +
      "  Local:  add it to apps/workflows/.dev.vars (see .dev.vars.example). The\n" +
      "          `dev` script passes --env-file .dev.vars, which is how the CLI\n" +
      "          finds it.\n" +
      "  CI:     set it as a build variable on the Workers Builds project. The\n" +
      "          deploy scripts deliberately do NOT pass --env-file: the CLI hard\n" +
      "          fails on a missing path, and CI has no .dev.vars.\n" +
      "  It must match apps/server's TRIGGER_PROJECT_REF, and it differs between\n" +
      "  the staging and production Trigger.dev accounts.",
  );
}

export default defineConfig({
  project,
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
