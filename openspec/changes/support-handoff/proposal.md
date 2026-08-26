## Why

The support portal has no way to show what it does. It has to be *walked* — open the landing,
click a card, notice the sidebar narrowed, open a docs page, notice the notice, go back, switch the
variant, do it again. Every review of it so far has been a guided tour given live, and everything
not shown in that tour is invisible to the person reviewing.

That is the same problem `apps/design` solved in 2026-06 with the Flow Registry and `/handoff`, and
the reasoning there holds here unchanged: **a state is DATA, not a duplicated screen.** A new
variant is a row in a registry plus a URL that produces it — never a new page. The portal has no
such registry, so its states exist only in the heads of the two people who built it.

Two audiences need it, and they need the same artifact:

- **The client.** Dan's doubt about the documentation framework (2026-08-18) was really a doubt
  about *scaling past one platform*: "Airtable will not be the only platform." `PlatformPicker`
  answers that, and the answer is currently unshowable — you cannot see what the portal looks like
  with one platform next to what it looks like with five, because the portal only ever renders the
  three that exist.
- **The engineer.** Ticketing is about to add a second axis — signed-out, signed-in, verified by
  code, awaiting reply, closed — and the states multiply against the platform axis. Without an index
  that names them, half of them will be built and never seen again.

## What Changes

- **New route `/handoff` in `apps/support`**, plus `src/lib/handoff-registry.ts` — one canonical
  list of every state the portal can be in, each row tying the state to the URL that produces it,
  the OpenSpec scenario that specifies it, and the source file that renders it.
- **A platform-count comparison**: the same surface at 1 / 2 / 3 / 5 platforms, side by side, so the
  scaling behaviour is a thing you look at rather than a thing you are told.
- **An auth-and-ticket axis**: what an anonymous visitor sees when they want to file a ticket, what
  they see after filing, what a signed-in customer sees, and every state between. Rows exist for
  states that are not built yet — `planned` is a status, not an omission.
- **Excluded from the portal proper**: not in the header nav, not in the docs sidebar, not in the
  Pagefind index, not in the sitemap, `noindex`. It is a meta page about the product, not part of it
  — the same standing `apps/design`'s `/handoff` has.

## Capabilities

### New Capabilities
- `support-handoff`: a live state index for the support portal — every state addressable by URL,
  every row traceable to spec and source.

## Impact

- New files under `apps/support/src/` only. No change to any existing portal surface, and no change
  to `apps/web`.
- **Deploys publicly.** `support.baseout.com/handoff` will be reachable by anyone who knows the URL;
  there is no auth on this app to hide it behind. Stated rather than solved — it carries no secrets,
  and the portal it indexes is itself a pre-launch demo.
- **Depends on a content decision, not a technical one**: a five-platform view needs two platform
  identities that do not exist (see `design.md` §4). The change is buildable at 1 / 2 / 3 without
  them and gains the 5 column when they are decided.
