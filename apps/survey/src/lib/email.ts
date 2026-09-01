/**
 * Outbound email via the Resend HTTP API (no SDK — plain fetch).
 * Without RESEND_API_KEY (local dev) the message is logged to the dev server
 * console instead — the sanctioned dev fallback so both flows are fully
 * testable offline.
 */

// From-address is deploy-time config; needs the survey domain verified at Resend.
// The display name comes from `brand.ts` so the rename cannot leave the outbound mail behind: an
// email that still says the old title is the one place a stale name reaches somebody's inbox.
import { EDITION, SCORE_NAME, SCORE_SHORT, REPORT_NAME } from './brand';
import { IS_PROVISIONAL } from './maturity';

const FROM = `${EDITION} <survey@baseout.com>`;

export async function sendMagicLink(env: Env, email: string, url: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console -- dev-only fallback: surfaces the magic link when no email provider is configured
    console.log(`[survey][dev] magic link for ${email}: ${url}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `Pick up your ${EDITION} survey`,
      text: `Click to continue your survey where you left off:\n\n${url}\n\nThis link signs you in and expires shortly. If you didn't request it, you can ignore this email.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}

/** One practice, as it is printed in the report and as it is printed in the email. */
export interface ReportLine {
  label: string;
  /** What the respondent actually said, verbatim. */
  answer: string;
  /** 0 to 3. */
  score: number;
}

export interface ReportPayload {
  score: number;
  band: string;
  blurb?: string;
  dimensions: ReportLine[];
  recommendations?: string[];
}

/**
 * THE FINISH PAGE, IN AN INBOX. Dan: *"We could maybe have them email their audit to them and it
 * could just be a button, because we already have the email."*
 *
 * PLAIN TEXT, and that is a decision rather than a shortcut. This is somebody's own record of what
 * they answered; it has to survive being forwarded, quoted, and read in a client that blocks HTML,
 * and there is nothing in it that a layout would say better than a column of labels and numbers.
 *
 * IT SAYS THE SCORE IS PROVISIONAL WHENEVER THE PAGE DOES. `IS_PROVISIONAL` is the same flag that
 * puts the badge beside the number on screen, read here rather than re-decided, so the email cannot
 * quietly become the one place the number passes as settled. An email outlives the page it came
 * from, which makes it the worse place to overstate a measurement, not the better one.
 */
export async function sendReport(env: Env, email: string, report: ReportPayload): Promise<void> {
  const rows = report.dimensions.map(
    (d) => `  ${d.score}/3  ${d.label}\n         you said: ${d.answer}`,
  );
  const advice =
    report.recommendations && report.recommendations.length > 0
      ? `\n\nWHAT TO FIX FIRST\n\n${report.recommendations.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
      : '';
  const caveat = IS_PROVISIONAL
    ? `\n\nA note on the number: the per-option points and the band cutoffs are provisional. The six practices scored are the survey's canonical core index, but the rubric that turns them into a score out of 100 is not finalised, so read this as a reading rather than as a settled grade. ${REPORT_NAME} will publish the rubric it was scored against.`
    : '';

  const text = `Here is your ${SCORE_SHORT}, and the six practices it was cut out of.

${SCORE_NAME}: ${report.score} / 100
Band: ${report.band}${report.blurb ? `\n${report.blurb}` : ''}

WHAT WE MEASURED (six practices, 0 to 3 each)

${rows.join('\n\n')}${advice}${caveat}

Thank you for taking the survey.
${EDITION}`;

  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console -- dev-only fallback: surfaces the report when no email provider is configured
    console.log(`[survey][dev] report for ${email}:\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `Your ${SCORE_SHORT}: ${report.score}/100, ${report.band}`,
      text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}
