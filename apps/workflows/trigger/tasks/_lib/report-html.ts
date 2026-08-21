// Self-contained report HTML (pure, snapshot-tested) — workflows-reports task 1.1.
//
// Produces ONE HTML string with inline CSS and no external assets — the shared
// source for the HTML export and the PDF (renderPdf sets this as page content).
// It walks the document's sections in fixed order, renders each ReportSection
// (strip · stats · rows · clean line for empty sections), and resolves typed
// entity refs to absolute app deep-links. Consuming the same JSON the in-app
// view renders means the HTML, PDF, and web view cannot disagree.

import type {
  BackupRow,
  ConnectionRow,
  DocRow,
  ReportDataHealth,
  ReportDetail,
  ReportSection,
  ReportStat,
  ReportTrends,
  SchemaChangeRow,
  SectionStat,
} from "./report-types";

export interface RenderHtmlContext {
  /** apps/web origin for deep-links; when absent, refs render as plain text. */
  appBaseUrl?: string;
  spaceId?: string;
  /** Optional definition name for the header/title. */
  reportName?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function href(ctx: RenderHtmlContext, path: string): string | null {
  if (!ctx.appBaseUrl || !ctx.spaceId) return null;
  return `${ctx.appBaseUrl.replace(/\/$/, "")}/spaces/${ctx.spaceId}${path}`;
}

/** A link when we can build one, else the plain (escaped) label. */
function linkOr(url: string | null, label: string): string {
  const safe = esc(label);
  return url ? `<a href="${esc(url)}">${safe}</a>` : safe;
}

function toneClass(tone: string): string {
  return `tone-${tone}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function deltaHtml(d?: { dir: string; text: string; goodWhenUp?: boolean }): string {
  if (!d) return "";
  const good =
    d.dir === "flat"
      ? "flat"
      : (d.dir === "up") === (d.goodWhenUp ?? true)
        ? "good"
        : "bad";
  return ` <span class="delta delta-${good}">${esc(d.text)}</span>`;
}

function statsRow(stats: SectionStat[]): string {
  if (stats.length === 0) return "";
  const cells = stats
    .map(
      (s) =>
        `<div class="stat"><div class="stat-label">${esc(s.label)}</div>` +
        `<div class="stat-value ${s.tone ? toneClass(s.tone) : ""}">${esc(s.value)}${deltaHtml(s.delta)}</div></div>`,
    )
    .join("");
  return `<div class="stats">${cells}</div>`;
}

function sectionHead<T>(title: string, section: ReportSection<T>): string {
  return (
    `<div class="section-head">` +
    `<h2>${esc(title)}</h2>` +
    `<span class="badge ${toneClass(section.tone)}">${esc(section.statusLabel)}</span>` +
    `</div>` +
    statsRow(section.stats)
  );
}

function table(headers: string[], rows: string[]): string {
  return (
    `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`
  );
}

function emptyLine(section: { emptyLine: string }): string {
  return `<p class="empty">${esc(section.emptyLine)}</p>`;
}

// --- per-section renderers ------------------------------------------------

function backupsHtml(section: ReportSection<BackupRow>, ctx: RenderHtmlContext): string {
  const head = sectionHead("Backups", section);
  if (section.rows.length === 0) return head + emptyLine(section);
  const rows = section.rows.map((r) => {
    const base = r.runId ? linkOr(href(ctx, `/backups/${r.runId}`), r.baseName) : esc(r.baseName);
    const dest = r.destinationUrl
      ? linkOr(r.destinationUrl, r.destinationName ?? "destination")
      : esc(r.destinationName ?? "—");
    const detail = r.outcome === "ok" ? esc(r.volume) : esc(r.error ?? "failed");
    return (
      `<tr class="${toneClass(r.outcome === "ok" ? "success" : "error")}">` +
      `<td>${base}</td><td>${esc(r.outcome)}</td><td>${r.records}</td>` +
      `<td>${detail}</td><td>${dest}</td></tr>`
    );
  });
  return head + table(["Base", "Outcome", "Records", "Detail", "Destination"], rows);
}

function connectionsHtml(section: ReportSection<ConnectionRow>, ctx: RenderHtmlContext): string {
  const head = sectionHead("Connection health", section);
  if (section.rows.length === 0) return head + emptyLine(section);
  const rows = section.rows.map((r) => {
    const name = r.connectionId
      ? linkOr(href(ctx, `/connections/${r.connectionId}`), r.name)
      : esc(r.name);
    return (
      `<tr><td>${name}</td><td>${esc(r.kind)}</td><td>${esc(r.status)}</td>` +
      `<td>${esc(r.incident ?? "—")}</td></tr>`
    );
  });
  return head + table(["Connection", "Kind", "Status", "Incident"], rows);
}

function schemaHtml(section: ReportSection<SchemaChangeRow>, ctx: RenderHtmlContext): string {
  const head = sectionHead("Schema health", section);
  if (section.rows.length === 0) return head + emptyLine(section);
  const rows = section.rows.map((r) => {
    const entity = linkOr(href(ctx, `/schema?entity=${encodeURIComponent(r.entityId)}`), r.entityName);
    return (
      `<tr class="${toneClass(r.tone === "neutral" ? "success" : r.tone)}">` +
      `<td>${entity}</td><td>${esc(r.location)}</td><td>${esc(r.change)}</td></tr>`
    );
  });
  return head + table(["Entity", "Location", "Change"], rows);
}

function docsHtml(section: ReportSection<DocRow>, ctx: RenderHtmlContext): string {
  const head = sectionHead("Documentation", section);
  if (section.rows.length === 0) return head + emptyLine(section);
  const rows = section.rows.map((r) => {
    const title = linkOr(href(ctx, `/docs/${r.docId}`), r.title);
    return `<tr><td>${title}</td><td>${esc(r.action)}</td><td>${fmtDate(r.at)}</td><td>${esc(r.by ?? "—")}</td></tr>`;
  });
  return head + table(["Document", "Action", "When", "By"], rows);
}

function trendsHtml(trends: ReportTrends): string {
  const head = `<div class="section-head"><h2>Trends</h2></div>`;
  if (!trends.available) return head + `<p class="empty">${esc(trends.note ?? "Not available yet.")}</p>`;
  const rows = trends.metrics.map(
    (m) => `<tr><td>${esc(m.label)}</td><td>${m.points.length} points${deltaHtml(m.delta)}</td></tr>`,
  );
  return head + table(["Metric", "Series"], rows);
}

function dataHealthHtml(dh: ReportDataHealth): string {
  const head = `<div class="section-head"><h2>Data health</h2></div>`;
  if (!dh.available) return head + `<p class="empty">${esc(dh.note ?? "Not available yet.")}</p>`;
  const rows = dh.rows.map(
    (r) => `<tr><td>${esc(r.baseName)}</td><td>${r.records}</td><td>${r.attachments}</td></tr>`,
  );
  return statsRow(dh.stats) + head + table(["Base", "Records", "Attachments"], rows);
}

function stripHtml(strip: ReportStat[]): string {
  if (strip.length === 0) return "";
  const cells = strip
    .map(
      (s) =>
        `<div class="strip-stat ${s.tone ? toneClass(s.tone) : ""}">` +
        `<div class="strip-value">${esc(s.value)}${deltaHtml(s.delta)}</div>` +
        `<div class="strip-label">${esc(s.label)}</div></div>`,
    )
    .join("");
  return `<div class="strip">${cells}</div>`;
}

const STYLE = `
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .strip { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0 24px; }
  .strip-stat { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; min-width: 90px; }
  .strip-value { font-size: 18px; font-weight: 600; }
  .strip-label { font-size: 12px; color: #666; }
  section, .section { margin-bottom: 28px; }
  .section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #eee; }
  .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 6px 0 10px; }
  .stat-label { font-size: 11px; color: #777; }
  .stat-value { font-size: 15px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { color: #666; font-weight: 600; }
  .empty { color: #777; font-style: italic; }
  .delta { font-size: 12px; }
  .delta-good { color: #16794c; } .delta-bad { color: #b42318; } .delta-flat { color: #888; }
  .tone-success .strip-value, .badge.tone-success { color: #16794c; }
  .badge.tone-success { background: #e7f6ee; }
  .badge.tone-warning { background: #fdf3e7; color: #93500b; }
  .badge.tone-error { background: #fdeceb; color: #b42318; }
`;

/**
 * Render the versioned document to one self-contained HTML string. Sections not
 * present on the document are skipped; present-but-empty sections render their
 * clean line. Pure — safe to snapshot.
 */
export function renderHtml(document: ReportDetail, ctx: RenderHtmlContext = {}): string {
  const title = ctx.reportName ? esc(ctx.reportName) : "Baseout Report";
  const window = `${fmtDate(document.windowStart)} → ${fmtDate(document.windowEnd)}`;
  const parts: string[] = [];

  parts.push(`<h1>${title}</h1>`);
  parts.push(
    `<div class="meta">Window ${esc(window)} · Status ${esc(document.status)} · ` +
      `Triggered ${esc(document.trigger.kind)}${document.trigger.by ? ` by ${esc(document.trigger.by)}` : ""}` +
      `${document.adHoc ? " · ad-hoc" : ""}</div>`,
  );
  parts.push(stripHtml(document.strip));

  if (document.backupSummary) parts.push(`<section>${backupsHtml(document.backupSummary, ctx)}</section>`);
  if (document.connectionHealth) parts.push(`<section>${connectionsHtml(document.connectionHealth, ctx)}</section>`);
  if (document.schemaHealth) parts.push(`<section>${schemaHtml(document.schemaHealth, ctx)}</section>`);
  if (document.documentation) parts.push(`<section>${docsHtml(document.documentation, ctx)}</section>`);
  if (document.trends) parts.push(`<section>${trendsHtml(document.trends)}</section>`);
  if (document.dataHealth) parts.push(`<section>${dataHealthHtml(document.dataHealth)}</section>`);

  return (
    `<!doctype html><html><head><meta charset="utf-8"/>` +
    `<title>${title}</title><style>${STYLE}</style></head>` +
    `<body>${parts.join("")}</body></html>`
  );
}
