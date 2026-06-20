import type { Meta, StoryObj } from '@storybook/html-vite';
import CreateSpaceModal from './CreateSpaceModal.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { createSpaceModalFixture } from '../../../../design/src/fixtures/component-catalog';

// CreateSpaceModal composes Modal and takes no props — it renders a `dialog.modal`.
// The Container API does NOT run Modal's client `<script>` that calls showModal(),
// so we force the dialog open in a `play` function to make the content visible.
interface CreateSpaceModalArgs {
  _noop?: never;
}

const meta: Meta<CreateSpaceModalArgs> = {
  title: 'Patterns/CreateSpaceModal',
  loaders: [async () => {
    void createSpaceModalFixture;
    return { html: await renderAstro(CreateSpaceModal) };
  }],
  render: (_args, { loaded }) => loaded.html,
  args: {},
  argTypes: {},
};
export default meta;

type Story = StoryObj<CreateSpaceModalArgs>;

export const Default: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const dialog = canvasElement.querySelector('dialog.modal') as HTMLDialogElement | null;
    dialog?.showModal?.();
  },
};
