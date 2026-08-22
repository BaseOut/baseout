// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
    starlight({
      title: 'Baseout Support',
      description: 'Documentation, help, and the public roadmap for Baseout.',
      social: [{ icon: 'external', label: 'Baseout', href: 'https://baseout.com' }],
      /* The brand bridge — one sheet, four public apps (Oleh, 2026-08-17: the portal must be built
         from Baseout's own elements so a user sees one product). It maps Starlight's `--sl-*` surface
         onto Baseout tokens and is UNLAYERED, which is why it wins over Starlight's layered styles
         without a specificity fight. Read its header before changing anything in it — in particular,
         this must never be pointed at `apps/web/src/styles/global.css`: that sheet is ~3,300 mostly
         unlayered lines and would out-rank Starlight's reset, prose styles and layout at once. */
      /* The bridge first (shared by four public apps), then the portal's own sheet on top. Keep
         per-app rules OUT of the bridge — it is the one sheet the other three read too. */
      customCss: ['../../brand/baseout-bridge.css', './src/styles/support.css'],
      components: {
        Banner: './src/components/DraftBanner.astro',
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
        }
      ],
    }),
  ],
});
