## ADDED Requirements

### Requirement: Engine responses are shape-validated before use

Task helpers SHALL validate the minimal expected shape of every engine internal-route response they consume (`/token` → non-empty string `accessToken`; `/schema-sync` → boolean `recordsEnabled` + string `baseRunId`; `/attachments/lookup` → object `hits`). A 2xx response that fails validation SHALL fail the task with an `engine_contract_<route>` error naming the engine host — never the credential material — instead of propagating garbage into downstream calls.

#### Scenario: Wrong app answering the engine URL

- **WHEN** `BACKUP_ENGINE_URL` points at a server that returns an unrelated 200 body for `/token`
- **THEN** the task fails with `engine_contract_token` (and the run completes as failed with that message), instead of calling Airtable with an undefined bearer and reporting an Airtable 401

#### Scenario: Additive engine evolution stays compatible

- **WHEN** the engine adds NEW fields to a response
- **THEN** validation passes — guards check only the fields the task reads
