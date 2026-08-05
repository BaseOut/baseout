# dependency-security

Known-vulnerable dependencies are remediated or governed, under the workspace's lockfile discipline.

## ADDED Requirements

### Requirement: Critical and high Dependabot alerts are remediated or risk-accepted

Every open Dependabot alert of severity **critical** or **high** on the `BaseOut/baseout` repository SHALL be either (a) remediated by upgrading the offending dependency to a patched version within its permitted range or by a scoped `pnpm.overrides` pin of the vulnerable transitive, or (b) recorded as a dated, owner-attributed risk-acceptance in the Comp AI exception register with a compensating control and a re-review date. No critical or high alert SHALL be left in an untracked open state.

#### Scenario: In-range transitive CVE

- **WHEN** a high-severity alert names a transitive dependency that has a patched version reachable without moving any direct dependency across a major
- **THEN** the transitive is pinned to that patched version via a narrowly-scoped `pnpm.overrides` entry, and the alert clears on the next Dependabot scan

#### Scenario: Only a breaking major fixes it

- **WHEN** the only version that patches an alert requires a breaking major upgrade of a direct dependency
- **THEN** the upgrade is NOT forced in this change; instead a decision is recorded and the alert is either scheduled as its own migration change or written to the exception register as a governed risk-acceptance

### Requirement: Remediation preserves the workspace supply-chain discipline

Dependency remediation SHALL be performed inside the repository's existing controls: `pnpm-lock.yaml` is regenerated only via `pnpm install` (never hand-edited), `pnpm install --frozen-lockfile` remains clean afterward, and neither the `minimumReleaseAge` supply-chain guard nor the frozen-lockfile policy is relaxed to obtain a fix. `npm audit fix --force` (or any forced breaking upgrade) SHALL NOT be used as an unattended remediation.

#### Scenario: Lockfile discipline holds

- **WHEN** a remediation batch is applied and committed
- **THEN** `pnpm install --frozen-lockfile` runs clean from the repo root and the diff contains no change to `minimumReleaseAge` or frozen-lockfile configuration

### Requirement: Each batch passes per-app verification before commit

Each remediation batch SHALL keep green, in every app it touches, that app's existing `typecheck`, `build`, and test suite before the batch is committed (the existing suites are the regression harness; pre-existing known failures are baselined, not introduced). A batch that turns a green suite red without a trivial in-range fix SHALL be backed out and the alert reclassified rather than forced.

#### Scenario: A bump breaks a suite

- **WHEN** applying a batch causes a previously-green test suite or typecheck to fail and the failure is not a trivial in-range adjustment
- **THEN** the batch is reverted and its alert is reclassified to a major-migration decision or a risk-acceptance

### Requirement: Remediation state is auditable for SOC 2

The remediation SHALL produce a tracked ledger (severity × package × bucket × manifest × fix-version) that is cross-linked from the Comp AI policy→evidence map, and the before/after alert counts and residual risk-accepted set SHALL be recorded so the `dependabot_enabled` / `code_scanning` checks reflect remediation plus a governed exception process rather than an open finding.

#### Scenario: Auditor reviews dependency posture

- **WHEN** an auditor inspects the vulnerability-patch-management evidence
- **THEN** they find the ledger with each critical/high alert marked remediated or risk-accepted, the before/after counts, and links from the policy→evidence map
