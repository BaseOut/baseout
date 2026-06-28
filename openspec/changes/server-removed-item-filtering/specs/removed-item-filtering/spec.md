## ADDED Requirements

### Requirement: Vanished schema entities marked removed on re-capture

During schema processing, after a confident full enumeration, any previously-`active` base / table / field not seen in the run SHALL be set to `status = 'removed'` with `first_unseen_run` set to that run, and SHALL be retained (not deleted). A failed or partial enumeration SHALL NOT mark entities removed (they remain `unknown`). Re-seen entities SHALL stay `active` and bump `last_seen_run`.

#### Scenario: Field removed in Airtable

- **WHEN** a field present in prior runs is absent from a confident full schema capture
- **THEN** its `bo_at_fields.status` becomes `removed`, `first_unseen_run` records the run, and the row is retained

#### Scenario: Partial run does not remove

- **WHEN** a schema capture fails to fully enumerate a base's tables
- **THEN** the affected entities are left `unknown`, not `removed`

### Requirement: Reads default to active-only with include-removed opt-in

The engine schema read endpoints SHALL return only `active` (and `unknown`) entities by default, excluding `removed` ones. They SHALL accept an `include_removed` flag that additionally returns `removed` entities, each flagged with its `removed` status and the run/date it went missing.

#### Scenario: Default read hides removed

- **WHEN** the Browse/schema read endpoint is called without `include_removed`
- **THEN** removed bases/tables/fields are not returned; active (and unknown) ones are

#### Scenario: Include-removed returns flagged removed items

- **WHEN** the endpoint is called with `include_removed=true`
- **THEN** removed entities are also returned, each carrying its `removed` status and the run/date it was first unseen, so the UI can render them as deleted history

#### Scenario: Unknown is not treated as deleted

- **WHEN** an entity is `unknown` (a run couldn't confirm it)
- **THEN** it is returned by default (not hidden), distinct from `removed`
</content>
