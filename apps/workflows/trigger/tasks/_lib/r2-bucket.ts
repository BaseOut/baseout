// Bucket-name resolver for managed R2 (system-r2-bucket-topology task 1.1 / T1).
//
// One managed bucket per Org, keyed on the *immutable* org ID (not the
// renamable slug) so a rename never orphans a bucket:
//   baseout-{env}-org-{organizationId}
//
// The resolved name is written to the org's managed storage-destination row on
// first provision and read back thereafter (design T1); this pure function is
// the single place the name is derived. It validates its inputs so the composed
// name is always a legal R2 account-global bucket name, and re-validates the
// composed result as defense-in-depth. No I/O.
//
// R2 account-global bucket-name rules enforced here: length 3–63, lowercase,
// only [a-z0-9-], no leading or trailing hyphen. (Double hyphens are allowed.)

const VALID_INPUT = /^[a-z0-9-]+$/;
const VALID_BUCKET = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function assertInput(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty or whitespace`);
  }
  if (!VALID_INPUT.test(value)) {
    throw new Error(
      `${label} "${value}" must be lowercase and contain only [a-z0-9-]`,
    );
  }
}

export function resolveManagedBucketName(
  env: string,
  organizationId: string,
): string {
  assertInput("env", env);
  assertInput("organizationId", organizationId);

  const name = `baseout-${env}-org-${organizationId}`;

  if (name.length < 3 || name.length > 63) {
    throw new Error(
      `Resolved bucket name "${name}" must be 3–63 characters (got ${name.length})`,
    );
  }
  if (!VALID_BUCKET.test(name)) {
    throw new Error(
      `Resolved bucket name "${name}" must be lowercase [a-z0-9-] with no leading/trailing hyphen`,
    );
  }

  return name;
}
