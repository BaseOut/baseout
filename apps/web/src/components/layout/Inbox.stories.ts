import type { Meta, StoryObj } from '@storybook/html-vite';
import Inbox from './Inbox.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { inboxFixture, inboxEmptyFixture } from '../../../../design/src/fixtures/component-catalog';
import type { InboxItem } from './inbox';

interface InboxArgs {
  items: InboxItem[];
  asPage?: boolean;
}

const meta: Meta<InboxArgs> = {
  title: 'Patterns/Inbox',
  // The Container API does NOT run the panel's client `<script>` (wireInbox),
  // so counts/filters stay inert here — behaviour is exercised in apps/design.
  loaders: [
    async ({ args }) => ({
      html: await renderAstro(Inbox, { props: { items: args.items, asPage: args.asPage } }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { items: inboxFixture, asPage: false },
};
export default meta;

type Story = StoryObj<InboxArgs>;

// The panel renders `hidden` until the sidebar trigger opens it; the story
// unhides it so the structure is reviewable (same trick as Modal's play).
const openPlay = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const panel = canvasElement.querySelector('[data-inbox]');
  panel?.removeAttribute('hidden');
};

export const Default: Story = { play: openPlay };

/** No notifications backend yet — production mounts with the empty feed and these zero-states. */
export const Empty: Story = { args: { items: inboxEmptyFixture }, play: openPlay };

/**
 * Page mode (InboxView, web-notifications-inbox full-page promotion): the SAME rows /
 * lanes / filters rendered in the document flow — `<section class="ibx ibx-page">`, no
 * overlay chrome (no `hidden`, no close button, no `position:absolute`). Needs no
 * `openPlay` unhide because page mode never renders `hidden`.
 */
export const AsPage: Story = { args: { asPage: true } };
