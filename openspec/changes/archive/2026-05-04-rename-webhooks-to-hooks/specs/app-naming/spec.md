## ADDED Requirements

### Requirement: Hooks app uses final short name
The app formerly at `apps/webhooks` SHALL exist at `apps/hooks` with package name `@baseout/hooks`.

#### Scenario: hooks app is at apps/hooks
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app SHALL exist at `apps/hooks` and NOT at `apps/webhooks`

#### Scenario: package name matches directory
- **WHEN** `apps/hooks/package.json` is read
- **THEN** the `name` field SHALL be `"@baseout/hooks"`

#### Scenario: workspace resolves renamed package
- **WHEN** `pnpm install` is run at the repo root
- **THEN** `@baseout/hooks` SHALL resolve without errors
