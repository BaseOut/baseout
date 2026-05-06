# Versioning

Public URL versioning: `/v1/...`, `/v2/...`. Each major version is a stable contract; breaking changes land in a new major.

Today there is no live API surface — Phase 2 ships v1.

## Versioning Rules

The contract for stability and deprecation. The whole point of this app being a separate Worker is to keep this contract honest.

- Add fields to a response — non-breaking; clients should ignore unknown fields.
- Remove or rename fields — breaking; goes in next major.
- Change a status code or error shape for an existing endpoint — breaking.
- Add a new endpoint to an existing version — non-breaking.
- Tighten validation (rejecting payloads previously accepted) — breaking.

## Deprecation

When a v1 endpoint is destined for removal in v2:

- Mark deprecated in the OpenAPI spec.
- Emit a `Deprecation: true` header and a `Sunset:` date header on every response.
- Send proactive customer comms 60 days before sunset.
- Remove only after sunset — never silently.

## Stability Window

v1 stays available for at least 12 months after v2 ships. Sunset dates beyond that are decided per-version, not in advance.

## Where to Look

Pointers to related rules and surfaces.

- Public API spec: TBD (OpenAPI in repo once Phase 2 lands)
- API surface entry: [src/index.ts](../src/index.ts)
- Service auth contract: [[service-auth]]
