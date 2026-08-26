# Research — WHERE DO DOCS, SUPPORT, TICKETS AND THE BOARD LIVE? (2026-08-19)

**Why this exists.** Our three service links (`Get in touch`, `Tickets`, `Roadmap`) sit in a group
called *Portal* at the BOTTOM of an eleven-group documentation sidebar, under *Reference*. Oleh,
2026-08-19: "який сенс йому бачити цей розділ прям там… я заплутався". Before moving them we looked
at how portals with millions of users arrange the same four things.

**Method.** Twelve live portals read directly (header markup and page structure, not screenshots of
marketing pages): Stripe · Vercel · Linear · Airtable · GitHub · Notion · Figma · Slack · Zapier ·
Raycast · Tailscale · Craft · 1Password · Upwork · Grammarly. Plus Canny's own implementation
guidance, since it is the platform most of these boards run on.

---

## 1 · What every one of them does: docs and support are SIBLINGS joined by a header

Not one of the twelve puts "contact support" or a feedback board inside the documentation's own
sidebar tree. The sidebar is documentation; everything else is a header item.

| Portal | Header carries |
|---|---|
| Linear | Docs · Developers · Learn · **Contact support** |
| Airtable | **Contact support** · Sign up |
| Zapier | **My Requests** · **Contact Support** · Sign in |
| Craft | **Submit a request** (as a button) |
| 1Password | **Support** as a top-level item of the main site nav |
| Upwork | Help Home · **Known Issues** · Resources |
| Vercel | Resources → Learn → Docs / Changelog; help page links out to community |
| Stripe | `docs.stripe.com` and `support.stripe.com` are separate sites entirely |

**The rule this expresses:** a sidebar answers "where in the manual am I". A service is not a place
in the manual. Putting one there means the person who came to report a broken backup has to scroll
past forty pages about backups first.

## 2 · "Contact" appears TWICE on purpose, and the second one is not redundant

Once in the header, and once at the foot of the help home as a "couldn't find it?" block:

- Notion — *"Still have questions?"*
- Figma — *"Couldn't find what you needed?"* → Contact support · Community forum
- Grammarly — *"Can't find your answer? Contact us"*
- Upwork — two cards side by side: *Contact Us* (log in) and *Ask Everyone* (community)

They serve different people. The header serves someone who arrived already knowing they need a
human. The bottom block serves someone who read and failed, at the moment they fail.

**We already have the second half** — the "Still stuck?" cards on the landing. What is missing is
the header half.

## 3 · The feedback board is a SIBLING of the knowledge base, never a child of it

[Tailscale](https://tailscale.com/contact/support) is the clearest instance and the closest to our
shape — three sibling cards on one support page:

> Search the Knowledgebase · Existing bugs · Feature requests

Canny's own guidance says the board lives on its own portal and you *link to it* from the product or
the help centre — it is a destination, not a section of the docs.

## 4 · Bugs and feature requests are separated AT THE DOOR — and this confirms a call we already made

Tailscale splits them into two cards before anything is typed. Canny's guidance states the reason
plainly: *"feature requests are almost never urgent, while bug reports can be, and many teams prefer
to keep their bug reports separate from feature requests."*

Our `/submit` fork ("something is broken" vs "something I wish existed") was argued from a PRIVACY
premise — a bug report carries someone's data and must not land on a public board. The sweep says
the same split is standard practice for an operational reason too. **Two independent reasons for
one decision; it stays.**

## 5 · Status and release notes live in the FOOTER or a marketing menu — never in the docs sidebar

- Figma — footer: *Releases*, *Status*
- Notion — footer: *Status*; *What's new* as a SECTION on the help home, not a nav item
- Vercel — *Resources → Changelog*; status as a live "All systems normal" pill on the help page
- Raycast — footer: *Changelog*, *Troubleshooting*, *Contact*

**Consequence for us:** when a Baseout changelog exists it is a footer link plus a block on the
landing, not a sidebar group. It does not need to block the navigation change.

## 6 · The finding that CORRECTS our own plan: "open one" and "see mine" are different destinations

[Zapier](https://help.zapier.com/hc/en-us) is the only portal in the sweep with a real public ticket
system, and its header carries **both**: `My Requests` and `Contact Support`.

That is not the duplication our sidebar has. Ours is `Get in touch` and `Tickets` where `/tickets`
is a landing page whose primary button links to `/submit` — two doors into one room. Zapier's two
are genuinely different things: a FORM anyone can use, and a LIST that needs sign-in.

**So the earlier recommendation ("merge them") was half right.** The correct move is not a merge, it
is a re-cut along the same line Zapier uses:

- **Contact** = `/submit`, the fork and both forms. No account. This is the header item.
- **My tickets** = what `/tickets` should become: the signed-in list, and nothing else. It stops
  being a landing page that re-explains and starts being the thing its name promises.

## 7 · Nobody leads with chat, and that is worth knowing before Dan asks again

All twelve lead with SEARCH. Where a messenger exists (Intercom-powered portals, Jasper) it is a
floating widget in a corner, not the front door. Stripe's header pair — search beside an ask — is
the modern form of the same idea, and it is what we already built.

---

## What this says our navigation should be

**Header:** `Documentation · Roadmap · Contact` — plus `Changelog` when one exists, and `My tickets`
which only makes sense once sign-in does.

**Sidebar:** documentation only. The *Portal* group is deleted from it.

**Landing, at the foot:** the "Still stuck?" cards stay, and gain the third card the sweep says
belongs there — the board, as a sibling of the knowledge base rather than a thing found in a menu.

**Footer:** status and changelog, when they exist.

### The one cost worth naming before agreeing

Starlight has no top-nav slot. `social` is the only header affordance it ships, and it takes icons.
A real nav means overriding a FIFTH component (`SiteTitle`, which owns the left of the header, or
`Header` itself). Every override is a piece of Starlight we now own and must re-check on upgrade;
four is already more than the framework expects. It is worth it here — the alternative is leaving
services buried where a reader has been told twice they are hard to find — but it is not free, and
`Header` is the riskiest of the five because it owns the responsive collapse.
