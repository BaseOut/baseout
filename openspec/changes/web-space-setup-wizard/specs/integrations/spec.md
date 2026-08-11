## ADDED Requirements

### Requirement: Unconfigured Space shows the backup model as a diagram
The system SHALL present a Space with no backup configured as a Source → Space → Destinations diagram with a single call to action, teaching the model before the user commits.

#### Scenario: Empty Space overview
- **WHEN** a Space has no Source, bases, or Destination
- **THEN** the overview shows Airtable as the Source, the Space as the hub, and the available Destinations (file storage and databases), with one "Set up backup" action

#### Scenario: One action, not a form
- **WHEN** the user looks at the unconfigured overview
- **THEN** the tiles are illustrative (not connect points) and the only action opens the setup wizard

### Requirement: Per-Space setup wizard referencing account objects
The system SHALL let the user configure a Space's backup through a left-to-right flow — Source, then bases, then Destination, then options (depth and schedule), then review — that references account-level Sources and Destinations rather than connecting platforms from scratch.

#### Scenario: Ordered setup
- **WHEN** the user starts setup for an unconfigured Space
- **THEN** the wizard is a gated stepper that unlocks Source → Bases → Destination → Options → Review in order, requires at least one base, and finishes by running the first backup

#### Scenario: Pick the Source first
- **WHEN** the user is on the Source step and the account already has Airtable sources
- **THEN** the user picks one of them, and the chosen source's bases are what the Bases step offers

### Requirement: Create a Source or Destination inline without leaving the wizard
The system SHALL allow creating a new Source or Destination from within the setup flow, in a drawer, and SHALL auto-select the new object so the user continues without losing wizard state.

#### Scenario: No account object yet
- **WHEN** a step has no account object to pick (the account is empty)
- **THEN** the step offers to connect the first one, opening a drawer to create it inline

#### Scenario: Created and selected
- **WHEN** the user creates a Source or Destination in the drawer
- **THEN** the new object is added to the account and auto-selected in the step, and the wizard remains open

#### Scenario: Custom object while objects exist
- **WHEN** account objects exist but the user wants a different one
- **THEN** the user can add a custom Source/Destination from the same drawer without leaving the wizard

### Requirement: Reconnect a broken connection inside the wizard
The system SHALL let the user reconnect a Source or Destination that has lost access from within the setup/edit flow, in place, and SHALL prevent finishing while the selected Source or file Destination is broken.

#### Scenario: Reconnect a broken object in place
- **WHEN** a Source or Destination in the picker has lost access
- **THEN** the row shows a "Lost access" state and a Reconnect action that opens a drawer to reauthorize it (an OAuth popup, or a re-entered token / connection string), and on success the row returns to Connected without leaving the flow

#### Scenario: A broken selection blocks finishing
- **WHEN** the currently selected Source or file Destination has lost access
- **THEN** the wizard blocks "Run first backup" (setup) or "Save changes" (edit) and shows a hint to reconnect it first

#### Scenario: A broken object that is not selected does not block
- **WHEN** a Source or Destination that is not the current selection has lost access
- **THEN** it still offers Reconnect, but it does not block finishing the flow

### Requirement: Changing the Source resets the base selection
Because bases belong to a Source, the system SHALL reset the Space's base selection when the Source changes, after a heads-up, so a Space never backs up bases from the wrong Source.

#### Scenario: Switching the Source clears the base selection
- **WHEN** the user changes the selected Source while bases are selected
- **THEN** the wizard asks to confirm, and on confirm it clears the base selection and notes that the bases now shown are for the new Source

#### Scenario: Keep the current Source
- **WHEN** the user declines the source-switch confirmation
- **THEN** the previous Source stays selected and the base selection is untouched

#### Scenario: No selection to lose
- **WHEN** the user changes the Source with no bases selected
- **THEN** the Source switches immediately with no confirmation

### Requirement: New Airtable bases are surfaced, never silently added
The system SHALL detect bases that appeared in Airtable since the Space's last backup and SHALL surface them for review rather than adding them automatically, while offering an opt-in to auto-add future bases.

#### Scenario: New bases are notified
- **WHEN** Airtable has bases the Space has not seen since its last backup
- **THEN** those bases are tagged "New" and a banner offers to review them or add them, up to the plan limit

#### Scenario: Adding new bases respects the plan cap
- **WHEN** the user adds the new bases but the plan limit is already reached
- **THEN** the add is limited to the remaining room and the upgrade nudge is shown

#### Scenario: Opt-in auto-add
- **WHEN** the user has selected every current base
- **THEN** an "auto-add future bases" toggle lets them opt into including new bases automatically, up to the plan limit

### Requirement: Edit an existing configuration as free tabs
The system SHALL present editing an already-configured Space as free, jump-anywhere tabs pre-filled with the current configuration, saved as a set, distinct from the first-run stepper.

#### Scenario: Configure opens edit tabs
- **WHEN** the user opens Configure on a configured Space
- **THEN** the screen shows Source / Bases / Destination / Options as tabs the user can switch in any order, pre-filled with the current selection, with a Save changes action

#### Scenario: No run step when editing
- **WHEN** the user is editing an existing configuration
- **THEN** there is no Review/Run step — saving applies to the next scheduled run

## MODIFIED Requirements

### Requirement: Configured Space overview
The system SHALL present a configured Space's overview as the backup pipeline — one Source, the selected bases, a schedule, and one or more Destinations — joined by a status connector that reads as "connected and working".

#### Scenario: Healthy pipeline
- **WHEN** a Space's Source and Destination are connected and backups run
- **THEN** the overview shows the pipeline From the Source → the bases → To the Destination, with a green check status between the cards, plus schedule and last / next run

#### Scenario: Paused pipeline
- **WHEN** the Space's Source or a Destination has lost access
- **THEN** the connector shows a warning rather than a check, and the overview links to reconnect that account object
