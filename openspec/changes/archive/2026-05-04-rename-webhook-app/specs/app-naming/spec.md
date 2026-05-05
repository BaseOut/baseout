## ADDED Requirements

### Requirement: Webhooks app uses short consistent name
The app formerly at `apps/webhook-ingestion` SHALL exist at `apps/webhooks` with package name `@baseout/webhooks`.

#### Scenario: webhooks app is at apps/webhooks
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app SHALL exist at `apps/webhooks` and NOT at `apps/webhook-ingestion`

#### Scenario: package name matches directory
- **WHEN** `apps/webhooks/package.json` is read
- **THEN** the `name` field SHALL be `"@baseout/webhooks"`

#### Scenario: workspace resolves renamed package
- **WHEN** `pnpm install` is run at the repo root
- **THEN** `@baseout/webhooks` SHALL resolve without errors
