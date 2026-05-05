export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailEnv {
  email: SendEmail | undefined
  from: string | undefined
  dev: boolean
  logger?: Pick<typeof console, 'info'>
}

export async function sendEmail(input: SendEmailInput, env: SendEmailEnv): Promise<void> {
  if (env.dev) {
    // `npm run dev` (astro dev / Vite): log the magic link to the terminal so
    // developers can click it without a real mail relay. `npm run wrangler`
    // runs the built worker on Cloudflare's edge where import.meta.env.DEV is
    // false, taking the real-send branch below.
    // eslint-disable-next-line no-console
    ;(env.logger ?? console).info(
      `[email:dev] to=${input.to} subject=${JSON.stringify(input.subject)}\n${input.text}`,
    )
    return
  }

  if (!env.email) {
    throw new Error('EMAIL binding is not available; cannot send email.')
  }
  if (!env.from) {
    throw new Error('EMAIL_FROM is not set; cannot send email.')
  }

  await env.email.send({
    from: env.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
}
