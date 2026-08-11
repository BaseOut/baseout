import type { Meta, StoryObj } from '@storybook/html-vite';
import Modal from './Modal.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface ModalArgs {
  id: string;
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  title?: string;
  open: boolean;
  /** Story-only: becomes the modal's default slot (peeled off before props). */
  body: string;
}

const sampleBody = `
  <p class="text-sm opacity-80">This Space will be permanently deleted along with all its connections and backup history. This action cannot be undone.</p>
  <div class="flex justify-end gap-2 pt-4">
    <button class="btn btn-ghost btn-sm">Cancel</button>
    <button class="btn btn-error btn-sm">Delete Space</button>
  </div>
`;

const meta: Meta<ModalArgs> = {
  title: 'UI/Modal',
  // The Container API does NOT run Modal's client `<script>` (the showModal() call),
  // so the dialog renders closed. The `play` function forces it open below.
  loaders: [
    async ({ args: { body, ...props } }) => ({ html: await renderAstro(Modal, { props, slots: body }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { id: 'demo-modal', size: 'md', title: 'Delete Space', open: false, body: sampleBody },
  argTypes: {
    id: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl', 'full'] },
    title: { control: 'text' },
    open: { control: 'boolean' },
    body: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<ModalArgs>;

const openPlay = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const dialog = canvasElement.querySelector('dialog.modal') as HTMLDialogElement | null;
  dialog?.showModal?.();
};

export const Default: Story = { play: openPlay };
export const Small: Story = { args: { size: 'sm', title: 'Confirm' }, play: openPlay };
export const Large: Story = { args: { size: 'lg', title: 'Connection details' }, play: openPlay };
export const NoTitle: Story = { args: { title: undefined }, play: openPlay };
