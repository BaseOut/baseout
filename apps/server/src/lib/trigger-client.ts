// Worker-side wrapper around Trigger.dev's tasks.trigger().
//
// The SDK reads the API token from a global it sets via configure(); we
// call configure() at every entry point because the Worker runtime has
// no module-level "warmup" hook and we'd rather pay the (no-op when
// unchanged) reset than risk a missed token. configure() is idempotent
// for the same value — repeat calls do not race because every request
// in this Worker uses the same env.TRIGGER_SECRET_KEY.
//
// All wrappers take `env` explicitly; never read process.env (no such
// thing in workerd). Never log the token.
//
// Type-only imports for task definitions: tasks.trigger<typeof X>("X-id")
// gives us payload typing without bundling the task body into the Worker.

import { configure, tasks } from "@trigger.dev/sdk";
import type { Env } from "../env";
import type { pingTask } from "../../trigger/tasks/_ping";

function configureFromEnv(env: Env): void {
  configure({ accessToken: env.TRIGGER_SECRET_KEY });
}

export interface TriggerHandle {
  id: string;
}

/** Enqueue the no-op smoke task. Returns the run ID for cloud-dashboard verification. */
export async function enqueuePing(
  env: Env,
  payload: { echo?: unknown } = {},
): Promise<TriggerHandle> {
  configureFromEnv(env);
  const handle = await tasks.trigger<typeof pingTask>("_ping", payload);
  return { id: handle.id };
}
