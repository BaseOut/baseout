# Aug-28 Dan sync — action items plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to run this task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every action item from the 2026-08-28 09:00 call — get `staging` published and adopted as the working root, wire the support-docs freshness gate to `main` only, smoke the MCP server from a fresh client, and record the "internal chat is not MCP" decision — without touching anything Dan is restructuring this weekend.

**Architecture:** Five small, independent tasks. Two are git/process (push + convention), one is a CI workflow (docs gate), one is a manual smoke with a written record (MCP via Copilot), one is a decision note. No app runtime code changes.

**Tech Stack:** git, GitHub Actions, `scripts/support-docs-register.mjs`, `apps/api` (wrangler dev), VS Code + GitHub Copilot (MCP client).

**Spec:** meeting transcript (scratchpad `meeting.txt`, 2026-08-28) → summarized in memory `project_aug28_dan_sync_staging_branching_account_split.md`. Program context: `plans/2026-08-26-support-docs-automation.md`, `plans/2026-08-27-mcp-app-parity.md`.

## Global Constraints

- Work off `staging`. Feature branches branch **from `staging`**, are named by feature (no personal prefix), merge back **into `staging`**. Dan owns `staging → main`.
- **No pushes and no commits without Autumn's explicit OK** (memory: `feedback_no_prs_human_test_then_local_commit`). Each task below stops at "surface for approval".
- Do **not** touch: `wrangler.jsonc` files, deploy/secret-sync scripts, worker names, Hyperdrive/KV bindings, DB migrations, Trigger.dev config. Dan is rewriting all of it this weekend (Aug 29–30).
- Do **not** wire the internal chat to `/mcp`, and do not invent MCP UI.
- Commit messages per CLAUDE.md §3.8 (Verification block). No `console.*` in diffs.

---

### Task 1: Publish `staging` in sync with `main` — ✅ DONE 2026-08-28 (`022d14f6..1dda165b`)

**Files:** none (git only).

**Interfaces:**
- Produces: `origin/staging == origin/main == 1dda165b`, so Dan can pull a staging identical to main and land his wrangler work on both.

- [ ] **Step 1: Confirm nothing moved under us** (memory: concurrent sessions switch branches)

Run: `git status --short --branch && git fetch origin && git rev-list --left-right --count staging...origin/main`
Expected: `## staging...origin/staging [ahead 25]`, clean tree (only `?? apps/support/snapshots/`), counts `0	0` (staging has everything main has, nothing extra).

- [ ] **Step 2: Get Autumn's OK to push** — surface: "ready to `git push origin staging` (fast-forward, 25 commits, no merge commit)". Wait.

- [ ] **Step 3: Push**

Run: `git push origin staging`
Expected: `022d14f6..1dda165b  staging -> staging`

- [ ] **Step 4: Verify**

Run: `git rev-list --left-right --count origin/staging...origin/main`
Expected: `0	0`

---

### Task 2: Adopt the branching convention (and write it down once) — ✅ DONE 2026-08-28 (branch `repo-branching-convention`, commit `4bfaaffc`)

**Files:**
- Modify: `CLAUDE.md` §8 "Asking, Confirming, Committing" (append two bullets)

**Interfaces:**
- Produces: the first feature-named branch, `repo-branching-convention`, off `staging` — carries Tasks 2, 4-results and 5.

- [ ] **Step 1: Create the first feature branch from staging**

Run: `git checkout staging && git checkout -b repo-branching-convention`
Expected: `Switched to a new branch 'support-docs-ci-gate'`

- [ ] **Step 2: Document the convention in CLAUDE.md §8** — add these bullets at the end of the §8 list (keep the existing bullets untouched):

```markdown
- **Branch from `staging`, not `main`.** `staging` is the working root (deploys to the staging environment). Feature branches are named by the feature they carry — `repo-branching-convention`, `web-restore-promotion` — never by a person (`autumn/...` is retired). Merge a finished feature into `staging`; **Dan owns `staging → main`** (live) unless he says otherwise. (Dan sync, 2026-08-28.)
- **Deploys are moving to GitHub → Cloudflare builds** (staging account watches `staging`, live account watches `main`). The per-app `deploy` / `deploy:dev` / `secrets:sync:*` scripts and the `.dev.vars`-sync rule in §3.3 are being retired by Dan's env split (weekend of 2026-08-29) — don't build new work on them.
```

