## MODIFIED Requirements

### Requirement: window.postMessage framework

`web` SHALL implement a `window.postMessage` handler that exchanges context with a thin
wrapper running inside the Airtable extension. The wrapper SHALL be a single shared
module used by both Airtable **data extensions** and **interface extensions**; the
context message SHALL identify the hosting surface alongside the active selection. The
messaging contract SHALL be documented and stable.

#### Scenario: Wrapper sends context

- **WHEN** the wrapper posts `{ type: 'context', surface: 'data-extension' | 'interface-extension', baseId, tableId, viewId }`
- **THEN** `web` updates the active selection in the embedded layout, aware of which extension surface is hosting it

#### Scenario: One wrapper, two surfaces

- **WHEN** the wrapper is loaded inside a data extension and inside an interface extension
- **THEN** both run the same wrapper module and speak the same message contract, differing only in the reported `surface` value

## ADDED Requirements

### Requirement: Context deep-linking to the active base

When the wrapper reports a base that the signed-in user's Space tracks, the embedded
app SHALL open scoped to that base rather than a generic landing page.

#### Scenario: Embedded load inside a tracked base

- **WHEN** the wrapper posts context for a base that exists in the user's Space
- **THEN** the embedded app opens the Schema page scoped to that base

### Requirement: Install-time schema visualization quick win

Immediately upon installation of the Baseout extension, the system SHALL visualize the
schema of the base the user is viewing — before any backup is configured — so the
extension delivers value at first contact.

#### Scenario: First embedded load after install

- **WHEN** a signed-in admin loads the extension for the first time in a base with no Baseout backup configured
- **THEN** the embedded app renders that base's schema visualization from a read-only schema pull, alongside the path to configure a backup
