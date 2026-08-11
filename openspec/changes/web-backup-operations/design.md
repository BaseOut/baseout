# Design — Backup operations

## A run is a log, not a document

The central decision the founder confirmed: a backup run is an **immutable record of what happened**, like a line in an audit log, not a file you manage. That single stance removes a whole category of UI we might otherwise have drawn — there is no Delete (you don't delete history), no Rename, no Run-again-from-this-row (a re-run is a new event, started from the top-level Run Backup Now, not an edit of an old one). The only things you can do to a run are the things you can do to an event that is *still happening*: pause it, or stop it. Everything else is read-only.

This also means the only way data ever leaves the system is the **cleanup schedule** (retention). Keeping deletion in exactly one place — an aging policy, not a button next to each run — is what makes the "immutable log" promise true and auditable.

## Two run statuses the audit trail didn't have

`web-backups-redesign` modelled three run states: done / running / failed. Adding Pause and Cancel introduces two more outcomes the list and detail must show:

- **`paused`** — a run held mid-flight. It is not done and not failed; it is waiting to resume. Counts captured so far are shown.
- **`cancelled`** — a run the user stopped. Under the default semantics (below) the partial data is kept, so a cancelled run shows the counts it reached, plus a clear "stopped by you" framing distinct from a failure.

Both are non-alarming, neutral statuses (not red like `failed`).

## Restore: the outcome is the honest part

The flow itself (base → tables → existing-or-new base → new tables) is straightforward. The part that earns trust is the **end**, not the steps. Because Airtable's API recreates records well but rebuilds structure/relationships only partially, a restore that silently "finished" would mislead. So restore ends on an **outcome report**: tables recreated, records landed, and an explicit list of what the engine could not rebuild (linked-record relationships, specific field types) with guidance to finish it by hand, plus a link into the new/target base. This is the one restore screen that was missing entirely and is the most important to get right.

## Cleanup ladder, made legible

Retention is genuinely complex (a four-tier downsampling keyed to frequency). The UI does not ask the user to understand GFS; it shows the **resulting ladder** for their chosen frequency as plain language ("30 days of daily, then 2 months of weekly, then monthly, removed after 5 years") and updates it live when they change frequency. The cutoff is the one knob (1 / 2 / 5 years / never). The mechanism stays in the engine; the UI states the consequence.

## What the predecessor (On2Air) actually did

On2Air is Baseout's predecessor (same founder), so where it had a behaviour we can either inherit it or consciously improve it. Read from the On2Air help center (2026-06-19):

- **Cleanup / retention** — On2Air's ladder is **exactly** what we built (Continuous: 3 days → 27 days daily → 2 months weekly → monthly; Daily: 30 days → 2 months weekly → monthly; Weekly: 3 months → monthly; Monthly → cutoff; cutoff default 5 years). Attachments are **incremental** (all on the first backup, new-only after). Crucially, in On2Air these tiers and the cutoff read as **fixed system behaviour**, not user-configurable. Our Options UI adds a configurable cutoff knob — a small step beyond On2Air.
- **Restore** — On2Air confirms our model. Airtable's own restore **always creates a new base and never overwrites**. On2Air's tool restore is explicitly partial: **Formula fields cannot be recreated via the API** (rebuild by hand) and some fields come back as **text** to convert back. On2Air restores at the base level (into a new base via a Workspace ID, or an existing one); our per-table selection is a Baseout refinement. No credits, pause, or cancel on restore in On2Air.
- **Failure notifications** — On2Air **sent failure emails** (connection / permission problems) and ran a post-backup **Backup Audit** (checks the Airtable connection, the storage connection, and per-base / table / attachment status), with monthly audit emails and an on-demand audit. This is real precedent for our missing failure-notification story, and the seed of the Health/insights differentiator.
- **No precedent for Pause / Cancel of a run.** On2Air backups simply run and log; there is no in-flight control. So our Pause/Restart + Cancel is genuinely **new** — the client cannot point to "how it worked before", which is exactly why the semantics below are open.
- **Billing was plan-based, not credits.** On2Air gated frequency by plan (hourly / daily / weekly / monthly). Credits are a **new** Baseout concept with no predecessor metering to copy.

## Client decisions (confirmed 2026-06-20)

The founder answered the question list. Outcomes:

1. **Cancel → KEEP the partial data**, run status `cancelled`. ✅ Locked, and already built (the cancelled run shows its partial counts).
2. **Pause/Restart → RESUME from where it stopped**, not from scratch. ✅ Locked, already built (Resume action on a paused run). Note: the founder's word is "Restart"; we label the button "Resume" for clarity (same behaviour) — flagged, trivially renamable.
3. **A finished run is read-only** — no Delete, no per-row Run-again; the only deleter is cleanup; a fresh backup is the top-level Run-now. ✅ "correct". Locked, already built.
4. **Credits → NOT finalised.** The founder confirms credits will be **per-task and volume-based** (e.g. ~100 credits per 1000 records backed up) and that **the off-schedule warning we built is sufficient for now** — so do NOT build a balance / out-of-credits UI yet. Restore likely costs credits too (each task type does), but no restore credits UI for now. Usage stays a placeholder until the model is finalised.
5. **Cleanup → keep it as built**: On2Air tiers fixed, the cutoff the one configurable knob. ✅ "looks good how you implemented".
6. **Restore → matches**, PLUS one new section: an **Attachments option**. When restoring, the user chooses to restore attachments **as attachments** (re-upload the files into Airtable) or **as links** (links to the files kept in the backup destination). Built into the restore flow; default **as attachments**.

**Still open / deferred (next round):**
- **Credits model** finalisation (cost per task, balance, out-of-credits behaviour) — see #4. The current warning is enough until then.
- **Run control by role** — viewers read-only is our assumption; the role boundary was not raised this round.
- **Failure notifications + post-run audit** (`backups-failure-notification`) — pulled from this round, carried over. On2Air precedent stands (failure emails + a monthly Backup Audit), feeding the Health Score / Notifications direction.

## Data feasibility

Consistent with the project's no-fabrication guardrail:

- **Run status incl. paused / cancelled, captured-so-far counts** — the backup engine, recorded as it writes.
- **Restore outcome (recreated tables, records landed, un-rebuildable structure)** — the restore engine's own result; the "partial structure" limit is a real Airtable API constraint, not a guess.
- **Attachments restore (as attachments vs as links)** — both are real engine choices: the files already live in the backup destination, so "as attachments" re-uploads them into Airtable and "as links" points the field at the destination copy. No fabricated data.
- **Credits** — NOT yet modelled (per-task, volume-based, not finalised — see Client decisions #4); the UI shows the acknowledgement, not a fabricated balance, until the metering exists.
- **Retention ladder** — derived from the configured frequency + cutoff; no external data needed.