- [ ] **Step 3: Verify the edit is the only change**

Run: `git diff --stat`
Expected: ` CLAUDE.md | 2 ++` and nothing else.

- [ ] **Step 4: Surface for approval, then commit** (this is a docs-only change, so it uses the one-line Verification form):

```bash
git add CLAUDE.md
git commit -m "docs(repo): branch from staging with feature-named branches; flag deploy-script retirement

Dan sync 2026-08-28: staging is the working root (staging account builds it),
main is live and Dan owns the promotion. Personal branch prefixes retired.
Deploy scripts + .dev.vars sync are being replaced by GitHub->Cloudflare builds.

Verification: doc-only, no runtime change.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Support-docs freshness gate on `main` — HANDED TO DAN (2026-08-28)

> Autumn: "let Dan handle this." Kept below as the ready-made spec for whoever wires it; nothing here is executed by us.

#### Original task

Dan's ask: "a trigger that runs the skill when things are pushed to certain branches — make sure it's only main." The evaluator is a human-driven skill (`/support-docs-update`); what CI can do is run the **freshness gate** and make stale pages loud on every push to `main`. Testing it before it hits `main` uses `workflow_dispatch` (run it by hand against any branch) — no need to temporarily widen the `push` trigger.

**Files:**
- Create: `.github/workflows/support-docs-check.yml`

**Interfaces:**
- Consumes: `pnpm support:docs-check` → `node scripts/support-docs-register.mjs --check` (exit 1 on stale/missing pages; needs full git history because it compares commit timestamps of page vs. `sources:`).
- Produces: a GitHub Actions run named "Support docs freshness" on each push to `main`; red = at least one docs page is stale → run `/support-docs-update`.

- [ ] **Step 1: Write the workflow**

```yaml
name: Support docs freshness

# Runs the docs freshness gate (scripts/support-docs-register.mjs --check) so a
# push to main that moves code documented by apps/support makes the stale page
# visible. main only (Dan, 2026-08-28). workflow_dispatch lets us exercise it
# from a feature branch without widening the push trigger.
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: support-docs-${{ github.ref }}
  cancel-in-progress: true

jobs:
  docs-check:
    name: Stale docs pages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # the gate compares commit timestamps; a shallow clone breaks it

      - name: Set up pnpm
        uses: pnpm/action-setup@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Support docs register (report)
        run: pnpm support:docs-register

      - name: Support docs check (fails on stale/missing)
        run: pnpm support:docs-check
```

- [ ] **Step 2: Prove the gate runs locally the same way CI will**

Run: `pnpm support:docs-register | tail -5 && pnpm support:docs-check; echo "exit=$?"`
Expected: a register summary; `exit=0` if nothing is stale today, `exit=1` with named stale rows otherwise. Either is fine — note which, it's what the first CI run will show.

- [ ] **Step 3: Lint the YAML**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/support-docs-check.yml','utf8').split('\n').forEach((l,i)=>{if(/\t/.test(l))throw new Error('tab on line '+(i+1))});console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Surface for approval, then commit on `support-docs-ci-gate`**

```bash
git add .github/workflows/support-docs-check.yml
git commit -m "ci(support): run the docs freshness gate on every push to main

Dan asked for the docs-update trigger to listen only on main. The evaluator
stays a human-run skill; CI runs the freshness gate so a stale page fails a
visible check. workflow_dispatch allows a dry run from any branch.

Verification:
- Demo:    push to main -> Actions 'Support docs freshness' runs; a stale page
           fails the 'Stale docs pages' job and names the page + commit.
