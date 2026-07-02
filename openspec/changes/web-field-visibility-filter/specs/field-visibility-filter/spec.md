## ADDED Requirements

### Requirement: Hierarchical multi-select grouped by Base and Table

The Fields filter SHALL be a dropdown/popover presenting a multi-select tree grouped **Base ▸ Table ▸ Field**, where each field is individually toggleable for visibility. Base and table groups SHALL show a visible/total count.

#### Scenario: Toggle a single field

- **WHEN** a user opens the Fields filter and toggles one field off
- **THEN** that field is marked hidden and its table/base group counts update

### Requirement: Show/hide all at global, base, and table levels

The filter SHALL provide bulk show/hide controls at the **global**, **base**, and **table** levels, in addition to per-field toggles. Toggling a group SHALL cascade to all fields under it.

#### Scenario: Hide all fields in a table

- **WHEN** a user uses a table's "hide all"
- **THEN** every field under that table is hidden and the table/base reflect the change

#### Scenario: Global show all

- **WHEN** a user uses the global "show all"
- **THEN** every field across all bases/tables becomes visible

### Requirement: Indeterminate state on partial selection

A table control SHALL show **indeterminate** when some but not all of its fields are visible; a base control SHALL show indeterminate when partial across its fields; the global control likewise. Fully-visible groups read as checked, fully-hidden as unchecked.

#### Scenario: Partial table is indeterminate

- **WHEN** some but not all of a table's fields are visible
- **THEN** that table's control shows an indeterminate state

### Requirement: Search across the tree

The filter SHALL include a search that filters the tree to matching base/table/field names while keeping ancestors visible for context. When a search is active, bulk controls SHALL act on the matched fields.

#### Scenario: Search then bulk-toggle matches

- **WHEN** a user searches "email" and uses show-all
- **THEN** only matching fields (and their ancestors) are shown, and show-all applies to those matches

### Requirement: Field-type indicator on field rows

Each field row SHALL display a field-type indicator (its Airtable field-type icon when the icon set is available, otherwise its field-type label) next to the field name.

#### Scenario: Field row shows its type

- **WHEN** the filter lists a single-select field
- **THEN** the row shows that field's type beside the name

### Requirement: Trigger reflects the active selection

The filter's trigger control SHALL communicate the active selection (e.g. "Fields: 24 of 180") so the current visibility scope is visible without opening the menu.

#### Scenario: Trigger shows count

- **WHEN** 24 of 180 fields are visible
- **THEN** the Fields trigger shows that count
