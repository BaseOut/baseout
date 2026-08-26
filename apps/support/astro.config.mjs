// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import markdoc from '@astrojs/markdoc';
import { pruneSitemap } from './integrations/prune-sitemap.mjs';

// The docs IA is organised by what a reader is TRYING TO DO, not by the app's own
// navigation. Sections map to jobs (back something up · get it back · look inside it ·
// something is wrong), which is why Sources and Destinations share one section even
// though the app lists them separately, and why Schema and Data stay apart even though
// the app groups them under one Space.
//
// Every page is currently a stub. The draft affordance is a single site-wide banner,
// rendered by src/components/DraftBanner.astro (which overrides Starlight's Banner
// slot) — read that file before removing it.
export default defineConfig({
  site: 'https://support.baseout.com',
  /* `/submit` and `/tickets` were both real pages and both are now one destination. A portal that
     404s a URL it published is a portal people stop linking to — and `/tickets` in particular is
     the address the chat's own out-of-messages line pointed at. */
  redirects: {
    '/submit': '/contact',
    '/tickets': '/contact',
    /* Both were published pages, folded into the platform page each belongs to. A portal that 404s
       a URL it published is a portal people stop linking to — and the Notion one in particular is
       the address you paste to somebody whose connection finds nothing. */
    '/platforms/airtable/tokens-and-oauth': '/platforms/airtable/connecting/#which-to-use',
    '/platforms/notion/sharing-with-the-integration':
      '/platforms/notion/connecting/#sharing-with-the-connection',
  },
  integrations: [
    /* MARKDOC IS THE PORTAL'S COMPONENT SYNTAX (Oleh, 2026-08-24, deciding §5 of
       `openspec/changes/support-portal/research-docs-language-2026-08-20.md`). `markdoc.config.mjs`
       beside this file holds the ruling, the three tags and the version pins; read it before
       touching either.
       TWO THINGS DEPEND ON THIS LINE BEING HERE, and both fail silently without it. Starlight's
       `docsLoader()` adds `mdoc` to its content glob only when it finds an integration NAMED
       `@astrojs/markdoc` in `context.config.integrations`, so removing this does not error — it
       deletes every `.mdoc` page from the site. And a `{% %}` tag in a file the integration does not
       claim is not a build failure either: it is printed to the reader as literal text. Order in
       this array does not matter; the loader reads the resolved config, not the position. */
    markdoc(),
    /* `/handoff` IS A META PAGE ABOUT THIS PORTAL, NOT A PAGE OF IT, and four places would
       otherwise absorb it. Three of the four exclusions are elsewhere and named here so the set is
       findable from one place: it is never added to `components/Header.astro`'s NAV list (three
       destinations is the measured budget at 390); it is not a content-collection entry so it never
       reaches the docs sidebar; and `lib/search-modal.ts` carries `handoff` in NOT_DOCS beside
       `tickets`. This is the fourth: it will be public, and it should not be FOUND. The page also
       carries `noindex`, which is the other half — `noindex` asks a crawler not to keep the page, a
       sitemap entry asks it to come and look, and shipping one without the other says both. */
    pruneSitemap(['/handoff/', '/handoff/emails/']),
    starlight({
      title: 'Baseout Support',
      description: 'Documentation, help, and the public roadmap for Baseout.',
      /* TWO MANUALS, ONE CONFIGURED TREE. Starlight 0.40 has no per-section `sidebar` option — the
         config below is one global tree, and the only per-page override it documents is the
         `sidebar` prop on `<StarlightPage>`, which is for hand-written `.astro` pages and cannot
         reach a content-collection entry. Route middleware is the supported mechanism for a content
         page: it runs on every render with the built route data in hand and `starlightRoute.sidebar`
         is writable. `src/routeData.ts` partitions THIS array by top-level group label — the product
         manual on one side, the `API` and `MCP` groups at the foot of it on the other — so a reader
         inside the API manual never sees the ten product chapters and vice versa. Read that file
         before renaming either group: the partition is by label, and a rename here alone puts the
         API group back into the product sidebar with every gate green. */
      routeMiddleware: './src/routeData.ts',
      /* THE ONE ICON BESIDE THE THEME PICKER POINTS AT `/handoff`, not at baseout.com (Oleh,
         2026-08-21). It used to be a way OUT of the portal, which is the one thing a support
         site does not need another of — the brand is already a link in the site title. It is
         now the way into the scenario catalogue, which is the page this portal is reviewed
         from. Consequence, stated once: `/handoff` stays out of the nav, the sidebar, the
         search and the sitemap, but this makes it REACHABLE by anyone who opens the portal.
         Accepted — it carries no secrets and the portal is a pre-launch demo. */
      social: [{ icon: 'external', label: 'Portal handoff', href: '/handoff/' }],
      /* The brand bridge — one sheet, four public apps (Oleh, 2026-08-17: the portal must be built
         from Baseout's own elements so a user sees one product). It maps Starlight's `--sl-*` surface
         onto Baseout tokens and is UNLAYERED, which is why it wins over Starlight's layered styles
         without a specificity fight. Read its header before changing anything in it — in particular,
         this must never be pointed at `apps/web/src/styles/global.css`: that sheet is ~3,300 mostly
         unlayered lines and would out-rank Starlight's reset, prose styles and layout at once. */
      /* The bridge first (shared by four public apps), then the portal's own sheet on top. Keep
         per-app rules OUT of the bridge — it is the one sheet the other three read too. */
      customCss: ['../../brand/baseout-bridge.css', './src/styles/support.css'],
      /* THE SESSION STAMP, BEFORE THE FIRST PAINT AND ON EVERY PAGE.
         `lib/portal-session.ts` is the authority on whether somebody is here, and until now only
         `/requests/` and `/contact/` stamped it — they were the only surfaces that cared. The header
         cares now, and the header is on all 128 pages, so the stamp has to be too.

         IT IS INLINE IN `head` RATHER THAN A MODULE, for the reason that file already argues: a
         module cannot run before the document is parsed, and a header that paints "Sign in" at a
         reader who is signed in has already told them the wrong thing. This is the third copy of
         those four lines (the other two are `contact.astro` and `portal-session.ts` itself) and the
         duplication is deliberate and noted in all three: pre-paint code cannot be imported.

         ABSENT OR MALFORMED READS AS `in`, matching `readSession()` exactly. Change one, change all
         three. */
      head: [
        {
          tag: 'script',
          content:
            "var s=new URLSearchParams(location.search).get('session');" +
            "document.documentElement.setAttribute('data-portal-session',s==='out'?'out':'in');",
        },
      ],
      components: {
        Banner: './src/components/DraftBanner.astro',
        /* THE COMPACT TOGGLE REPLACES THE LABELLED SELECT EVERYWHERE IT IS RENDERED, not only in our
           header. Our `Header.astro` imports `ThemeToggle` directly (a `components:` override cannot
           reach inside it — that file's own header comment says so), but Starlight renders
           `ThemeSelect` a SECOND time in `MobileMenuFooter.astro`, which our header does not replace.
           Measured after wiring the header and before this line: 125 pages carried both controls, one
           of them still reading `Auto ▾`. Two controls for one preference is the variance this repo
           fights, and the one nobody meant to keep is the one that would drift. */
        ThemeSelect: './src/components/ThemeToggle.astro',
        /* THE MOBILE SHEET'S FOOTER RENDERS NOTHING (Oleh, 2026-08-26). It carried two unlabelled
           glyphs under the navigation tree: the `/handoff/` social link — an internal, `noindex`
           page written for whoever designs this portal, which keeps its place in the desktop header
           and has none in a customer's menu — and a THIRD copy of the theme toggle. The block above
           records catching that same footer once already and only making the two copies look alike.
           The component says the rest. */
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        /* The landing's dark band + the one search-or-ask input. Overriding Hero rather than
           putting a component in the mdx is what reaches the h1 size: Starlight's own Hero styles
           it in a COMPONENT-SCOPED sheet, so `--sl-text-h1` never applied and it rendered 64px. */
        Hero: './src/components/SupportHero.astro',
        /* Adds the Ask AI button beside the docs search; Starlight's own Search renders unchanged
           inside it. Oleh, 2026-08-18 (Stripe's docs): asking is the same job as searching, one
           step further along, so the pair belongs in the header rather than a floating bubble. */
        Search: './src/components/Search.astro',
        /* Lets the page contents fold into a list button while the chat drawer holds the width. */
        PageSidebar: './src/components/PageSidebar.astro',
        /* THE HEADER IS OURS NOW. The nav sits beside the brand rather than at the far right, which
           Starlight's grid cannot express — its first column is sized to the sidebar. `Header.astro`
           says what that costs. `SiteTitle` carries the inlined mark so it can follow the theme. */
        Header: './src/components/Header.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        /* Adds the page-rating block above Starlight's own footer, on documentation pages only.
           The override delegates the rest rather than re-implementing pagination, the edit link and
           the last-updated line to gain one block above them. */
        Footer: './src/components/DocsFooter.astro',
        /* The platform chips ride above the tree; the tree itself is still Starlight's. */
        Sidebar: './src/components/DocsSidebar.astro',
        /* The page says whose platform it is about before its first sentence, and says so again if
           the reader's own filter is what made it look unexpected. */
        PageTitle: './src/components/DocsPageTitle.astro',
      },
      sidebar: [
        {
          label: 'Start here',
          collapsed: true,
          items: [
            { label: 'Welcome', slug: 'index' },
            { label: 'What Baseout is', slug: 'start/what-baseout-is' },
            { label: 'How Baseout is organized', slug: 'start/how-baseout-is-organized' },
            { label: 'Getting started', slug: 'start/getting-started' },
            { label: 'Signing in', slug: 'start/signing-in' },
          ],
        },
        /* PLATFORM PAGES SIT IN THE CHAPTER THEY BELONG TO, not in a shelf of their own at the
           foot of the tree (Oleh, 2026-08-20). A shelf sorts by THING while every other group sorts
           by JOB, so the reader has to change gear halfway down a list with nothing on screen
           explaining the change — and it is the same set of pages the trunk already implies, sorted
           twice. ProBackup and Keepit do run shelves, at ten and fifteen platforms; at three they
           would only duplicate the structure above them.
           The filter is what keeps this readable: narrowed to one platform, each chapter holds
           exactly the pages for you, still in task order.

           THE NESTED GROUPS ARE NOT COLLAPSED, and that is deliberate against the chapters above
           them, which are. A chapter is collapsed because ten rows you did not ask for is noise; a
           three-row subject group is the unit the filter ACTS on, and a filter whose effect happens
           inside a folded box has no visible effect at all. Narrow to one platform and each of
           these keeps one row: that reshaping is the thing to be able to see. */
        {
          label: 'Backing up',
          collapsed: true,
          items: [
            { label: 'How backups work', slug: 'backups/how-backups-work' },
            { label: 'Schedule and scope', slug: 'backups/schedule-and-scope' },
            { label: 'Running a backup now', slug: 'backups/running-a-backup' },
            { label: 'Reading a backup run', slug: 'backups/reading-a-run' },
            { label: 'Retention and cleanup', slug: 'backups/retention-and-cleanup' },
            /* THE GROUP IS NAMED AFTER ITS SUBJECT, NEVER AFTER THE MECHANISM. It read "By platform"
               for one round, which names how the pages were sorted and tells a reader nothing about
               what is inside them (Oleh, 2026-08-20). The label is now the shared half of the pages'
               own titles, and the children are the platform names, so the row reads as one question
               with three answers: "What we back up" → Airtable, ClickUp, Notion. */
            {
              label: 'What we back up',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/what-we-back-up' },
                { label: 'ClickUp', slug: 'platforms/clickup/what-we-back-up' },
                { label: 'Notion', slug: 'platforms/notion/what-we-back-up' },
              ],
            },
            {
              label: 'How long a run takes',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/limits-and-timing' },
                { label: 'ClickUp', slug: 'platforms/clickup/limits-and-timing' },
                { label: 'Notion', slug: 'platforms/notion/limits-and-timing' },
              ],
            },
            {
              label: 'Deleted and archived items',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/deleted-items' },
                { label: 'ClickUp', slug: 'platforms/clickup/deleted-items' },
                { label: 'Notion', slug: 'platforms/notion/deleted-items' },
              ],
            },
          ],
        },
        {
          label: 'Restoring',
          collapsed: true,
          items: [
            { label: 'Restoring a base', slug: 'restore/restoring-a-base' },
            { label: 'Restoring attachments', slug: 'restore/attachments' },
            {
              label: 'Restoring your data',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/restoring' },
                { label: 'ClickUp', slug: 'platforms/clickup/restoring' },
                { label: 'Notion', slug: 'platforms/notion/restoring' },
              ],
            },
            /* Identifiers sit under Restoring rather than under a schema chapter because an id is
               only interesting when something has to be matched back to an original, and that is
               the restore. */
            {
              label: 'Identifiers and matching',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/identifiers' },
                { label: 'ClickUp', slug: 'platforms/clickup/identifiers' },
                { label: 'Notion', slug: 'platforms/notion/identifiers' },
              ],
            },
          ],
        },
        {
          label: 'Sources and destinations',
          collapsed: true,
          items: [
            { label: 'Sources', slug: 'connections/sources' },
            { label: 'Destinations', slug: 'connections/destinations' },
            { label: 'Reconnecting a broken connection', slug: 'connections/reconnecting' },
            {
              label: 'Connecting',
              /* ONE ROW PER PLATFORM, and that is the whole question this group asks. It shipped
                 with five rows: three platforms plus `Tokens and OAuth` and `Sharing with the
                 integration`, which are not platforms and are not peers of them. The two tails were
                 folded into the platform pages they belong to, and both old URLs redirect to their
                 anchor. */
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/connecting' },
                { label: 'ClickUp', slug: 'platforms/clickup/connecting' },
                { label: 'Notion', slug: 'platforms/notion/connecting' },
              ],
            },
            {
              label: 'What a connection can see',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/permissions' },
                { label: 'ClickUp', slug: 'platforms/clickup/permissions' },
                { label: 'Notion', slug: 'platforms/notion/permissions' },
              ],
            },
          ],
        },
        {
          label: 'Your schema',
          collapsed: true,
          items: [
            { label: 'Schema overview', slug: 'schema' },
            { label: 'Browse and descriptions', slug: 'schema/browse' },
            { label: 'Visualize and Relationships', slug: 'schema/visualize-and-relationships' },
            { label: 'Automations and Interfaces', slug: 'schema/automations-and-interfaces' },
            { label: 'Schema changelog and Health', slug: 'schema/changelog-and-health' },
            { label: 'Schema docs and Chat', slug: 'schema/docs-and-chat' },
            {
              label: 'Field and property types',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/field-types' },
                { label: 'ClickUp', slug: 'platforms/clickup/field-types' },
                { label: 'Notion', slug: 'platforms/notion/field-types' },
              ],
            },
          ],
        },
        {
          label: 'Your data',
          collapsed: true,
          items: [
            { label: 'Data overview', slug: 'data' },
            { label: 'Browsing records', slug: 'data/records' },
            { label: 'Attachments', slug: 'data/attachments' },
            { label: 'Comments', slug: 'data/comments' },
            { label: 'Data changelog', slug: 'data/changelog' },
            { label: 'Presets and export', slug: 'data/presets-and-export' },
            {
              label: 'Attachments and files',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/attachments' },
                { label: 'ClickUp', slug: 'platforms/clickup/attachments' },
                { label: 'Notion', slug: 'platforms/notion/attachments' },
              ],
            },
            {
              label: 'Comments and discussions',
              items: [
                { label: 'Airtable', slug: 'platforms/airtable/comments' },
                { label: 'ClickUp', slug: 'platforms/clickup/comments' },
                { label: 'Notion', slug: 'platforms/notion/comments' },
              ],
            },
          ],
        },
        {
          label: 'Reports and notifications',
          collapsed: true,
          items: [
            { label: 'Reports', slug: 'reports/reports' },
            { label: 'The Inbox', slug: 'notifications/inbox' },
          ],
        },
        /* THE HALF THE FILTER MUST NEVER TOUCH. Managing your account, signing in and being billed
           are identical whoever you back up, and the client named this cluster on a call as the one
           he wanted to see grown. Not one page under here carries a `platform:` tag, which is what
           makes narrowing to Notion leave the whole chapter standing: a filter that hid a billing
           page would be answering a question nobody asked. The two nested groups are nested for the
           ordinary reason, that eight billing and organization rows flat under five account ones
           reads as one undifferentiated list. */
        {
          label: 'Your account',
          collapsed: true,
          items: [
            { label: 'Settings', slug: 'account/settings' },
            { label: 'Profile and email', slug: 'account/profile' },
            { label: 'Sign-in methods', slug: 'account/sign-in-methods' },
            { label: 'Sessions and devices', slug: 'account/sessions' },
            { label: 'Two-factor authentication', slug: 'account/two-factor' },
            { label: 'Deleting your account', slug: 'account/deleting-your-account' },
            {
              label: 'Your organization',
              items: [
                { label: 'Joining an organization', slug: 'account/organization/joining' },
                { label: 'Members and roles', slug: 'account/organization/members-and-roles' },
                { label: 'Invitations', slug: 'account/organization/invitations' },
                {
                  label: 'Transferring ownership',
                  slug: 'account/organization/transferring-ownership',
                },
              ],
            },
            {
              label: 'Plans and billing',
              items: [
                /* `account/billing.md` keeps the `/account/billing/` URL it published under, so the
                   inbound link from Schedule and scope still resolves. Its title changed from
                   "Plans and billing" to "Plans and limits" because the group now carries the
                   former, and a group and its first child sharing one label reads as a bug. */
                { label: 'Plans and limits', slug: 'account/billing' },
                { label: 'Changing your plan', slug: 'account/billing/changing-your-plan' },
                { label: 'Payment methods', slug: 'account/billing/payment-methods' },
                { label: 'Invoices and receipts', slug: 'account/billing/invoices' },
                { label: 'Cancelling', slug: 'account/billing/cancelling' },
              ],
            },
          ],
        },
        {
          label: 'Troubleshooting',
          collapsed: true,
          items: [
            { label: 'My backup failed', slug: 'troubleshooting/backup-failed' },
            { label: 'A run is slow or stuck', slug: 'troubleshooting/run-slow-or-stuck' },
            {
              label: 'A connection needs reconnecting',
              slug: 'troubleshooting/connection-needs-reconnecting',
            },
            { label: 'A connection finds nothing', slug: 'troubleshooting/connection-finds-nothing' },
            { label: 'My bases are missing from the picker', slug: 'troubleshooting/missing-bases' },
            { label: 'Attachments were skipped', slug: 'troubleshooting/attachments-skipped' },
            { label: 'A restore left gaps', slug: 'troubleshooting/restore-left-gaps' },
            {
              label: 'What Baseout cannot capture',
              slug: 'troubleshooting/what-baseout-cannot-capture',
            },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { label: 'Glossary', slug: 'reference/glossary' },
            { label: 'Status reference', slug: 'reference/statuses' },
            { label: 'Platform differences at a glance', slug: 'reference/platform-differences' },
            { label: 'FAQ', slug: 'reference/faq' },
          ],
        },
        /* ── THE SECOND MANUAL ────────────────────────────────────────────────────────────────────
           EVERYTHING BELOW THIS LINE IS HIDDEN FROM THE TEN CHAPTERS ABOVE IT, and they from it, by
           `src/routeData.ts`. It is declared here rather than built by hand in that file so that
           Starlight resolves the slugs, hrefs, labels, `isCurrent` flags and collapse state exactly
           as it does for every other group; the middleware only chooses which half a reader sees.

           Dan, 2026-08-21: "API and MCP documentation is a little different than 'how to use the
           app' documentation… I think we could create 1 new menu for 'API/MCP' and then have
           sections for both." One header item (`API`, see `components/Header.astro` for why the
           label is one word) leading to two groups is that shape.

           NOT COLLAPSED, against every chapter above. A collapsed chapter is right when the tree
           holds ten of them and you want the one you came for; this tree holds two groups and four
           rows in total, and folding four rows away leaves a sidebar that shows a reader nothing
           about the manual they just opened. */
        {
          label: 'API',
          items: [
            { label: 'Overview', slug: 'api' },
            { label: 'Anatomy of a reference page', slug: 'api/anatomy-of-a-reference-page' },
          ],
        },
        {
          label: 'MCP',
          items: [
            { label: 'Overview', slug: 'mcp' },
            { label: 'Anatomy of a tool page', slug: 'mcp/anatomy-of-a-tool-page' },
          ],
        },
        /* ── THE THIRD MANUAL ─────────────────────────────────────────────────────────────────────
           Same mechanism as the two groups above it: declared here, hidden from the other manuals by
           `src/routeData.ts`, which asks `lib/api-docs.ts` which manual a group label and a path
           belong to. That file stopped being a boolean on 2026-08-25 for exactly this entry.

           AUTOGENERATED, AND THAT IS THE WHOLE POINT OF THE YEAR DIRECTORIES. Starlight turns each
           subdirectory of `content/docs/changelog/` into a nested group named after it, so `2026`
           is a group because `2026/` is a folder, and January makes `2027` one without anybody
           editing this file. Writing the years out here would be a list that has to be remembered
           once a year, in the one place nothing tells you it was forgotten — the hub page derives
           its rows from the collection (`lib/changelog.ts`), so the two surfaces would simply
           disagree, both of them rendering.

           THE YEARS ARE NESTED RATHER THAN TOP-LEVEL because the partition in `routeData.ts` is by
           TOP-LEVEL LABEL: a year at the top level would be a label to register in `api-docs.ts`
           every January, and forgetting it puts that year's entries into the product manual's
           sidebar with every gate green. One stable label above the years costs nothing and cannot
           be forgotten.

           ORDERING INSIDE A YEAR IS DERIVED, AND SO IS THE MONTH LEVEL BELOW IT (2026-08-26).
           `sidebar.order` used to carry the rank and had drifted from the dates beside it — 1, 2, 3
           against 20, 24 and 21 August — so the sidebar was not newest-first while every comment
           said it was. `src/routeData.ts` now re-nests this group by month and sorts each month by
           the entry's own date; `lib/changelog.ts` carries both arguments. Nothing here declares a
           rank any more, and alphabetical filenames stay irrelevant, which was always the point of
           not using them: a slug is a URL, not a place to keep a number. */
        {
          label: 'Changelog',
          /* THE `autogenerate` IS NESTED IN `items` BECAUSE IT HAS TO BE: Starlight removed support
             for `{ label, autogenerate }` on a group in 0.39.0, and it is a hard config error rather
             than a silent one. A group with a label and an `items` array containing the autogenerate
             config is the replacement it names. */
          items: [{ autogenerate: { directory: 'changelog' } }],
        },
      ],
    }),
  ],
});
