## Why

The earlier attempt at a "local Playwright runner" (the reverted `web-e2e-local-runner` change) only made it easier to run **pre-written** Playwright specs locally. The repo has 3 specs today (`magic-link.spec.ts`, `backup-happy-path.spec.ts`, in-flight `workspace-rediscovery.spec.ts`) covering roughly 5% of the UI. Every other change — a button on `/settings`, a new component, a tweak to a layout — has no automated coverage. The "spec-as-you-go" policy paired with that runner shifted the verification burden onto whoever made the change: write the spec yourself, every time, or you're still eyeballing the browser.

The user's actual ask is simpler: *"after a UI change, something verifies everything still works without me looking in a browser."*

This change delivers that by installing the **Playwright MCP** server ([@playwright/mcp](https://github.com/microsoft/playwright-mcp), official Microsoft) and codifying a rule in `apps/web/.claude/CLAUDE.md` that requires Claude to drive the local dev server through that MCP and verify every UI-touching change before claiming the task done. Coverage on day one is *every* route Claude touches, not just the three with hand-written specs — because Claude is the one looking at the page, not relying on pre-existing assertions.

## What Changes

- **New file [.mcp.json](../../../.mcp.json) at repo root** — registers Playwright MCP as a project-scoped MCP server so anyone with Claude Code who clones the repo gets it automatically. Launches Chromium in `--headless --isolated --ignore-https-errors` mode, with `--allowed-origins` scoped to `https://localhost:*;https://baseout-dev.openside.workers.dev` (semicolon-separated per Playwright MCP's CLI contract) so the MCP isn't pointed at arbitrary public URLs by accident. Note: per the Playwright MCP docs, `--allowed-origins` is a guard rail, not a security boundary, and does not affect redirects.

- **New §3.5 "AI Verification of UI Changes" subsection in [apps/web/.claude/CLAUDE.md](../../../apps/web/.claude/CLAUDE.md)** — placed inside §3 (TDD), matching the half-step numbering convention (§1.5, §5.5, §5.6). Codifies the verification rule:
  - **Trigger paths** (any change touching these requires verification):
    - `apps/web/src/pages/**/*.astro`
    - `apps/web/src/components/**/*.astro`
    - `apps/web/src/layouts/**/*.astro`
    - `apps/web/src/middleware.ts`
    - `apps/web/src/lib/auth-client.ts`
    - `apps/web/src/lib/account.ts`
    - `apps/web/src/stores/**`
    - `apps/web/src/styles/**`
  - **Verification pass** (before claiming the task done):
    1. Confirm `https://localhost:4331` reachable via `curl -k`. If not, instruct the user to run `pnpm --filter @baseout/web dev` and wait.
    2. Use Playwright MCP `browser_navigate` to load the affected route(s).
    3. For authenticated routes: sign in via the existing magic-link readback flow (HMAC-signed `GET /api/internal/test/last-verification`, same pattern as [apps/web/tests/e2e/fixtures.ts](../../../apps/web/tests/e2e/fixtures.ts)) using a fresh per-session test email matching the existing convention from [apps/web/tests/e2e/magic-link.spec.ts](../../../apps/web/tests/e2e/magic-link.spec.ts) (`e2e-claude-<timestamp>-<rand>@e2e.invalid`); this satisfies the `/^e2e-[a-z0-9-]+@[a-z0-9.-]+$/` input gate on `/api/internal/test/last-verification`.
    4. Exercise the specific change: visibility check via accessibility tree for new/changed elements; trigger for new/changed interactions; submit for new/changed forms; route navigation for middleware/routing changes.
    5. Check: page status 200, no JS console errors, no same-origin 4xx/5xx network calls.
    6. Take a screenshot via `browser_take_screenshot`.
    7. Report back to the user: pass/fail + screenshot + errors caught + one-line summary of what was exercised.
  - **Exception**: pure copy-only changes (typo fix, aesthetically-equivalent class swap) may skip verification but must be explicitly noted in the change description.

- **Extend §13 Development Checklist in apps/web/.claude/CLAUDE.md** with one item:
  - "AI verification pass green: dev server up, target route(s) navigated, change exercised, no console/network errors, screenshot attached (or copy-only carve-out noted in change description)".

- **Update [apps/web/.dev.vars.example](../../../apps/web/.dev.vars.example)** — add a documented entry for `E2E_TEST_TOKEN` with a short comment explaining its purpose (HMAC secret consumed by `/api/internal/test/last-verification`; must match the same secret the magic-link readback fixture signs with). Without this in local `.dev.vars`, Claude's auth step during verification 401s.

- **Update [apps/web/README.md](../../../apps/web/README.md)** — one paragraph documenting the AI verification loop for human contributors: what triggers it, what Claude does, what to do if it's failing (start dev, check `.dev.vars`, etc.).

## Out of Scope

- **Visual regression / screenshot diffing.** Screenshots are for the user to glance at, not for automated diffs. A baseline-vs-current image-diff harness is a separate decision.
- **Mobile breakpoint sweeps.** Playwright MCP can resize via `--viewport-size`, but the default is desktop. Adding a mobile pass is a follow-up.
- **Full accessibility audits.** The accessibility-tree snapshot is used for element-existence checks, not WCAG audits.
- **Engine-touching flows.** `apps/web`'s `BACKUP_ENGINE` service binding stays `"remote": true`. Pages depending on engine state (backup history, rescan banner with live data) still require the deployed dev engine to be in the right state. Verification will navigate to those pages but cannot guarantee engine state — the rule notes this carve-out.
- **Replacing the Playwright spec suite.** Specs under `apps/web/tests/e2e/` keep running via the existing `pnpm test:e2e` flow against the deployed worker for CI. Claude's MCP verification augments, not replaces.
- **Auto-booting the dev server from inside Claude.** Backgrounded `pnpm dev` processes are fragile across Claude sessions; user-managed for v1.
- **Re-introducing the reverted "local Playwright runner" or "spec-as-you-go" rule.** Both were already reverted; this change is the replacement, not an extension.

## Capabilities

### New Capability

- `web-ai-verify` — Claude verifies UI-touching changes in `apps/web` by driving Playwright MCP against the local dev server (`https://localhost:4331`), exercising the change, checking for console/network errors, and capturing a screenshot before declaring the task complete. Engine-dependent flows are flagged but not blocked.

## Impact

- **Repo root**: one new file (`.mcp.json`).
- **apps/web/.claude/CLAUDE.md**: new §3.5 subsection + one §13 checklist item.
- **apps/web/.dev.vars.example**: one new documented entry.
- **apps/web/README.md**: one new paragraph for human contributors.
- **No package.json changes.** No new npm deps in the repo — Playwright MCP runs via `npx @playwright/mcp@latest`.
- **No DB schema changes.** No new secrets in the deployed environment — `E2E_TEST_TOKEN` already exists in dev/staging/prod via `wrangler secret put`; this just documents it for local `.dev.vars`.
- **No engine changes.**
- **Per-session resource impact**: when Claude verifies, an isolated Chromium launches via MCP (~50–100 MB RAM while running, torn down at session end).

## Reversibility

Pure roll-forward. To disable:
- Delete `.mcp.json` → MCP server disappears from Claude's tool list on next launch.
- Revert the §3.5 subsection + §13 checklist edit → the rule disappears.
- Revert the `.dev.vars.example` entry → just documentation; nothing fails.
- Revert the README paragraph → just documentation.

No data migration, no engine redeploy, no backwards-compat shim needed.
