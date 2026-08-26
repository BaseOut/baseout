# Transactional emails

Three templates: the **acknowledgement** a submission from `/contact/` triggers, a **support reply**
from a human, and the **login link** into the support-only account a submission creates.

They were greyscale skeletons until **2026-08-24**. They are now designed, on the product's own
palette, and `partials/head.mjml` still carries the token table so that any colour in this directory
can be checked against a real one rather than taken on trust.

**The shape**, and it is the same in all three:

```
  GROUND     #f6f7fb, and the footer sits on it, OUTSIDE the card
  MASTHEAD   #03111d in BOTH themes, the logo left and the desk name right
  CARD       #ffffff, 1px hairline, 12px corner, 32px of padding
```

A near-white ground means the card clears it by 1.07:1, so **the card's edge is the hairline**, not
the fill. Remove that border and the card stops existing; it is the first thing to check if this ever
looks wrong. The ground is `--bo-root-bg`, the portal's own page floor, which resolves to `#f6f7fb`.

**The masthead is pinned to one dark value in both themes**, and that single decision deletes the
hardest problem in dark-mode email. A logo drawn for a white card is wrong on a dark one, so a
card-coloured masthead forces two image files, a `display` swap and an Outlook conditional to stop
both showing at once. Pin the band and the logo has one ground, one colourway and one file. In dark
the band measures 1.01:1 against the card, so a `#27272a` hairline under it draws the edge the tone
cannot.

**Both themes ship.** A second solved palette in the product's own dark tokens, never the light one
inverted, under `@media (prefers-color-scheme: dark)`. What that is worth depends on the client:
Apple Mail, Outlook for Mac and iOS, Superhuman, Hey and Fastmail honour it exactly; Gmail and
Outlook.com invert on their own terms and read no media query, so the two `<meta>` tags and
`color-scheme: light dark` are the only lever that reaches them, and they *reduce* rewriting rather
than prevent it; Outlook on Windows reads none of it and stays light permanently, which is correct
rather than degraded. `[data-ogsc]` for Outlook.com is deliberately absent, and the reason is in
`partials/head.mjml`.

**The rest of what the design commits to:**

- **Restrained colour, and the order is the design.** Colour marks three things and no fourth:
  identity (the logo), what can be acted on (the button, every link), and the one string the reader
  copies (a full-bleed band). The four semantic hues are absent because none of these three emails
  reports a state; when one does, it takes the soft pair from the bridge rather than a new colour.
- **A band marks what gets copied, and which band says how much it matters.** The acknowledgement's
  reference is the payload, so it gets the soft-primary band (`#d0e2ea`). The login link's URL is the
  *fallback* for its button, so it gets the neutral band (`#edeef2`) and does not argue with it. The
  reply has nothing to copy and gets no band, which is also why it is the quietest of the three: a
  person wrote its payload, and an email that decorates a human's sentences reads as though the
  sentences were generated.
- **A band is not a nested card.** The wireframe's receipt was a filled box with a corner radius
  floating inside the white card, which DESIGN.md prohibits by name. A band has no border and no
  radius and touches both edges: it divides the document the way a masthead does.
- **One theme, light.** An email has no theme control and is read on a ground the reader's client
  chose. A dark block would be a second surface nobody here can verify, which is what DESIGN.md
  refuses. `color-scheme: light` is declared instead: the one dark-mode instruction that is honoured
  rather than guessed at.
- **The receipt is a ledger.** A hairline-ruled two-column table, which is the product's own
  signature surface, at the product's table density (14px values under 12px uppercase labels).
- **Nothing carries a side stripe.** The quoted history had a 2px left border; that is banned by name.
  It is a 1px rule and a label now, which is also the quoting idiom every mail client draws.
- **No webfont.** Urbanist fails silently in Outlook, so half the readership would see a different
  email from the other half and neither half would know. The hierarchy is carried by the brand's own
  rung set (12 · 13 · 14 · 16 · 20 · 24), which does more of that work than the face does.

## The logo, and why an image is allowed here at all

`apps/support/public/email/baseout-logo-onink@2x.png`, rasterised from the brand kit's own
`apps/web/public/images/logo/logo-dark.svg` at 240x64 and shown at 120x32. Four decisions, each of
which is the reason the next one is survivable:

