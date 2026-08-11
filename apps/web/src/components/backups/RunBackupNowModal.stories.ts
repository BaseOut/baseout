import type { Meta, StoryObj } from '@storybook/html-vite';
import RunBackupNowModal from './RunBackupNowModal.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Backups/RunBackupNowModal',
  // The credits-warning confirm for an on-demand backup (a ConfirmModal configured
  // for the "run off-schedule = extra credits" case). The Container API renders the
  // dialog closed; `play` forces it open.
  loaders: [
    async () => ({ html: await renderAstro(RunBackupNowModal, { props: { id: 'demo-run-now', spaceId: 'spc_demo', redirectTo: '/?status=running' } }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const dialog = canvasElement.querySelector('dialog.modal') as HTMLDialogElement | null;
    dialog?.showModal?.();
  },
};
