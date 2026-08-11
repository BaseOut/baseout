/**
 * Join-request notification emails (web-signup-domain-association).
 * Same rendered-email shape as templates/magic-link.ts.
 */

import type { RenderedEmail } from './magic-link'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface JoinRequestAdminEmailInput {
  organizationName: string
  requesterEmail: string
  productName?: string
}

/** Sent to each org owner/admin when a join request is created. */
export function renderJoinRequestAdminEmail(
  input: JoinRequestAdminEmailInput,
): RenderedEmail {
  const productName = input.productName ?? 'Baseout'
  const subject = `${input.requesterEmail} requested to join ${input.organizationName} on ${productName}`

  const text = [
    `${input.requesterEmail} has requested to join your organization "${input.organizationName}" on ${productName}.`,
    '',
    'Review the request from your organization settings. Pending requests expire after 7 days.',
    '',
    'If you do not recognize this person, decline the request.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">New join request</h1>
    <p style="margin: 0 0 16px;"><strong>${escapeHtml(input.requesterEmail)}</strong> has requested to join your organization <strong>${escapeHtml(input.organizationName)}</strong> on ${escapeHtml(productName)}.</p>
    <p style="margin: 0 0 16px;">Review the request from your organization settings. Pending requests expire after 7 days.</p>
    <p style="margin: 0; font-size: 12px; color: #888;">If you do not recognize this person, decline the request.</p>
  </body>
</html>`

  return { subject, html, text }
}

export interface JoinRequestApprovedEmailInput {
  organizationName: string
  productName?: string
}

/** Sent to the requester when an org admin approves their request. */
export function renderJoinRequestApprovedEmail(
  input: JoinRequestApprovedEmailInput,
): RenderedEmail {
  const productName = input.productName ?? 'Baseout'
  const subject = `You've joined ${input.organizationName} on ${productName}`

  const text = [
    `Your request to join "${input.organizationName}" on ${productName} was approved.`,
    '',
    `You are now a member. Sign in to switch to ${input.organizationName}.`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Request approved</h1>
    <p style="margin: 0 0 16px;">Your request to join <strong>${escapeHtml(input.organizationName)}</strong> on ${escapeHtml(productName)} was approved.</p>
    <p style="margin: 0;">You are now a member. Sign in to switch to ${escapeHtml(input.organizationName)}.</p>
  </body>
</html>`

  return { subject, html, text }
}
