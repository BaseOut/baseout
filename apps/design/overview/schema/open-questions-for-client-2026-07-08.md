# Schema — open specification questions

_2026-07-08. The Schema section is functionally built across all 8 tabs. This list captures the
product decisions that are **not yet specified** — flows, edge cases, and settings we can build
next but need your call on. Cross-cutting themes first (decide once, applies to several tabs),
then per tab. "Today" = what the UI does right now._

---

## Cross-cutting (decide once)

### X1 · Notifications & subscriptions — the biggest open area
Today: automations carry per-automation email subscribers, Health shows a score trend, Changelog
lists changes — but there is no way to be **notified** of anything, and no central notification
settings.
- Should users subscribe to **schema changes** (Changelog)? At what granularity — whole Space,
  per base, or per watched table/field?
- What actually triggers an **automation-subscriber email**? We can't observe automation *runs*
  (Airtable's API doesn't expose them), so is it "this automation was added / changed / removed
  in a backup diff," or is per-run notification out of scope?
- Do we want **Health alerts** — e.g. "notify me when a base drops below score X," or "on a new
  high-severity issue"?
- Where do notification preferences live — inline per entity, or a central **Settings ›
  Notifications** (recipients, immediate vs digest)?

### X2 · Export
Today: Visualize, Health, and Changelog each show an Export menu (PNG / PDF / JSON / CSV); none are
wired; Browse has none.
- Which exports ship first — a diagram **image** (PNG/PDF of the current view) vs a **data** dump
  (JSON/CSV of the schema / health / changelog)?
- Should export respect the **current filters/zoom**, or always emit the full schema?
- Should the **Browse** list (fields/tables inventory) be CSV-exportable too?

### X3 · "Open in Airtable" deep-links
Today: we store Airtable IDs for automations (`autXXX`), interfaces (`pblXXX`), and entities, but
nothing links out.
- Should automations, interfaces/pages, and (optionally) tables/fields carry an **"Open in
  Airtable"** link?

### X4 · Freshness of manually-maintained status
Today: automation **On/Off** and interface **Published** are entered by hand (the API can't export
them) and can silently drift from Airtable; the detail drawer shows a hardcoded "as of last backup"
with no date.
- Accept these as pure documentation, or add a **"last confirmed" date / reconcile-from-backup**
  step so users know when the status was last true?
- Should "as of last backup" show the **real backup date** and link to that run?

---

## Docs (priority)
Today: **New document** opens an editor, but there is **no Save** — the draft is discarded on
navigation; edits to existing docs also don't persist; the list is a flat, private notebook.
- **New doc:** blank editor, a **template picker**, or an **AI-drafted** starting point? What
  confirms the doc was created (appears in the list, count bumps)?
- **Saving:** autosave, or explicit **Save** + a "last saved" stamp + an unsaved indicator?
- **Organization:** flat list, or **folders / collections**?
- **Export / share / visibility:** PDF/Markdown export? a shareable link? per-doc "who can see
  this"? Or private-only for v1?
- **Diagrams:** can a user **insert** a scoped ER diagram while writing (pick tables → embed), or
  only view diagrams authored elsewhere?
- **Links:** should "Add link" support inline **edit / remove** per row (today it's add-only)?
- **Doc search:** should the Documents search **filter docs** by title/content? (Today it searches
  schema *entities* and opens the entity drawer instead.)
- **Per-entity docs:** from a table/field's "Documentation" section, offer **"Create a doc for this
  entity"** (opens the editor pre-tagged)?

## Chat & quick-ask
Today: the full Chat tab works. The header **"Ask about your schema"** quick-drawer can switch
threads and add context, but has **no input field and no send** — you must Expand into the full tab
to actually ask.
- **Quick-ask drawer:** a real **mini-composer** (type → reply inline), or intentionally a preview
  that always hands off to the full Chat tab via Expand?
- **Convert to doc:** what goes into the generated doc (full transcript / just the answer / a
  summary), and should it become a **real doc** that opens in the Docs editor?
- **Answer feedback:** keep the 👍/👎 on replies and route the signal somewhere, or drop for v1?
- **Chat settings:** expose model choice / credit usage / default context, or leave that to billing?

## Health
Today: the score is explained, but its **weights aren't editable**; per-metric exclude, prompt
overrides, re-run (10 credits), and insight archive are all preview-only; issues have no action
beyond "Open in Airtable."
- **Configurable scoring:** should score weights/rules be **user-configurable** (a real rules
  screen), or fixed by us — with only the Pro+ prompt edits as the customization lever?
- **Exclude a metric:** should toggling a metric off actually **re-weight and recompute** the grade
  live, or is that a Pro-rules concept, not an inline per-base toggle?
- **Issues:** can users **dismiss / mute / snooze** a specific issue (and does it stay suppressed
  next assessment), or is Health strictly advisory?
- **Per-entity overrides:** where do active scoring overrides **live and get surfaced/managed** (a
  list of what you've overridden), or is override a Space-level concept only?
- **Insights:** should **Archive** persist per user/space and feed a "dismissed" log, or is it a
  session-only declutter?
- (Health alerts → see X1.)

## Changelog
Today: filters and diffs work; there is no subscribe/notify; the empty state is explanatory only.
- **Subscribe / watch** for changes → see X1 (granularity).
- **Empty state:** CTA to run/schedule a backup (the thing that produces changelog data), or keep
  it purely explanatory?

## Relationships
Today: detection, confirm/dismiss, edit-synced, and facets all work — but an **empty** Relationships
tab hides the whole toolbar, including the only manual **"New synced relationship"** entry, and the
synced-relationship form fails silently on a missing field.
- On an empty tab, should we still offer **"Declare a synced relationship"** (the one relationship
  type users add by hand, since the API can't detect it)?
- Do we want visible **inline validation** ("Pick a table") on that form?

## Visualize
Today: the ER/graph renders and filters; **manual node arrangement is discarded** on the next
filter; Export is inert; "Add to doc" reports success but attaches nothing.
- Should a user's **manual layout be savable/persisted** per Space (survives filtering + reload), or
  is auto-arrange-only fine for a read-only inspector?
- When adding a diagram to a doc (especially a **new** doc created inline), should we jump the user
  into that doc — and does "New document" here create a real Docs entry?
- (Export → see X2.)

## Automations
Today: register / edit / tag / describe all work; On/Off + email subscribers persist in-session.
- **Subscriptions:** what real event notifies subscribers (X1), and do we need an account-level
  place to **see/manage all subscriptions** (recipients, opt-in, digest vs immediate)?
- Should each automation show its **steps / last-run**, or is trigger-type + tags the intended
  ceiling for a schema doc? (Open in Airtable → X3.)
- On/Off freshness → X4.

## Interfaces
Today: register / edit / describe / Published all work; pages nest under interfaces.
- The **page → automation `triggers`** link exists in the data (and drives the Visualize edges) but
  has no UI here — should the interface/page detail let users **view/edit which automations it
  triggers**, or is that link inbound-only and intentionally hidden?
- **Orphan pages** ("Pages without an interface"): offer an inline **"assign to interface"** action
  (bulk or per-row), or is editing each page individually acceptable?
- Should **Type** be locked (or warn) when editing an interface that already has child pages —
  switching it to "Page" breaks the parent-child tree?
- Published freshness → X4; Open in Airtable → X3.
