## ADDED Requirements

### Requirement: Server waits show visible progress feedback

Every `apps/web` interaction that waits on the server — form submit, button click, Space switch, data refresh, or a slow page/data load — SHALL show a visible loading indicator while the operation is in flight, and SHALL clear it when the operation settles (including on error). A disabled control alone is not sufficient.

#### Scenario: Button triggers a network round-trip

- **WHEN** a user activates a control that makes a server request
- **THEN** a spinner appears on/near that control (via `setButtonLoading`) with `aria-busy` set, and is cleared in a `finally` when the request settles

#### Scenario: Slow page or data load

- **WHEN** a page or data region takes a noticeable time to load (e.g. the Space list)
- **THEN** a daisyUI `loading` indicator is shown for that region until the data arrives, then removed

### Requirement: Primary load paths are measurably faster

The primary load surfaces (Space list, dashboard) SHALL be optimised against a measured baseline, with the dominant cost identified before changes and re-measured after, and the optimisation SHALL not remove load-bearing behavior.

#### Scenario: Optimising the reported-slow surface

- **WHEN** the dominant load cost of a slow surface is identified and a targeted fix is applied
- **THEN** the same surface is re-measured and shows an improvement, with no regression to its existing behavior
