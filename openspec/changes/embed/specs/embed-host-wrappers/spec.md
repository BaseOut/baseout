# embed-host-wrappers

Three thin, UI-less host wrappers (Chrome extension, Airtable data-layer extension, Airtable interface extension) that render the Baseout app in an iframe and speak the embed messaging protocol, plus the shared wrapper core they are built on.

## ADDED Requirements

### Requirement: Wrappers are UI-less iframes with all UX delegated to the child
Each host wrapper SHALL render exactly one full-viewport iframe loading `${appOrigin}/embed?host=<kind>` and MUST NOT render any other UI — no loading screens, error panels, or sign-in prompts. All user-facing states, including unauthenticated, are rendered by the embedded app; the wrapper's only UX responsibility is honoring `child:open-external` through its host-appropriate opener.

#### Scenario: Unauthenticated user in any host
- **WHEN** the embedded app reports `authenticated: false` and the user activates its sign-in prompt
- **THEN** the wrapper opens the received URL top-level (Chrome: `chrome.tabs.create`; Airtable hosts: `window.open`) and renders nothing of its own

### Requirement: A shared core owns iframe creation and the host bridge
A shared `@baseout/embed-core` module SHALL implement the common wrapper behavior — iframe creation, `createHostBridge` wiring (hello retry until ack, exact child-origin validation, open-external origin refusal), and context forwarding — with host specifics injected (`hostKind`, `getInitialContext`, `onContextChange`, `openExternal`). Host packages MUST NOT reimplement bridge or iframe logic. The app origin SHALL be fixed at build time per host build; wrappers MUST NOT accept a runtime-configurable app origin.

#### Scenario: Context change flows through core
- **WHEN** a host's `onContextChange` subscription fires with a new context
- **THEN** core sends `host:context` with that context over the established bridge

### Requirement: The Chrome wrapper derives context from the active tab URL
The Chrome extension (Manifest V3, side panel) SHALL watch the active tab via a background service worker and derive `EmbedContext` by parsing Airtable URLs with a pure, fixture-tested parser: data-layer paths yield `baseId`/`tableId`/`viewId`, interface paths yield `baseId`/`pageId`, and any unrecognized or non-Airtable URL degrades to `{ host: 'chrome', url }` without error. Context updates SHALL flow to the panel on tab activation and tab URL change, and derivation MUST be stateless per event (service-worker restarts are harmless).

#### Scenario: User switches to an Airtable data tab
- **WHEN** the active tab URL becomes `https://airtable.com/appX/tblY/viwZ`
- **THEN** the embedded app receives `host:context` with `{ host: 'chrome', baseId: 'appX', tableId: 'tblY', viewId: 'viwZ' }`

#### Scenario: Non-Airtable tab
- **WHEN** the active tab is `https://example.com`
- **THEN** the context is `{ host: 'chrome', url: 'https://example.com' }` with no Airtable IDs

### Requirement: The Airtable data-layer wrapper derives context from the blocks SDK cursor
The data-layer extension SHALL obtain `baseId` from the SDK base and active `tableId`/`viewId` from the SDK cursor, pushing `host:context` on cursor changes with `host: 'airtable-data'`.

#### Scenario: User switches tables in the base
- **WHEN** the Airtable cursor moves to another table
- **THEN** the embedded app receives `host:context` with the new `tableId` (and `viewId` when available)

### Requirement: The Airtable interface wrapper derives context from the interface surface
The interface extension SHALL be a separate extension package (own registration) with `host: 'airtable-interface'`, providing `baseId` plus `pageId` and record scope (`recordId`) where the pinned SDK version exposes them; where unavailable it SHALL degrade to `{ host: 'airtable-interface', baseId }` rather than fail.

#### Scenario: Record-bound interface element
- **WHEN** the interface element is bound to a record and the SDK exposes it
- **THEN** the context includes `recordId` alongside `baseId` and `pageId`

### Requirement: Each wrapper is dev-verifiable without publication
The repo SHALL contain per-host dev instructions and builds runnable without store or marketplace publication: the Chrome extension loads unpacked from its build output; both Airtable extensions run via the blocks CLI (`block run`) against a development base. Each host's dev smoke covers: boot, handshake completion, context navigation in the child, a context update, and `open-external`.

#### Scenario: Chrome dev smoke
- **WHEN** the built extension is loaded unpacked and the side panel is opened on an Airtable tab
- **THEN** the panel shows the embedded Baseout app navigated to the context-matched surface
