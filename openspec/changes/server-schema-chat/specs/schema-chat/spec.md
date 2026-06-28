## ADDED Requirements

### Requirement: Chat threads and messages

The per-Space DB SHALL store chat as `bo_at_chat_threads` (`title`, `status` `active`|`archived`, creator, timestamps) and `bo_at_chat_messages` (`thread_id`, `role` `user`|`assistant`|`system`, `content`, `created_at`). Threads SHALL be listable and individually retrievable with their messages.

#### Scenario: Start a thread and exchange messages

- **WHEN** a user starts a chat and sends a message
- **THEN** a `bo_at_chat_threads` row and the user + assistant `bo_at_chat_messages` are persisted and retrievable

### Requirement: Scoped context window

A thread MAY scope its context to specific bases/tables/fields (`bo_at_chat_context_entities`). On each AI turn, only the scoped entities' schema slice SHALL be included as context (defaulting to the whole Space when nothing is scoped), alongside the thread's prior messages.

#### Scenario: Narrowing context to a table

- **WHEN** a thread is scoped to one table and the user asks a question
- **THEN** only that table's (and its fields') schema is sent as context, not the whole Space

### Requirement: Synchronous AI chat turn with credit debit

A chat turn SHALL be a synchronous engine flow: assemble context (scoped schema slice + context docs + history) → call the LLM (optionally streaming) → persist the assistant message → debit credits via `credit_transactions`. Chat SHALL be gated to Pro+.

#### Scenario: Turn debits credits

- **WHEN** the assistant responds to a user message
- **THEN** the assistant message is persisted and credits are debited for that turn

### Requirement: Thread management

Users SHALL be able to rename and archive threads. Archived threads SHALL be excluded from the default thread list but remain retrievable.

#### Scenario: Archive a thread

- **WHEN** a user archives a thread
- **THEN** it no longer appears in the default list but can still be opened
</content>
