# schema-chat-respond

A per-turn Trigger.dev task that generates a chat reply and writes it back.

## ADDED Requirements

### Requirement: Generate a reply from assembled context
The task SHALL call Claude with the engine-assembled metadata-only context + the
conversation (prior history + the new user message) and POST the reply to the
engine to resolve the pending assistant message.

#### Scenario: Successful reply
- **WHEN** the task runs for a sent message
- **THEN** it generates a reply and completes the pending assistant message with the content

### Requirement: Error fallback
If generation fails, the task SHALL write an error reply (status `error`) so the UI
stops waiting, rather than leaving the message pending.

#### Scenario: Generation fails
- **WHEN** the model call throws
- **THEN** the assistant message is completed with status `error` and a friendly message

### Requirement: Metadata-only + correct turn order
The task SHALL send only schema metadata + the user's own messages, and SHALL place
the new user message after the prior history. Non-user/assistant history roles SHALL
be filtered out.

#### Scenario: History ordering
- **WHEN** a thread has prior turns
- **THEN** the model sees the prior turns followed by the new user message
