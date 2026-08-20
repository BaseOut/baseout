import type { Meta, StoryObj } from '@storybook/html-vite';
import CodeInput from './CodeInput.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * CodeInput — a short numeric code (2FA challenge, code-gated disable).
 * /styleguide → Primitives → "Code input (6-digit)".
 *
 * One real <input> carries the value; the aria-hidden cells are painted from it
 * by lib/auth/codeInput.ts (paste / backspace / auto-advance are native). The
 * Container API does not run the component's <script>, so these frames show the
 * resting structure — the live painting is validated in apps/design.
 */
interface CodeInputArgs {
  name?: string;
  length?: number;
  label?: string;
  invalid: boolean;
  disabled: boolean;
  autofocus: boolean;
  hint?: string;
  hintTone?: 'muted' | 'error';
}

const meta: Meta<CodeInputArgs> = {
  title: 'UI/CodeInput',
  loaders: [async ({ args }) => ({ html: await renderAstro(CodeInput, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    name: 'code',
    length: 6,
    label: 'Six-digit verification code',
    invalid: false,
    disabled: false,
    autofocus: false,
  },
  argTypes: {
    name: { control: 'text' },
    length: { control: { type: 'number', min: 4, max: 8 } },
    label: { control: 'text' },
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' },
    autofocus: { control: 'boolean' },
    hint: { control: 'text' },
    hintTone: { control: 'radio', options: ['muted', 'error'] },
  },
};
export default meta;

type Story = StoryObj<CodeInputArgs>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: 'Enter the 6-digit code from your authenticator app.', hintTone: 'muted' },
};

/** Wrong code — every cell takes the error border, with the reason below. */
export const Invalid: Story = {
  args: {
    invalid: true,
    hint: "That code didn't work — codes refresh every 30 seconds.",
    hintTone: 'error',
  },
};

/** Lockout — dimmed and not accepting input, with the wait spelled out. */
export const Disabled: Story = {
  args: { disabled: true, hint: 'Try again in 4:38. You can use a backup code now.', hintTone: 'muted' },
};