1. **PNG, not SVG.** Gmail strips SVG; Word, and therefore Outlook on Windows, cannot draw it. No
   format works everywhere, so the choice is which one fails, and PNG fails only where images are
   blocked.
2. **Flattened onto `#111111`, not transparent.** Older Outlook composites a transparent PNG onto
   black often enough that it is not worth the risk. The band is that colour, so a baked ground is
   invisible.
3. **An absolute URL.** A relative path resolves against nothing in an inbox. The URL is the
   production host, written out. **The local preview rewrites the origin** so the reviewer sees the
   real file instead of a broken image; that rewrite lives in `src/lib/email-previews.ts` and says so
   at the line where it happens. The file on disk keeps the absolute URL, and `emails:check` still
   diffs against a fresh compile, so the bytes in the repo are the bytes that would be mailed.
4. **The alt text is styled**, which is the part people skip. Where images are blocked, the alt
   renders as the wordmark in the dark theme's teal at 20px, so the masthead degrades to a typeset
   wordmark rather than to a broken-image box. Without this, an image masthead would be a defect for
   the reader most likely to be reading it.

**To look at them.** Two places, and they are not duplicates:

- **`/handoff/`, the `Emails` section** — the overview. All three at once, each beside its subject
  line, its variable list and its plain-text part. This is where you see what the deliverable
  contains.
- **`/handoff/emails/`, the viewer** — one email at a time, centred on a neutral grey, with a
  **desktop / mobile** width toggle above it. This is where you look at one properly. Both the email
  and the width live in the URL (`?email=reply&width=mobile`), so a link produces the state it names.
  The surround is a fixed neutral regardless of the portal's theme: a dark backdrop behind a white
  email tints the judgement being made about the email.

Run the build below first — both pages say so plainly if you have not.

## Why this directory, and why it is not under `src/`

`apps/support/src/` is Astro's world: content collections, route globs and the Pagefind index all
walk it. An `.html` file living there is a page waiting to be published, and a `.txt` beside it is a
file the search index will happily read. None of these are pages. `emails/` sits beside `src/`, is
walked by no glob in `astro.config.mjs`, and is built by its own script.

## Files

| | |
|---|---|
| `*.mjml` | The source. Every argument that decides the copy is in the file's own header comment. |
| `*.html` | The compiled output, **committed**. If MJML is ever abandoned we keep three working emails rather than a dead format and a build step nobody can run. |
| `*.txt` | The plain-text part. **Not optional** — it is the only version that survives a corporate gateway that strips HTML, and transactional mail meets those gateways constantly. |
| `*.subject.txt` | One line, the subject. Kept out of the body files so that neither can accidentally be sent as the other, and so a subject is greppable on its own. |
| `partials/head.mjml` | The one `mj-attributes` head. Type, colour and spacing, once. |
| `../public/email/*.png` | The masthead logo. Not in this directory because it has to be **served**, and `public/` is what this app serves. |

## Build

```bash
pnpm --filter @baseout/support emails        # compile every .mjml → .html beside it
pnpm --filter @baseout/support emails:check  # recompile to a temp dir and diff — fails on a stale .html
```

`--config.allowIncludes true` is required: MJML 5 refuses `mj-include` without it.
`--config.keepComments false` is required for a different reason: without it every argument written
in these files' headers is emitted into the compiled HTML and mailed to customers. Both flags are in
the script, so there is nothing to remember. MJML's own `<!--[if mso]>` conditionals survive the
strip: they are emitted after it, and the compiled files carry thirty to thirty-six of them.

**`keepComments false` does not reach inside `mj-raw`, and it leaked in the very first build these
files produced.** `mj-raw` means *pass this through verbatim*, so a comment written inside one is not
a comment MJML parses and therefore not a comment it can strip. Four design arguments were sitting in
the shipped `acknowledgement.html` on that basis, i.e. in the HTML that would have been mailed. The
fix is to write comments as ordinary children of the MJML tree, never wrapped in `mj-raw`; the only
`mj-raw` left in this directory is the one in `partials/head.mjml`, which exists to emit two real
`<meta>` tags. **The check that catches a regression** is to grep the compiled HTML for any comment
that is not an MSO conditional:

