// Report email send via the engine's EMAIL binding — server-reports task 5.
// Mirrors apps/web's sendEmail (the same Cloudflare Email Service rail). Throws
// when the binding/from is unset so delivery marks the recipient failed
// (re-sendable) rather than silently dropping the report.

import type { Env } from "../../env";
import type { ReportEmail } from "./delivery";

export async function sendReportEmail(
  env: Env,
  msg: { to: string } & ReportEmail,
): Promise<void> {
  if (!env.EMAIL) throw new Error("EMAIL binding is not available");
  if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM is not set");
  await env.EMAIL.send({
    from: env.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}
