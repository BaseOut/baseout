// D1 database-name resolver (server-d1-backend task 1.1).
//
// One D1 database per Space, keyed on the immutable Space ID:
//   baseout-{env}-space-{spaceId}
//
// Cloudflare D1 names: ≤ 64 chars, [a-zA-Z0-9-_]. Space IDs are UUIDs so the
// composed name always fits. No I/O.

const VALID_INPUT = /^[a-z0-9-_]+$/;
const VALID_D1_NAME = /^[a-zA-Z0-9-_]{1,64}$/;

function assertInput(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty or whitespace`);
  }
  if (!VALID_INPUT.test(value)) {
    throw new Error(
      `${label} "${value}" must be lowercase and contain only [a-z0-9-_]`,
    );
  }
}

export function resolveSpaceD1Name(env: string, spaceId: string): string {
  assertInput("env", env);
  assertInput("spaceId", spaceId);

  const name = `baseout-${env}-space-${spaceId}`;

  if (name.length > 64) {
    throw new Error(
      `Resolved D1 name "${name}" must be ≤ 64 characters (got ${name.length})`,
    );
  }
  if (!VALID_D1_NAME.test(name)) {
    throw new Error(
      `Resolved D1 name "${name}" must match [a-zA-Z0-9-_] and be ≤ 64 characters`,
    );
  }

  return name;
}