- Test:    pnpm support:docs-check (exit 0/1 locally matches CI)
- Checks:  workflow YAML parses; fetch-depth 0 required by the register script.
- Caveats: needs the branch pushed to run workflow_dispatch (see plan Task 3 step 5).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Dry-run from the branch (needs Autumn's OK to push the branch)**

Run: `git push -u origin support-docs-ci-gate && gh workflow run support-docs-check.yml --ref support-docs-ci-gate && sleep 20 && gh run list --workflow=support-docs-check.yml --limit 1`
Expected: one run listed, status `in_progress`/`completed`. Then `gh run watch` → the two steps print the register and the check result.

Optional "weird random change" test Dan described: on the branch, add a blank line to a file listed in some page's `sources:` (e.g. `apps/web/src/pages/login.astro` is a source of `start/signing-in.md`), commit, re-dispatch → the check step must go red naming `start/signing-in.md`. Revert the commit afterwards (`git reset --hard HEAD~1`, branch only).

- [ ] **Step 6: Merge into `staging`** (Autumn's OK): `git checkout staging && git merge --no-ff support-docs-ci-gate`. It reaches `main` when Dan promotes; the `push: main` trigger is inert until then.

---

### Task 4: MCP smoke from a fresh client (GitHub Copilot), zero repo access — ✅ scripted leg 7/7 PASS 2026-08-28; Copilot leg = Autumn hands-on (`~/mcp-smoke`)

> Results table: `plans/2026-08-27-mcp-app-parity.md` § "Fresh-client smoke (2026-08-28)". Token expires 2026-08-29 19:38 UTC; revoke earlier via Settings → Developer if the Copilot run finishes sooner.

Dan: test with something that can't see the code or conversation history. Copilot in a VS Code window opened on an **empty folder outside the repo** satisfies that.

**Files:**
- Create (outside repo): `~/mcp-smoke/.vscode/mcp.json`
- Modify: `plans/2026-08-27-mcp-app-parity.md` — append a "Fresh-client smoke (2026-08-28)" results block.

**Interfaces:**
- Consumes: `apps/api` at `http://localhost:8788/mcp`, Bearer token minted in web (**Settings → Developer**, `apps/web/src/views/SettingsView.astro`; API: `POST /api/tokens` `{ name, scopes[], spaceId }`). Valid scopes: `org:read backups:read schema:read documents:read documents:write reports:read reports:write views:read views:write data:read`.
- Deployed `baseout-api-dev` is unusable for per-Space calls (brokers to Dan's live server → 502) — run the **local pair** (memory `project_api_documents_tools_done`).

- [ ] **Step 1: Start the local pair (two terminals, repo root)**

```bash
# T1 — engine at TOP-LEVEL config (not --env dev, or api's `baseout-server` binding won't resolve)
cd apps/server && npx wrangler dev --port 8787
# T2 — api through the Hyperdrive simulator
cd apps/api && node scripts/dev.mjs --port 8788
```
Expected: both print `Ready on http://localhost:878x`. Probe: `curl -s localhost:8788/mcp` → 401 JSON (no token) proves the route is up.

- [ ] **Step 2: Mint a test token** — web dev (`pnpm --filter @baseout/web dev`, https://baseout.local:4331) → Settings → Developer → new token, name `copilot-smoke`, scopes `org:read schema:read documents:read documents:write views:read data:read`, bind to the Staging space (`c8384241…`, "Huh?" org — the Openside org has no `space_databases` row). Copy the one-time reveal; never paste it into the repo.

- [ ] **Step 3: Configure Copilot (fresh folder, no repo)**

```bash
mkdir -p ~/mcp-smoke/.vscode && cd ~/mcp-smoke && code .
```
`~/mcp-smoke/.vscode/mcp.json` (format from GitHub's Copilot MCP docs — `servers` + `requestInit.headers`):
```json
{
  "servers": {
    "baseout": {
      "type": "http",
      "url": "http://localhost:8788/mcp",
      "requestInit": { "headers": { "Authorization": "Bearer bo_live_PASTE_HERE" } }
    }
  }
}
```
Copilot Chat → Agent mode → tools icon → `baseout` should list tools (count = what the token's scopes allow; full catalog is 36).

- [ ] **Step 4: Run the four probes and record each result** (prompt → expected tool → pass criterion)

| # | Prompt to Copilot | Tool it should pick | Pass |
|---|---|---|---|
| 1 | "What organization and plan is this token for?" | `get_org` | returns org name + `plan: "core"` |
| 2 | "List the tables in the Staging space and open the Members table in the app." | schema list/search | returns tables + an `appUrl` containing `?entity=` |
| 3 | "Find records mentioning `<a known value>`." | record search | hits with `appUrl` containing `?record=` |
| 4 | "Create a document titled 'Copilot smoke 2026-08-28' with one paragraph, then delete it." | documents create → delete | create returns id; Copilot asks before the destructive delete; delete succeeds |

Fail conditions worth writing down: the client can't list tools (transport), a tool is listed that the scopes shouldn't allow (catalog bug), an `appUrl` doesn't open the panel in web (deep-link bug).

- [ ] **Step 5: Revoke the token** — Settings → Developer → revoke `copilot-smoke` (or `POST /api/tokens/<id>/revoke`). Delete `~/mcp-smoke/.vscode/mcp.json`.

- [ ] **Step 6: Record results** — append to `plans/2026-08-27-mcp-app-parity.md`:

```markdown
## Fresh-client smoke (2026-08-28, GitHub Copilot, folder outside the repo)

Local pair (server 8787 top-level / api 8788), token `copilot-smoke` (revoked after).
| probe | result | notes |
|---|---|---|
| get_org | PASS/FAIL | … |
| schema + `?entity=` deep link | PASS/FAIL | … |
| record search + `?record=` | PASS/FAIL | … |
| document create → confirm → delete | PASS/FAIL | … |
Follow-ups: <bugs found, or "none">.
```
Surface for approval, then commit as `docs(plans): record fresh-client MCP smoke results` (one-line Verification form). Any FAIL becomes its own feature branch off `staging`, not a fix inside this task.

---

### Task 5: Record "internal chat does not use MCP" where the next engineer will look — ✅ DONE 2026-08-28 (D7 in the MCP plan, commit `4bfaaffc`)

Verified today: nothing in `apps/web` or the chat-respond task calls our `/mcp` (the only `mcp-client` in `apps/workflows` is Airtable's MCP capture, unrelated). This is a guardrail note, not a code change.

**Files:**
- Modify: `plans/2026-08-27-mcp-app-parity.md` — add decision **D7** after D6.

- [ ] **Step 1: Add D7**

```markdown
- **D7 — The in-app chat does NOT go through the MCP server** (Dan, 2026-08-28). Chat calls the
  server brokers directly (same functions the API operations call); it must not be configured
  against `/mcp`, and no MCP-specific UI exists or should be invented. Sharing logic = share the
  broker, not the transport.
```

- [ ] **Step 2: Verify the claim still holds before committing**

Run: `grep -rn "localhost:8788\|/mcp\"" apps/web/src apps/workflows/trigger --include='*.ts' --include='*.astro' | grep -v airtable | grep -v mcp-capture || echo "no chat→mcp wiring"`
Expected: `no chat→mcp wiring`

- [ ] **Step 3: Surface, then commit** with Task 4's results commit (same file) or alone as `docs(plans): D7 — in-app chat bypasses MCP` (one-line Verification).

---

## Parked — Dan's side, do not start

- Removing `deploy` / `deploy:dev` / `secrets:sync:*` scripts and rewriting `wrangler.jsonc` per app → Dan is delivering these; expect instructions. When they arrive, CLAUDE.md §3.3 (`.dev.vars` rule), `shared/internal/oauth-setup.md` §6 deploy commands, and `r2-setup.md` all need the same-change update.
- Old openside-account workers get deleted → memories/runbooks naming `baseout-dev`, `baseout-server-dev`, `baseout-admin-dev`, `baseout-api-dev` go stale; update after the split lands, not before.
- Possible move of `apps/web/drizzle` to a shared migration package (undecided).
- DB moves (export → recreate → import); Dan warns first.

## Self-review

- Coverage: push ✅ (T1), branch convention ✅ (T2), docs trigger main-only + branch-testable ✅ (T3), MCP with fresh client ✅ (T4), chat≠MCP ✅ (T5), "keep working, don't touch Dan's areas" ✅ (constraints + parked list).
- No placeholders except the token value and probe results, which are runtime facts by design.
- Names consistent: branch `support-docs-ci-gate`, workflow `support-docs-check.yml`, token `copilot-smoke`, ports 8787/8788.
