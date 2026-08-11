# schema-chat

Engine storage + plumbing for AI chat about a Space's schema.

## ADDED Requirements

### Requirement: Persisted threads and messages
The engine SHALL persist chat threads + messages per-Space (`bo_at_chat_threads`,
`bo_at_chat_messages`, per-Space schema v5). Threads list newest-first and exclude
archived by default; a thread carries its scope + attached docs; assistant
messages carry a status (`pending|complete|error`).

#### Scenario: Create and list a thread
- **WHEN** a thread is created and a turn is sent
- **THEN** the thread appears in the list (excluding archived) with its messages in order

### Requirement: Metadata-only scoped context
Context assembly SHALL include only schema metadata (entity names, types,
descriptions) + attached doc summaries — never record data — scoped to the
thread's bases/tables/fields (empty scope ⇒ whole Space).

#### Scenario: Scoped to a table + a doc
- **WHEN** a thread is scoped to one table with a doc attached
- **THEN** the assembled context includes only that table's schema slice + the doc summary

### Requirement: Async send + complete
`/chat/send` SHALL append the user message + a pending assistant message, assemble
context, and enqueue the reply task; `/chat/message-complete` SHALL resolve the
pending message. On enqueue failure the pending message SHALL be set to `error`.

#### Scenario: Send enqueues a pending reply
- **WHEN** a user sends a message
- **THEN** a pending assistant message exists and the reply task is enqueued

#### Scenario: Completion resolves the reply
- **WHEN** the task POSTs the generated reply to `/chat/message-complete`
- **THEN** the pending assistant message becomes `complete` with the content

### Requirement: Thread management + gating
The engine SHALL support rename, archive, and set-context (scope + attached docs)
on a thread. All chat routes SHALL be `INTERNAL_TOKEN`-gated and validate the
space/thread ids + body.

#### Scenario: Archive hides a thread
- **WHEN** a thread is archived
- **THEN** it is omitted from the default thread list
