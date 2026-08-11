## ADDED Requirements

### Requirement: Inbox entry in the sidebar

The sidebar SHALL carry an **Inbox** item above the Space groups (it is account-scoped). It SHALL open the Inbox panel rather than navigate. It SHALL show a badge counting rows that **need a decision** — not unread rows — capped at `9+` and hidden when zero.

#### Scenario: Badge counts unresolved problems, not unread news

- **WHEN** there are 4 rows needing attention and 6 unread activity rows
- **THEN** the sidebar badge reads `4`

#### Scenario: Reading a row does not lower the badge

- **WHEN** a user opens a row that needs attention
- **THEN** the row is marked read and the badge still counts it, because read is not resolved

### Requirement: The top-bar bell is removed

`Header.astro` SHALL NOT render a notification bell. The top bar SHALL be hidden at and above the sidebar breakpoint (`lg`), and below it SHALL render only the sidebar toggle.

#### Scenario: Desktop has no top bar

- **WHEN** the viewport is 1024px or wider
- **THEN** no top bar is rendered and the Inbox is reachable only from the sidebar

#### Scenario: Mobile keeps the sidebar reachable

- **WHEN** the viewport is under 1024px
- **THEN** the top bar renders the hamburger, which is the only way to open the off-canvas sidebar

### Requirement: Non-modal overlay panel

The panel SHALL overlay the work area from its left edge and SHALL NOT resize the page beneath it. It SHALL be non-modal: no scrim, no focus trap, no `role="dialog"`, and no focus steal on open. `Esc` SHALL close it and return focus to the trigger. Below 1024px it SHALL fill the screen.

#### Scenario: Opening the panel does not reflow the page

- **WHEN** the panel opens on a 1280px viewport showing a data table
- **THEN** the table's visible width is unchanged and no columns are pushed behind a horizontal scroll

#### Scenario: The page behind stays interactive

- **WHEN** the panel is open and the user clicks a control on the page that is still visible
- **THEN** the control responds; the panel does not dim or block it

### Requirement: Two tabs with persistent counts

The panel SHALL present two tabs — **Needs attention** (task icon) and **Activity** (bell icon) — with `Needs attention` active by default. Each tab SHALL carry its own count badge, and **both badges SHALL remain visible while the other tab is active**. The attention badge counts rows to fix; the activity badge counts unread rows.

#### Scenario: A broken connection is visible from the Activity tab

- **WHEN** a connection is broken and the user is looking at the Activity tab
- **THEN** the `Needs attention` tab still shows its count badge

#### Scenario: Each tab has its own zero-state

- **WHEN** `Needs attention` is empty but Activity has rows
- **THEN** the attention tab shows "Nothing needs your attention" and does not claim the whole inbox is clear

### Requirement: Filtering is scoped to Activity

The `All | New` filter SHALL exist only in the Activity tab and SHALL NOT be able to hide a `Needs attention` row. It SHALL default to `All`. When the filter matches nothing but the lane has rows, the panel SHALL say so rather than render an empty lane.

#### Scenario: Mark-all-read then filter to New cannot hide a broken connection

- **WHEN** the user presses `Mark all read` and then selects `New`
- **THEN** Activity shows "No new activity", and every unresolved `Needs attention` row remains visible and unread

#### Scenario: Mark all read spares rows that need a decision

- **WHEN** the user presses `Mark all read`
- **THEN** only Activity rows become read, and the attention count is unchanged

### Requirement: Triage belongs to Needs attention

`Needs attention` rows SHALL offer `Mark done` and `Snooze`. Activity rows SHALL offer only `Mute this base`. `Done`, `Snooze` and `Mute` SHALL each be reversible via an `Undo` in their result toast. Faked actions SHALL announce that nothing was persisted.

#### Scenario: Activity rows cannot be marked done

- **WHEN** the user hovers a "backup completed" row
- **THEN** the only control offered is `Mute this base`

#### Scenario: Undo restores a mis-clicked Done

- **WHEN** the user marks a row done and presses `Undo` in the toast
- **THEN** the row returns to its lane and the counts are restored

### Requirement: Handled rows stay in their own lane

Rows that are done, snoozed or self-resolved SHALL be rendered but hidden behind a `Show handled` toggle **in the lane that produced them**. A handled row SHALL NOT be moved into another lane. The toggle SHALL live in `Needs attention` and SHALL be hidden while there is nothing handled.

#### Scenario: A resolved reconnect is not filed as news

- **WHEN** a broken-connection row resolves
- **THEN** it remains under `Needs attention`, behind `Show handled`, and never appears in Activity

#### Scenario: Show handled reveals the graveyard

- **WHEN** the user enables `Show handled`
- **THEN** done, snoozed and resolved rows appear with a state badge, and a `Move back` control on the ones the user handled

### Requirement: Self-healing, resolved silently

Rows bound to live state (connection reconnect, health score) SHALL resolve themselves when that state clears: struck through, labelled `Resolved`, moved behind `Show handled`, and removed from the attention count. The system SHALL NOT emit a new notification on recovery. A self-resolved row SHALL NOT offer `Undo`. A state-backed row SHALL NOT offer `Mark done`.

#### Scenario: Reconnecting clears the alert and the banner

- **WHEN** the user completes the reconnect flow
- **THEN** the inbox row resolves, the connection-health banner disappears, and no "connection restored" notification is created

#### Scenario: A failed backup is not un-happened by a later success

- **WHEN** a later backup for the same base succeeds
- **THEN** the failed-backup row stays until the user marks it done

### Requirement: Successes roll up per base; failures never do

Successful backups and non-breaking schema changes SHALL roll up per base into one expandable row labelled with the count. Failed backups, breaking schema changes and reconnect SHALL always render standalone.

#### Scenario: Three nightly backups collapse into one row

- **WHEN** one base has three successful backups
- **THEN** Activity shows "*<base>* — 3 backups completed" with a control to expand the individual runs

#### Scenario: A failure inside a chatty base is never buried

- **WHEN** a base has three successful backups and one failure
- **THEN** the failure is its own row under `Needs attention` and is not folded into the rollup

### Requirement: Every row deep-links to where the user can act

Opening a row SHALL mark it read and navigate to the surface that resolves it (the run's log, the schema diff, the reconnect flow). The panel SHALL NOT render an in-panel reading pane. Rows the user can resolve directly SHALL additionally carry an inline action (`Reconnect`, `View log`, `Review diff`).

#### Scenario: A breaking schema change opens the diff

- **WHEN** the user clicks a "breaking schema change" row
- **THEN** the app navigates to the schema surface and the row becomes read

### Requirement: Signal routing

A signal that requires a decision SHALL NOT be delivered as a toast. Toasts SHALL be reserved for transient confirmation of the user's own action. The connection-health banner SHALL be reserved for a broken or blocking connection. A broken connection SHALL appear in both the banner and the inbox, and resolving it SHALL clear both.

#### Scenario: A saved setting toasts and does not reach the inbox

- **WHEN** the user saves a setting
- **THEN** a toast confirms it and no inbox row is created

#### Scenario: A health-score drop never takes over the banner

- **WHEN** the health score falls
- **THEN** an inbox row is created and the connection banner is not shown

### Requirement: Accessible announcement

New rows SHALL be announced through a polite live region. Assertive announcement SHALL be reserved for a failed backup or a broken connection. Icon-only controls SHALL carry a text label for assistive technology and a daisyUI tooltip, never a native `title=`.

#### Scenario: A routine arrival does not interrupt

- **WHEN** a "backup completed" row arrives
- **THEN** it is announced politely and does not steal focus
