## ADDED Requirements

### Requirement: Schema visualization (React Flow)

The Schema page SHALL render a React Flow node graph of the Space's schema (bases → tables → fields), populated from `server`'s `GET /spaces/{id}/schema` read endpoint.

#### Scenario: Schema renders

- **WHEN** a user opens /schema
- **THEN** React Flow renders nodes for each base/table/field with edges representing linked-record relationships

### Requirement: Schema changelog

The Schema page SHALL include a changelog tab that renders human-readable diffs from `server`'s `GET /spaces/{id}/schema/changelog?since=...` endpoint.

#### Scenario: Recent diff

- **WHEN** a user opens the changelog
- **THEN** the page lists each diff entry as a natural-language string (e.g., "Field 'Status' changed from Single Select to Multiple Select on May 1")

### Requirement: Health score display

The Schema page SHALL display the per-Base health score and band from the `server`-computed result, plus a drill-in panel for the contributing rule details.

#### Scenario: Yellow band drill-in

- **WHEN** a user clicks a Base in Yellow band
- **THEN** the panel lists each rule with its score contribution and remediation guidance

### Requirement: Health score rule configuration (Pro+)

The Schema page SHALL include a rule-configuration UI (Pro+) that writes `health_score_rules` for the Org. Configuration SHALL surface the same default rules `server` uses if none are configured.

#### Scenario: Custom rule added

- **WHEN** a Pro+ user adds a custom rule and saves
- **THEN** `health_score_rules` is updated and the next backup run's health score uses the new rule

### Requirement: Diagram export per tier

Diagram export SHALL be tier-gated: PNG (Growth), SVG (Pro), PDF (Business), embed widget (Enterprise). Rendering SHALL be client-side from the React Flow graph.

#### Scenario: Pro user exports SVG

- **WHEN** a Pro user clicks "Export → SVG"
- **THEN** the diagram is rendered to an SVG file and downloaded
