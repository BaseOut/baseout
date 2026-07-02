# chat-tab

A Chat tab on the Schema page: thread list + conversation + composer, with async
reply polling and Pro+ gating.

## ADDED Requirements

### Requirement: Chat tab with threads and conversation
The Schema page SHALL add a **Chat** tab (last in the tab order) with a thread list
(new chat + select), a conversation view (user + assistant bubbles), and a
composer. The tab SHALL lazy-load threads on first open.

#### Scenario: Start a conversation
- **WHEN** a Pro+ user starts a new thread and sends a message
- **THEN** the conversation shows the user message and the thread appears in the list

### Requirement: Async reply via polling
After sending, the tab SHALL show a pending assistant bubble and poll the thread
until the reply resolves (complete or error), then render it.

#### Scenario: Reply resolves
- **WHEN** the engine's async reply completes
- **THEN** the pending bubble is replaced by the assistant's reply without a page reload

### Requirement: Pro+ gating
The chat proxy routes SHALL require the Pro+ (`manual_ai`) Schema Docs level. Below
Pro+, the tab SHALL present an upgrade affordance instead of an active composer.

#### Scenario: Below Pro+
- **WHEN** a non-Pro+ user opens the Chat tab
- **THEN** an upgrade affordance is shown (no active composer), and the proxy returns 403

#### Scenario: No schema
- **WHEN** a Pro+ Space has no captured schema
- **THEN** the tab shows a "no schema to chat about" empty state
