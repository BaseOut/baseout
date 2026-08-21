import type { Meta, StoryObj } from '@storybook/html-vite';
import Drawer from './Drawer.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * Drawer — a slide-over panel on daisyUI's drawer primitive (see /styleguide → Drawer).
 * Open/close is pure CSS (a `<label for={id}>` or `getElementById(id).checked = true`).
 * The Container API runs no scripts, so these render the closed markup with the panel
 * surface, header (title + subtitle), body slot, and optional footer slot.
 */

const meta: Meta = {
  title: 'UI/Drawer',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const EndPanel: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(Drawer, {
        props: { id: 'sb-drawer-demo', title: 'Failed attachments', subtitle: "3 files couldn't be backed up." },
        slots: { default: '<p class="text-sm">Slotted body content goes here.</p>' },
      }),
    }),
  ],
};

export const BottomSheet: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(Drawer, {
        props: { id: 'sb-drawer-sheet', title: 'Details', side: 'bottom' },
        slots: { default: '<p class="text-sm">A bottom fly-out sheet.</p>' },
      }),
    }),
  ],
};
