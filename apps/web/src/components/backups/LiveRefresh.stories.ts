import type { Meta, StoryObj } from '@storybook/html-vite';
import LiveRefresh from './LiveRefresh.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * LiveRefresh — the "updated Ns ago" freshness stamp + a soft-primary Refresh
 * button, used by the Backups and Restore logs' toolbars when a run is in flight.
 * The Container API runs no scripts, so the stamp renders at its initial "just now".
 */

const meta: Meta = {
  title: 'Backups/LiveRefresh',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  loaders: [async () => ({ html: await renderAstro(LiveRefresh, {}) })],
};
