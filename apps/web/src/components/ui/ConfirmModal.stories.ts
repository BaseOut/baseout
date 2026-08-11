import type { Meta, StoryObj } from '@storybook/html-vite';
import ConfirmModal from './ConfirmModal.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface ConfirmModalArgs {
  id: string;
  title: string;
  confirmLabel?: string;
  confirmHref?: string;
  confirmClass?: string;
  confirmIcon?: string;
  cancelLabel?: string;
  /** Story-only: becomes the dialog's default slot (peeled off before props). */
  body: string;
}

const sampleBody = `
  <p class="text-sm text-base-content/70">This starts a backup immediately instead of waiting for the next scheduled run.</p>
  <div role="alert" class="alert alert-soft alert-warning mt-3">
    <span class="iconify lucide--triangle-alert size-4"></span>
    <span>Off-schedule runs use <strong>additional credits</strong>.</span>
  </div>
`;

const meta: Meta<ConfirmModalArgs> = {
  title: 'UI/ConfirmModal',
  // The Container API does NOT run the dialog's showModal() script, so it renders
  // closed; the `play` function forces it open below (mirrors Modal.stories.ts).
  loaders: [
    async ({ args: { body, ...props } }) => ({ html: await renderAstro(ConfirmModal, { props, slots: body }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: {
    id: 'demo-confirm',
    title: 'Run a backup now?',
    confirmLabel: 'Run anyway',
    confirmHref: '#',
    confirmClass: 'btn-primary',
    confirmIcon: 'lucide--play',
    cancelLabel: 'Cancel',
    body: sampleBody,
  },
  argTypes: {
    id: { control: 'text' },
    title: { control: 'text' },
    confirmLabel: { control: 'text' },
    confirmHref: { control: 'text' },
    confirmClass: { control: 'text' },
    confirmIcon: { control: 'text' },
    cancelLabel: { control: 'text' },
    body: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<ConfirmModalArgs>;

const openPlay = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const dialog = canvasElement.querySelector('dialog.modal') as HTMLDialogElement | null;
  dialog?.showModal?.();
};

export const Default: Story = { play: openPlay };
export const Destructive: Story = {
  args: {
    title: 'Cancel this backup run?',
    confirmLabel: 'Cancel run',
    confirmClass: 'btn-outline btn-error',
    confirmIcon: 'lucide--x',
    body: `<p class="text-sm text-base-content/70">The run stops where it is. Everything captured so far is kept.</p>`,
  },
  play: openPlay,
};
