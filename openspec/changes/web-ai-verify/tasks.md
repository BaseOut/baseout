# Implementation tasks

## 1. Playwright MCP server registration

- [x] 1.1 Create [.mcp.json](../../../.mcp.json) at repo root registering `playwright` MCP server with args `["@playwright/mcp@latest", "--headless", "--isolated", "--ignore-https-errors", "--allowed-origins", "https://localhost:*;https://baseout-dev.openside.workers.dev"]` (semicolon-separated origins per Playwright MCP CLI contract)
- [x] 1.2 Verify the JSON is valid and the file lands at the repo root (`jq . .mcp.json` succeeded)
- [ ] 1.3 User restarts Claude Code (or reloads MCP servers) so the new MCP is picked up

## 2. .dev.vars.example update

- [x] 2.1 Append a documented `E2E_TEST_TOKEN` entry to [apps/web/.dev.vars.example](../../../apps/web/.dev.vars.example) with a comment explaining: (a) it's the HMAC secret consumed by `/api/internal/test/last-verification`, (b) must equal the same value used by the magic-link readback fixture, (c) generate with `openssl rand -base64 32`, (d) required for AI verification to sign in locally
- [ ] 2.2 User confirms their local `.dev.vars` has `E2E_TEST_TOKEN` set; if not, generates one and adds it

## 3. CLAUDE.md rule + checklist

- [x] 3.1 Add new "§3.5 AI Verification of UI Changes" subsection to [apps/web/.claude/CLAUDE.md](../../../apps/web/.claude/CLAUDE.md), placed between §3 (TDD) and §4 (nanostores), matching half-step numbering convention
- [x] 3.2 Trigger paths list verbatim: `src/pages/**/*.astro`, `src/components/**/*.astro`, `src/layouts/**/*.astro`, `src/middleware.ts`, `src/lib/auth-client.ts`, `src/lib/account.ts`, `src/stores/**`, `src/styles/**`
- [x] 3.3 Verification pass body documents the 7-step pass (curl precheck → navigate → sign-in-if-needed → exercise change → status/console/network checks → screenshot → report). Sign-in step generates a fresh per-session email of the form `e2e-claude-<timestamp>-<rand>@e2e.invalid` matching the input gate `/^e2e-[a-z0-9-]+@[a-z0-9.-]+$/` enforced by [last-verification.ts](../../../apps/web/src/pages/api/internal/test/last-verification.ts)
- [x] 3.4 Documents the engine-dependent carve-out (BACKUP_ENGINE stays --remote; pages depending on engine state are verified but engine-state truthiness is not guaranteed)
- [x] 3.5 Documents the copy-only exception (must be explicitly noted in change description)
- [x] 3.6 Append one item to §13 Development Checklist: "AI verification pass green: dev server up, target route(s) navigated, change exercised, no console/network errors, screenshot attached (or copy-only carve-out noted in change description)"

## 4. README documentation

- [x] 4.1 Add a "AI verification loop" paragraph to [apps/web/README.md](../../../apps/web/README.md) for human contributors — what triggers it, what Claude does, how to set up `.dev.vars` for it, what to do if Claude reports the dev server isn't reachable

## 5. Verification

- [ ] 5.1 `.mcp.json` parses as valid JSON (`jq . .mcp.json` succeeds)
- [ ] 5.2 User restarts Claude Code; the `playwright` MCP server appears in the available tool list (look for `browser_navigate`, `browser_take_screenshot`, etc.)
- [ ] 5.3 User starts `pnpm --filter @baseout/web dev`
- [ ] 5.4 In a fresh Claude session, user asks Claude to verify a known-working page (`/login-register` is a good first target — unauthenticated, simple)
- [ ] 5.5 Claude navigates, takes a screenshot, reports back with no console errors
- [ ] 5.6 User confirms the verification loop works end-to-end
- [ ] 5.7 On approval: archive via `/opsx:archive web-ai-verify`

## 6. First real-world use (informational, not a blocker)

- [ ] 6.1 Next UI-touching change Claude makes triggers the rule and executes the 7-step pass without prompting
- [ ] 6.2 If the loop is awkward in practice (auth too slow, too many false positives, etc.), file a follow-up `web-ai-verify-tune` change rather than amending this one
