# Integration patterns — Mobbin research (source-isolated)

**Source:** Mobbin only (web platform), via the Mobbin MCP. Kept separate on purpose so its quality can be judged against other sources. Every example links to its Mobbin screen/flow.
**Question:** which UI pattern to use for connecting + configuring + editing an integration, as one consistent app-wide pattern.
**Lens (5 things extracted per app):** (1) where connection lives · (2) where config lives (modal / page / inline) · (3) OAuth return · (4) edit vs first setup · (5) empty → connected transition.

---

## 1. Where connection lives

Two dominant homes, both evidenced:

- **A grid/list of provider cards** in a Settings → Integrations tab. Each card = logo + name + one-line value prop + a `Connect` button.
  - [Dovetail](https://mobbin.com/screens/9cca134b-6550-4855-8e26-781f17dd4f67) · [Miro](https://mobbin.com/screens/332ce966-a691-461a-becd-a89a29bb6cfa) · [Mural](https://mobbin.com/screens/298dfcfe-4d16-46df-a4e1-93b7c78de599) · [Charma](https://mobbin.com/screens/b8829590-0ca1-47ff-a6b1-1f9536ac5154)
- **A dense one-line list** (logo + name + per-row action button), better when there are many providers.
  - [Threads](https://mobbin.com/screens/cbad4fdc-fbcb-4fd7-b92d-d0000686debd) · [User Interviews](https://mobbin.com/screens/a663fa43-1fbe-4f01-a1cc-3525a6b75e70)

**For us (Airtable-only V1):** a single focused card is right; the grid is the future-proof container, not something to over-build now. The card→"Connected" card transformation is well-supported below.

---

## 2. Where config lives — the key decision

Mobbin shows a clear split by **config weight**:

- **Light connect (on/off, pick scopes):** inline row state-change or a **small modal**.
  - [Discord "Add Connection"](https://mobbin.com/flows/b1a177e6-0f77-4bc7-896b-52879740ee08) — modal grid of services → post-connect detail with toggles.
  - [Squarespace "Connecting an account"](https://mobbin.com/flows/7250b9c1-f318-47d9-8aa7-53a07536072b) — modal account picker → "You're Connected!" page.
- **Heavy config (choose data + options + validate):** a **dedicated page or large side-panel with steps**, never a cramped modal. This is our case.
  - [PlanetScale "Creating a workflow"](https://mobbin.com/flows/0d7c5dda-1633-4ea4-9345-2ec04efba4c4) — **the closest analog to us**: pick which **tables** (checkboxes: `my_table`, `my_table_2`, `products`) → **Advanced options** (DDL handling radios, defer-index toggle) → a live **"will replicate 336 KB from 3 tables"** summary → **Validate** → **Create workflow**. Also has an empty "No workflows yet" state.
  - [Neon "Importing a data"](https://mobbin.com/flows/a15904ee-ae55-46a9-b1bf-cfb6a3ac6924) — side-panel: **Check compatibility → Run Checks → Import**, with a **connection-string** field, a **"Cannot connect to the source database"** error state, and a **"Database import in progress"** banner.
  - [Fibery "Importing data into database"](https://mobbin.com/flows/9d7f8560-a1ab-4821-b123-7ff4db328f9d) — New/Existing toggle + **field-mapping** (checkbox per field + type dropdown + data preview) → "Import N items".

**Verdict:** the evidence backs our call — **heavy config belongs on a page/panel with a validate-then-commit step, not a modal.** Modals are only ever used for the *light* connect step.

---

## 3. OAuth return

Consistent pattern: a **dedicated confirmation**, not a silent redirect.

- [Base44](https://mobbin.com/flows/89fa5102-48d4-432f-8365-7508397657f6) — standalone **"Success! You can safely close this window now"** page (popup-window OAuth).
- [Squarespace](https://mobbin.com/flows/7250b9c1-f318-47d9-8aa7-53a07536072b) — returns to the product with a **"You're Connected!"** banner on the now-connected screen.

**For us:** matches the spec's "Connection succeeds → confirm + report N bases found." Note Base44 uses a *popup* window (so its parent page survives) — the alternative to our full-page redirect. Worth a deliberate choice.

---

## 4. Edit vs first setup

The "manage an already-connected integration" pattern is **a dedicated detail page** in the strongest examples — exactly the recommendation we landed on:

- [Linear — Slack integration detail](https://mobbin.com/screens/e64c901c-4ada-4f0a-b3a0-89a6ccf490da) — **best-in-class**: back-nav, header (ENABLED BY / SUPPORT / DOCS), "Connected workspaces · Connected ▾", then a **Settings** section with inline toggles (Linkbacks, Unfurls). One page serves status + edit; no wizard re-run.
- [Attio — integration detail](https://mobbin.com/screens/0eaf7c47-f12f-47ca-97cd-133787b64db1) — sectioned page: **Scopes · Access tokens · OAuth · Webhooks · Delete integration**. Settings-style, all sections in place.
- [Qatalog](https://mobbin.com/screens/4f88fe2c-5d76-4d38-a6bb-9bcf72c564f7) — **accordion-in-place**: expand a provider row → "What can you do" + `Connect` / `Disable`. A lighter middle-ground (no navigation).
- [Sana AI](https://mobbin.com/screens/b1499283-b6cb-4ba3-bc66-82a1d16e123f) — manage-connected as a **modal**: "Last synchronized: Today 11:30am", `Synchronize`, `Disconnect`. Works because Sana's config is light.
- [Charma](https://mobbin.com/screens/b8829590-0ca1-47ff-a6b1-1f9536ac5154) — connected card shows "✓ Connected" + a **`…` overflow menu** for manage/disconnect.

**Pattern that fits us:** Linear's model — **the connected card/row links to a dedicated detail page that opens with all sections in place (edit), not a forced wizard.** Quick actions (Run, Disconnect) live on the card/row.

---

## 5. Empty → Connected transition

The card mutates in place once connected:

- [Miro](https://mobbin.com/flows/cfe4e9a7-c3a6-45d5-8cdd-f206a2c8388e) — `Connect` button → row shows the **account email + "Log out"** after connecting.
- [Charma](https://mobbin.com/screens/b8829590-0ca1-47ff-a6b1-1f9536ac5154) — `Connect` → **"✓ Connected"** + `…` menu.
- [Threads](https://mobbin.com/screens/cbad4fdc-fbcb-4fd7-b92d-d0000686debd) — per-row state ladder: `Sign in` / `Enable` / **`Connected ✓`** / `Setup`.

**For us:** the empty "Connect Airtable" card becomes a "Connected" card carrying status (account, last sync, next run) + a ⚙/`…` to the detail page.

---

## Direct hits on our founder-call deltas

Mobbin independently surfaced evidence for nearly every delta we'd specced:

| Our delta | Evidenced by |
|---|---|
| **API-key alternative to OAuth** | [Threads "Generate API Key"](https://mobbin.com/screens/cbad4fdc-fbcb-4fd7-b92d-d0000686debd); [Neon connection-string field](https://mobbin.com/flows/a15904ee-ae55-46a9-b1bf-cfb6a3ac6924) |
| **Read-only access promise** | Base44 connectors labelled **"Read only"** ([flow](https://mobbin.com/flows/89fa5102-48d4-432f-8365-7508397657f6)) |
| **Recovery / reconnect state** | [Cohere "Reauthorize"](https://mobbin.com/flows/f5803790-2882-46a4-a03f-08a9467d5d48) on a broken connector |
| **Dynamic / BYODB destination** | [Neon connection-string import](https://mobbin.com/flows/a15904ee-ae55-46a9-b1bf-cfb6a3ac6924); [Fibery existing-DB import](https://mobbin.com/flows/9d7f8560-a1ab-4821-b123-7ff4db328f9d) |
| **Select which data (bases/tables)** | [PlanetScale table checkboxes](https://mobbin.com/flows/0d7c5dda-1633-4ea4-9345-2ec04efba4c4); [Fibery field-mapping](https://mobbin.com/flows/9d7f8560-a1ab-4821-b123-7ff4db328f9d) |
| **Verify-after / "Save & Test"** | PlanetScale **Validate → Create**; Neon **Run Checks** before import |
| **Error & in-progress states** | Neon "Cannot connect to source database" + "import in progress" banner |
| **Plan-gated upgrade affordance** | [Mural "Upgrade to connect"](https://mobbin.com/screens/b9091ea6-6cfd-42b6-9205-3f52484a09ea) on locked integrations |

---

## What Mobbin covered well vs gaps

**Strong:** connect surfaces, OAuth confirmation, connected-card states, dedicated edit pages (Linear/Attio), and — unexpectedly — heavy data-sync config (PlanetScale/Neon/Fibery) that we feared it wouldn't have. It even matched niche deltas (read-only labels, reauthorize, connection string, validate-before-run).

**Gaps:** no true Fivetran/Airbyte connector wizard (no per-source "select tables → schedule → destination" end-to-end); no example of **static + dynamic destinations in parallel**; scheduling/frequency config barely appears (most examples are one-shot imports, not recurring backups). For those, supplement with the web report.

---

## Implication for our design

The Mobbin evidence **supports the pattern we proposed**:

1. **Overview = card** that goes empty → "Connected" with status + quick actions (Miro/Charma/Threads).
2. **Heavy config = dedicated page/panel** with a **validate-then-commit** step (PlanetScale/Neon), not a modal.
3. **Edit = a dedicated detail page opened with all sections in place** (Linear/Attio), reached from the card — not a re-run wizard.
4. Keep **modals only for the light connect step** (Discord/Squarespace).

App-wide rule this generalizes to: *status + quick actions on a card; full configuration on its own route serving both setup and edit; validate before committing.*
