# Integration patterns — Web research (source-isolated)

**Source:** Web (vendor docs + product pages), not Mobbin. Kept separate so it can be compared side-by-side with `research-integration-patterns.mobbin.md`. Deliberately aimed at the **gaps Mobbin left**: the data-connector wizard, parallel destinations, scheduling, and the "connection" data model.
**Same lens (5 things):** (1) where connection lives · (2) where config lives · (3) verify/return · (4) edit vs setup · (5) empty → connected. Plus the gap topics.

---

## The canonical heavy-config flow (Fivetran / Airbyte)

These are the closest domain analogs to Baseout (move data out of a source on a schedule to a destination). Both put config on a **dedicated page/guided flow**, never a modal, and both end in an explicit **verify** step.

**Fivetran** — pick a connector tile → **Set up** → an embedded setup guide walks the config fields (vary by source) → the **Schema tab** lists schemas → tables → columns, each expand/collapse and activate/deactivate, with hash/block options → **Save & Test** (Fivetran verifies the connection before the first sync) → the **Settings tab** holds **Sync frequency** (anywhere from **1 minute to 24 hours**, or a **cron** schedule on supported plans). A partial form can be **"Saved for later."** ([setup overview](https://fivetran.com/docs/using-fivetran/fivetran-dashboard/connectors) · [schema tab](https://fivetran.com/docs/using-fivetran/fivetran-dashboard/connectors/schema) · [step-by-step blog](https://www.fivetran.com/blog/database-connector-setup-a-step-by-step-guide))

**Airbyte** — **New connection** → select **Source** → select **Destination** → a **schema table** where you toggle which **streams** sync, set **per-stream sync mode** (full refresh vs incremental) and cursor/primary key → choose a **sync frequency** (e.g. every 24h) → **Set up connection**. Crucially, **sources and destinations are created once as reusable objects** and a "connection" binds a source to a destination. ([add a connection](https://docs.airbyte.com/platform/1.8/move-data/add-connection) · [set up a connection](https://docs.airbyte.com/platform/using-airbyte/getting-started/set-up-a-connection) · [add a destination](https://docs.airbyte.com/platform/using-airbyte/getting-started/add-a-destination))

**Takeaways for us:**
- The **ordered flow** Connect → pick data → schedule → destination → **verify** is the industry standard — our `flows.html` diagram C matches it.
- **"Save & Test" / verify-after is a first-class step**, not an afterthought. Our "run first backup and confirm" should be framed as the verify step.
- **Save-for-later / resumable partial setup** is a real affordance worth copying for first-time users.

---

## 1. Where connection lives
- **Marketplace + settings page** (Vercel/Stripe): install a provider from a marketplace, which provisions and **lands you on the integration's settings page**. ([Stripe for Vercel](https://vercel.com/docs/integrations/ecommerce/stripe) · [Vercel Marketplace](https://vercel.com/marketplace/stripe/stripe))
- **Source catalog** (Fivetran/Airbyte): a searchable catalog of connector tiles; pick one to start setup.

For Airtable-only V1: a single focused card now; the catalog is the future container.

## 2. Where config lives
- **Dedicated page with tabs** is the heavy-config norm. A Fivetran connection detail page is tabbed: **Status · Schema · Settings (sync frequency) · Logs**. Airbyte's connection page similarly has Status / Schema / Settings tabs. → confirms config + management belong on a **dedicated route**, organized by tabs/sections, not a modal.

## 3. Verify / return
- **Save & Test** (Fivetran) and **Set up connection** that immediately triggers the first sync (Airbyte) give the user proof it works — the same trust beat as our "first backup succeeds → you're protected."

## 4. Edit vs first setup
- **Same dedicated detail page, tabbed, all sections in place.** Editing = open the connection's Settings/Schema tab and change in place; there is **no re-run of the setup wizard**. This corroborates Mobbin's Linear/Attio finding from a different source: *one page serves setup and edit.*
- Vercel/Stripe: a connected integration's settings page exposes **rotate API keys** and **Connect Project** — i.e. management actions live on the same settings surface. ([Stripe for Vercel settings](https://vercel.com/docs/integrations/ecommerce/stripe))

## 5. Empty → connected
- After install/setup the catalog tile / card flips to a **connected state** that links into the detail page; the source-of-truth for status is the detail page, the card is the summary.

---

## Gap topics Mobbin didn't cover

### Parallel destinations (our most distinctive requirement)
The industry **does** support fan-out to multiple destination *types* at once:
- **Stripe Data Pipeline** sends to **data warehouses** (Snowflake, Redshift, Databricks) **and** **cloud storage** (GCS, Azure Blob, S3). ([Stripe data pipeline](https://stripe.com/resources/more/cloud-data-warehouse-pipelines) · [docs](https://docs.stripe.com/data/access-data-in-warehouse))
- **Microsoft Fabric Dataflow Gen2** uses **"stage once, reference many"** and lets you **set a data destination per query**, mixing destinations within one flow. ([Fabric destinations](https://learn.microsoft.com/en-us/fabric/data-factory/dataflow-gen2-data-destinations-and-managed-settings))

**Pattern to adopt:** treat destinations as **independent, separately-authenticated objects**, and let one backup **fan out** to several (our static **+** dynamic in parallel). UX-wise: a "Destinations" section listing each configured destination with its own status, "+ Add destination," and an auth sub-step per destination — rather than a single-select. This is exactly the v2 reframe we drafted.

### Scheduling
- A **frequency picker** with discrete options plus **cron for power users** (Fivetran), ranging from near-real-time to daily. Plan-gating higher frequencies (our delta) is consistent with how these tools sell tiers. Frame locked frequencies as visible-but-upgradeable, not hidden.

### The "connection" data model → informs our open question
Airbyte's model (reusable **sources** + reusable **destinations**, a **connection** binds them) is the mainstream shape. It implies that **authenticating a source once and reusing it across multiple sync configs is the expected mental model** — which supports the diagrams' assertion that **Connect should be Org-level (auth once, reuse across Spaces)** rather than re-authed per Space. Worth raising as evidence on [open question: connection scope].

### Naming (Backup vs Sync)
Across these tools the recurring word is **"sync"** / **"connection"**, with "backup" reserved for point-in-time snapshots. Since Baseout does **both** a recurring mirror (sync) and restorable snapshots (backup), the naming split is real — evidence for resolving the [open question: naming] deliberately rather than using them interchangeably.

---

## Comparison: what each source gave

| Dimension | Mobbin | Web |
|---|---|---|
| Connect surfaces, cards, OAuth confirmation | **Strong** (real screens) | Adequate (described) |
| Connected-card states, empty→connected | **Strong** (Miro/Charma/Threads) | Weak |
| Dedicated edit/detail page | **Strong** (Linear/Attio) | **Strong** (Fivetran tabs) — corroborates |
| Heavy config: pick tables + validate | Good (PlanetScale/Neon) | **Strong** (Fivetran/Airbyte canonical) |
| **Scheduling / frequency** | Missing | **Covered** (Fivetran 1m–24h + cron) |
| **Parallel destinations** | Missing | **Covered** (Stripe/Fabric) |
| **Connection data model** | Implicit | **Explicit** (Airbyte) — informs scope question |
| Visual fidelity (actual pixels) | **High** (screenshots) | Low (text/docs) |

**Net:** Mobbin is better for *seeing real UI* and confirming our card/edit patterns with concrete screens; the web is better for the *systematic flow structure, scheduling, parallel destinations, and the underlying data model* that drive our two open questions. They're complementary — Mobbin shows the surface, the web explains the machine.

---

## Implication (consistent with the Mobbin report)

Both sources converge on the same recommendation:
1. **Overview = card** (status + quick actions) → flips empty → connected.
2. **Heavy config = dedicated, tabbed route** with an explicit **Save & Test / verify** step; resumable.
3. **Edit = same detail page, sections in place** — no wizard re-run.
4. **Destinations = independent objects, fan-out in parallel**, each with its own auth sub-step.
5. **Connect likely Org-level** (auth once, reuse) — take to the client as evidence on the scope question.
