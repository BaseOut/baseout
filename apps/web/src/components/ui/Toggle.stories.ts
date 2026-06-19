import type { Meta, StoryObj } from '@storybook/html-vite';
import Toggle from './Toggle.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface ToggleArgs {
  label?: string;
  description?: string;
  name?: string;
  checked: boolean;
  disabled: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const meta: Meta<ToggleArgs> = {
  title: 'UI/Toggle',
  loaders: [async ({ args }) => ({ html: await renderAstro(Toggle, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    label: 'Enable scheduled backups',
    description: 'Automatically back up this Space on the chosen cadence.',
    checked: false,
    disabled: false,
  },
  argTypes: {
    label: { control: 'text' },
    description: { control: 'text' },
    name: { control: 'text' },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<ToggleArgs>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };
export const NoDescription: Story = { args: { description: undefined, label: 'Notify on failure' } };
export const Disabled: Story = { args: { disabled: true, checked: true } };

/** Every state in one frame. */
export const States: Story = {
  loaders: [
    async () => {
      const states = [
        { label: 'Off', checked: false, disabled: false },
        { label: 'On', checked: true, disabled: false },
        { label: 'Disabled (off)', checked: false, disabled: true },
        { label: 'Disabled (on)', checked: true, disabled: true },
      ];
      const parts = await Promise.all(states.map((s) => renderAstro(Toggle, { props: s })));
      return { html: `<div class="flex flex-col gap-4 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
