# workflows-base-collaborators — Design

## Context

`backup-base` already performs a per-base schema fetch at run start; this change adds a sibling metadata fetch and forwards the payload to the engine. All modeling, diffing, and fallback logic is engine-side (`server-base-collaborators`) — the task is deliberately a dumb courier, the same division of labor as comments capture.

## Goals / Non-Goals

**Goals:**
- One GET per base per run, forwarded verbatim; zero parsing in the task beyond HTTP success.
- Failure of the capture never affects record/attachment/comment capture.

**Non-Goals:**
- Any interpretation of collaborator data task-side.
- Caching/skip optimization (the endpoint is one cheap call; a count-delta-style optimization has nothing to key on and isn't worth the machinery).

## Decisions

**1. Fetch verbatim, forward verbatim.**
The task does not parse the payload (beyond HTTP status) — the engine owns the shape, including the deprecated-block fallback. This keeps the cross-repo contract to "the endpoint's response body, as returned," so payload evolution (e.g. `packages` getting modeled) needs no workflows deploy.

**2. Placed after schema fetch, before record fan-out.**
Same client and rate budget as `getBaseSchema()`; running early means collaborator freshness matches the run's schema snapshot, and a metadata failure is known before the expensive stages (for progress reporting only — it never gates them).

**3. All four includes, always.**
`collaborators`, `inviteLinks`, `interfaces`, `packages` — the marginal payload size is trivial, and fetching everything means the engine can start ingesting a block (packages) without a workflows change.

## Risks / Trade-offs

- **[Payload size on interface-heavy bases]** A base with many interfaces × collaborators inflates the POST → batched as a single per-base capture (the endpoint is unpaginated, so it's bounded by what Airtable itself returns); no chunking until a real payload proves the need.
- **[Rate budget]** +1 request per base per run → negligible against the schema fetch + record paging that already run per base.

## Migration Plan

Additive task step; deploy after the server pair. Rollback: remove the step — engine rows go stale but intact (no deletion diffing without captures).

## Open Questions

- None owned here (packages shape and PRD amendment ride the server pair).