```bash
grep -o "<!--[^[].\{0,120\}" emails/*.html | grep -v "<!--<\!\[endif\]-->" | grep -v "^.*:<!-->"
```

It should print nothing.

`emails:check` exists because a committed build artefact rots silently. Someone edits the `.mjml`,
does not run the build, and the `.html` that actually gets sent is last week's. The check is the only
thing that can tell you.

## The rules these three obey

**No email names how long anything will take.** Not a number, not a soft adverb, not a claim about
what we usually manage. Each one names the channel, the address, and the event that ends the wait.
The single exception is the login link's own lifetime, which describes a key we control rather than
an answer we have not written yet. The check is a grep over this directory — and a comment that
*quotes* one of the banned phrases fails it exactly as a promise would, which is why no file here
spells them.

**The acknowledgement's subject is ours.** It carries the reference and a fixed phrase, and it never
echoes what was submitted. A public form that mails an attacker-chosen subject from our domain to an
address the attacker picked is a mail bomb with our reputation behind it, and the subject line is the
part that lands in a victim's inbox list without being opened. The body may quote what they wrote,
and does.

**The reference travels in the subject of the reply.** Threading headers are retained about thirty
days by the systems we are copying; after that `References` / `In-Reply-To` stop matching. A durable
id in the subject is what survives, and it is the only handle a customer can quote back at us.

**No "reply above this line" delimiter.** The ruling and its cost are argued at the top of
`reply.mjml`.

**Never an invented person.** `{{ author_name }}` is a real name or the literal `Baseout Support`.

**Register.** Direct, second-person, no exclamation marks. This is a utility admin tool.

## Template variables

`{{ name }}`, double-brace. Neither Mailgun nor Cloudflare imposes a syntax — Cloudflare Email
Routing posts whatever HTML you hand it and substitutes nothing — so this is a convention we are
choosing, and we choose the one Mailgun's own Handlebars-based templating already speaks. MJML passes
braces through untouched, so the same string survives compilation.

Each template lists the variables it needs at the top of its own file. Optional ones are named there
as optional, and the rule for them is **omit the row, never blank it**: a receipt line reading
`About: —` is the form asking its optional question again at the point where nothing can be done
about it.

## Two headers the templates cannot carry

The acknowledgement and the login link are machine-sent and must go out with
`Auto-Submitted: auto-generated` (RFC 3834), which also stops a well-behaved correspondent's client
from answering them. The reply is written by a person and must **not** carry it — marking a human
reply as automatic is how it lands in a bulk folder. This is set by the sending code; it is written
down here because this directory is what someone reads when they wire the send.

## Where the colours come from

`partials/head.mjml`, once, and every value in it is named beside the `brand/baseout-bridge.css`
token it comes from. That table is the reason a reviewer can tell a real colour from an invented one
without opening the bridge, and it is why the redesign was applying a table rather than picking a
palette.

Whichever palette is in force, the values are **literals**. Mail clients do not run custom properties
— Outlook on Windows renders through Word, which resolves nothing — so a `var()` here is an unstyled
email. There is also no webfont: Urbanist is deliberately absent, because a downloaded face is a
design decision and it fails silently in Outlook, which would show two different emails depending on
where you opened one.

## What has not been verified, and cannot be from here

Nobody in this repo has rendered these in a mail client. No claim is made about how they look in
Gmail or Outlook. Two things need a human with real accounts before these go live, and they are the
two places a responsive email actually breaks:

1. **Gmail's dark theme.** Gmail inverts colours on its own terms — partially, inconsistently between
   the web client and the mobile apps, and without regard to `prefers-color-scheme`. A light card on
   a light page can come back as dark text on a dark card with the borders lost. Check the muted grey
   (`#646464`), the divider (`#d5d7de`) and the quoted-history rule specifically; those are the three
   that go invisible first.
2. **Outlook on Windows.** It renders through Word, not a browser: no web fonts (Urbanist will fall
   back), no `border-radius` on the button, and padding it interprets its own way. MJML emits the VML
   fallbacks that make this survivable, but survivable is a claim to test, not to assume.

Also unverified: the plain-text parts have not been read through a client that shows only them, and
the `{{ }}` substitution has not been run through Mailgun or a Cloudflare Worker, because neither
exists in this repo.
