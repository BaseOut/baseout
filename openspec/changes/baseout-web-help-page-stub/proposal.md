## Why

PRD §15.2 ("In-App Support Chatbot, V1") specifies a **placeholder** for V1: visible at launch, click opens a "Coming Soon" message with a contact-us mailto. The full chatbot lands V2.

Today the sidebar — both the footer nav entry "Help Center" and the profile-dropdown "Help" entries — link to `/help`. The route is unimplemented; visitors hit a 404. That's worse than a placeholder.

This change adds the placeholder page so the link works. It also keeps the existing sidebar wiring untouched (no churn in [`apps/web/src/components/layout/Sidebar.astro`](../../../apps/web/src/components/layout/Sidebar.astro)).

This is the seed of `baseout-web/tasks.md` §3 help-center stub work, pulled forward to today's evening sprint since it's a ≤20-minute polish item with high "first-impression" leverage at launch.

## What Changes

- **Add** [apps/web/src/pages/help.astro](../../../apps/web/src/pages/help.astro):
  - Renders inside `SidebarLayout` with breadcrumbs.
  - Single "Help & Support" card stating that the in-app chatbot is coming and inviting users to email the contact address from `app-config.json` `owner.email` (resolved via `getOwner()` in [`lib/config.ts`](../../../apps/web/src/lib/config.ts)).
  - Includes a `mailto:` button styled as `btn btn-primary` that pre-fills a subject like "Baseout — Help request".
  - No JavaScript. No client-state. Pure SSR.

## Capabilities

### New Capabilities

- None at the spec level — this is a UI placeholder. When the real chatbot lands (V2), it gets its own change folder with a proper SHALL/MUST contract; this change just unblocks the dead `/help` link in the meantime.

### Modified Capabilities

None.

## Impact

- New file: [apps/web/src/pages/help.astro](../../../apps/web/src/pages/help.astro).
- No DB / API / external-service changes.
- No `apps/server` interaction.
- No modifications to existing Sidebar or layout components.

## Reversibility

Fully reversible: deleting `apps/web/src/pages/help.astro` restores the prior 404 behavior. Sidebar links are unchanged.
