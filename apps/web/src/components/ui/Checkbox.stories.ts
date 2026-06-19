import type { Meta, StoryObj } from '@storybook/html-vite';
import Checkbox from './Checkbox.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface CheckboxArgs {
  label?: string;
  name?: string;
  checked: boolean;
  disabled: boolean;
  value?: string;
}

const meta: Meta<CheckboxArgs> = {
  title: 'UI/Checkbox',
  loaders: [async ({ args }) => ({ html: await renderAstro(Checkbox, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { label: 'Include attachments', checked: false, disabled: false },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    value: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<CheckboxArgs>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { checked: true } };
export const Disabled: Story = { args: { disabled: true, label: 'Not available on this tier' } };

/** Every state in one frame. */
export const States: Story = {
  loaders: [
    async () => {
      const states = [
        { label: 'Unchecked', checked: false, disabled: false },
        { label: 'Checked', checked: true, disabled: false },
        { label: 'Disabled', checked: false, disabled: true },
        { label: 'Disabled + checked', checked: true, disabled: true },
      ];
      const parts = await Promise.all(states.map((s) => renderAstro(Checkbox, { props: s })));
      return { html: `<div class="flex flex-col gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
