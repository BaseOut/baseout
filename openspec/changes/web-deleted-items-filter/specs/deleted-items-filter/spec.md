## ADDED Requirements

### Requirement: Removed items hidden by default

The Browse tab SHALL show only `active` (and `unknown`) schema entities by default; `removed` (deleted) bases, tables, fields, and views SHALL NOT be visible. When removed entities exist, a discoverable affordance (a "N deleted — show" count) SHALL indicate that hidden deleted items exist; when none exist, no such affordance SHALL appear.

#### Scenario: Default Browse hides deleted

- **WHEN** a base has fields with `status='removed'` and the user opens Browse without the deleted filter
- **THEN** those fields are not visible, and a "deleted" count affordance indicates they exist

#### Scenario: Clean schema shows no deleted affordance

- **WHEN** a Space's schema has no `removed` entities
- **THEN** no "Include deleted" affordance or count is shown

### Requirement: Include-deleted filter

An "Include deleted" toggle SHALL reveal `removed` entities, displayed muted with a "deleted" badge and a "no longer in Airtable" note (showing the removal date, "since &lt;date&gt;", when the engine provides one). Revealed removed entities SHALL remain navigable to their detail, which already notes they are removed from Airtable.

#### Scenario: Reveal deleted items

- **WHEN** the user enables "Include deleted"
- **THEN** `removed` entities appear muted with a "deleted" badge and a "no longer in Airtable" note, and clicking one opens its detail (flagged removed)

#### Scenario: Toggle back to active-only

- **WHEN** the user disables "Include deleted" after revealing them
- **THEN** the `removed` entities are hidden again and the tree returns to active-only

### Requirement: Unknown items remain visible

Entities the engine could not confirm in a run (`status='unknown'`) SHALL remain visible by default and SHALL NOT be hidden by, or counted in, the deleted filter — they are distinct from `removed`.

#### Scenario: Unknown not hidden

- **WHEN** an entity has `status='unknown'`
- **THEN** it is shown normally in the default Browse view and is not included in the "N deleted" count
