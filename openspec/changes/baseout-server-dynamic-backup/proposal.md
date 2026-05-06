## Why

Dynamic backup writes record streams into a customer D1 / Postgres database via webhook-incremental updates — provisioning + connector logic lives here. Source-of-truth: PRD §10; Features §11.

## What Changes

D1 / Postgres provisioning, webhook-incremental backup.

## Depends on

- [baseout-server-engine-core](../baseout-server-engine-core/)
- [baseout-server-durable-objects](../baseout-server-durable-objects/)
