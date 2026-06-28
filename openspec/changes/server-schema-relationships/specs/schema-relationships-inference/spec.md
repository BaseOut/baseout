## ADDED Requirements

### Requirement: Space-level synced-view inference

After all of a run's bases are captured, the system SHALL run a Space-level inference comparing tables (across bases) for very similar field structures (name + type overlap above a threshold) and pre-populate `synced_view` relationships with `origin = inferred` and `status = inferred`, linking the two tables (and matching field pairs). Because it compares across bases, it SHALL run as a Space-level step, not inside per-base capture.

#### Scenario: Two similar tables across bases

- **WHEN** two tables in different bases share a highly similar field set
- **THEN** a `synced_view` relationship (origin `inferred`, status `inferred`) is created linking the two tables, available for the user to confirm or dismiss

#### Scenario: Within-base synced view

- **WHEN** two tables in the same base have very similar field structures
- **THEN** the inference still proposes a `synced_view` relationship between them

### Requirement: Inference respects user decisions and is idempotent

The inference SHALL NOT recreate relationships the user has `dismissed`, SHALL leave already-`confirmed` ones intact, and SHALL be idempotent run-to-run (re-running on an unchanged Space produces no new inferred relationships and no duplicate links). When a previously-inferred match no longer holds, its links SHALL be marked `removed` (history preserved).

#### Scenario: Re-run produces no duplicates

- **WHEN** inference runs again on an unchanged Space
- **THEN** no duplicate `synced_view` relationships or links are created, and dismissed pairs are not re-proposed

#### Scenario: Inferred match no longer holds

- **WHEN** two previously-similar tables diverge so they're no longer similar
- **THEN** the inferred relationship's links are marked `removed` (the relationship is retained for history and computes as invalid)

### Requirement: Conservative confidence

Inference SHALL be conservative (a high similarity threshold) and inferred relationships SHALL NOT be treated as authoritative by downstream features until confirmed.

#### Scenario: Weak similarity not inferred

- **WHEN** two tables share only a few common field names/types below the threshold
- **THEN** no `synced_view` relationship is inferred
</content>
