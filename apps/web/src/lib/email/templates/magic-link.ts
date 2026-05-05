export interface MagicLinkEmailInput {
  url: string
  email: string
  productName?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMagicLinkEmail(input: MagicLinkEmailInput): RenderedEmail {
  const productName = input.productName ?? 'Baseout'
  const safeUrl = escapeHtml(input.url)
  const subject = `Your sign-in link for ${productName}`

  const text = [
    `Sign in to ${productName}`,
    '',
    'Click the link below to sign in. This link expires in 5 minutes and can only be used once.',
    '',
    input.url,
    '',
    'If you did not request this email, you can safely ignore it.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Sign in to ${escapeHtml(productName)}</h1>
    <p style="margin: 0 0 16px;">Click the button below to sign in. This link expires in 5 minutes and can only be used once.</p>
    <p style="margin: 0 0 24px;">
      <a href="${safeUrl}" style="background: #111; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block;">Sign in</a>
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; color: #555;">Or paste this URL into your browser:</p>
    <p style="margin: 0 0 24px; font-size: 13px; color: #555; word-break: break-all;">${safeUrl}</p>
    <p style="margin: 0; font-size: 12px; color: #888;">If you did not request this email, you can safely ignore it.</p>
  </body>
</html>`

  return { subject, html, text }
}
