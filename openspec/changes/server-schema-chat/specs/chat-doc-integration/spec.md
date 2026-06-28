## ADDED Requirements

### Requirement: Load existing docs into the context window

A user MAY attach existing docs to a thread (`bo_at_chat_doc_links`, relation `context`). On subsequent turns, the content of attached `context` docs SHALL be included in the assembled context for the AI to reference. Docs MAY be detached.

#### Scenario: Attach a doc for reference

- **WHEN** a user adds an existing doc to a thread and then asks a question
- **THEN** that doc's content is included in the context window and the assistant can reference it

### Requirement: Convert a conversation into a Doc

A user MAY convert a thread into a new Doc. The system SHALL summarize the conversation into Doc (Plate) format, create a `bo_at_documents` row (auto-tagging the thread's scoped entities via `bo_at_document_tags`), record a `bo_at_chat_doc_links` (relation `generated`), and append a `system` chat message linking the new doc — so the chat shows a referenced doc. This SHALL debit credits.

#### Scenario: Convert to doc

- **WHEN** a user converts a conversation to a doc
- **THEN** a new `bo_at_documents` row is created with the summarized content (tagged with the thread's scoped entities), a `generated` doc link is recorded, a linking chat message is appended, and credits are debited

### Requirement: Doc link relations

`bo_at_chat_doc_links` SHALL distinguish `context` (loaded for the AI to reference) from `generated` (created by converting this conversation). Both SHALL surface as linked references in the chat; only `context` docs SHALL be fed into the AI context window.

#### Scenario: Generated doc not auto-fed as context

- **WHEN** a conversation is converted to a doc (relation `generated`)
- **THEN** that doc appears as a linked reference in the chat but is not automatically loaded into the context window unless also added with relation `context`
</content>
