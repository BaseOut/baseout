// Report delivery (per-recipient email) — server-reports task 5.
//
// One email per recipient (covering their requested formats), one
// report_deliveries row per (recipient, format). Delivery is link-only: the
// email carries authorized download links to the web app (which enforces
// session + membership), never binary attachments — this sidesteps the
// attachment-size fallback the design calls out and keeps the engine send small.
// A per-recipient send failure marks that recipient's rows `failed` (re-sendable)
// and never changes the generated report's status.
//
// The email builder is pure (tested); send + DB writes are injected deps.

import type { ReportRecipient } from "../../db/schema";
import type { InsertedDelivery } from "./store";

export interface ReportEmail {
  subject: string;
  html: string;
  text: string;
}

export interface BuildEmailInput {
  reportName: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  formats: ("pdf" | "html")[];
  viewUrl: string;
  manageUrl: string;
  recipientName?: string;
}

function fmtDate(iso: string): string {
  // Deterministic YYYY-MM-DD slice — avoids locale/tz nondeterminism in tests.
  return iso.slice(0, 10);
}

/** Build the report email (pure). Link-only; footer carries the manage link. */
export function buildReportEmail(input: BuildEmailInput): ReportEmail {
  const window = `${fmtDate(input.windowStart)} → ${fmtDate(input.windowEnd)}`;
  const subject = `Report: ${input.reportName} (${window})`;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const formatList = input.formats.map((f) => f.toUpperCase()).join(" · ");

  const text = [
    greeting,
    "",
    `Your report "${input.reportName}" for ${window} is ready.`,
    `View it: ${input.viewUrl}`,
    `Available formats: ${formatList}`,
    "",
    `Manage this schedule: ${input.manageUrl}`,
  ].join("\n");

  const html = [
    `<p>${greeting}</p>`,
    `<p>Your report <strong>${escapeHtml(input.reportName)}</strong> for ${window} is ready.</p>`,
    `<p><a href="${input.viewUrl}">View the report</a> — available as ${formatList}.</p>`,
    `<hr/>`,
    `<p style="font-size:12px;color:#666">`,
    `<a href="${input.manageUrl}">Manage this schedule</a>`,
    `</p>`,
  ].join("");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DeliverInput {
  runId: string;
  reportName: string;
  windowStart: string;
  windowEnd: string;
  recipients: ReportRecipient[];
  formats: ("pdf" | "html")[];
  suppressEmpty: boolean;
  /** Whether the window had any activity — used with suppressEmpty. */
  hadActivity: boolean;
  viewUrl: string;
  manageUrl: string;
}

export interface DeliverDeps {
  insertDeliveries(
    runId: string,
    rows: { recipientEmail: string; recipientKind: "member" | "external"; format: "pdf" | "html" }[],
  ): Promise<InsertedDelivery[]>;
  sendEmail(msg: { to: string } & ReportEmail): Promise<void>;
  markDelivery(
    id: string,
    status: "sent" | "failed",
    input: { error?: string | null; now: Date },
  ): Promise<void>;
  now(): Date;
}

export interface DeliverResult {
  sent: number;
  failed: number;
  skipped: boolean;
}

export async function deliverReport(
  input: DeliverInput,
  deps: DeliverDeps,
): Promise<DeliverResult> {
  if (input.suppressEmpty && !input.hadActivity) {
    return { sent: 0, failed: 0, skipped: true };
  }
  if (input.recipients.length === 0 || input.formats.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }

  const rows = input.recipients.flatMap((r) =>
    input.formats.map((f) => ({
      recipientEmail: r.email,
      recipientKind: r.kind,
      format: f,
    })),
  );
  const inserted = await deps.insertDeliveries(input.runId, rows);

  // Group delivery-row ids by recipient email (one email per recipient).
  const byRecipient = new Map<string, InsertedDelivery[]>();
  for (const row of inserted) {
    const list = byRecipient.get(row.recipientEmail) ?? [];
    list.push(row);
    byRecipient.set(row.recipientEmail, list);
  }

  let sent = 0;
  let failed = 0;
  const now = deps.now();

  for (const recipient of input.recipients) {
    const group = byRecipient.get(recipient.email);
    if (!group || group.length === 0) continue;
    const email = buildReportEmail({
      reportName: input.reportName,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      formats: input.formats,
      viewUrl: input.viewUrl,
      manageUrl: input.manageUrl,
      recipientName: recipient.name,
    });
    try {
      await deps.sendEmail({ to: recipient.email, ...email });
      for (const row of group) await deps.markDelivery(row.id, "sent", { now });
      sent += group.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const row of group) await deps.markDelivery(row.id, "failed", { error: message, now });
      failed += group.length;
    }
  }

  return { sent, failed, skipped: false };
}
