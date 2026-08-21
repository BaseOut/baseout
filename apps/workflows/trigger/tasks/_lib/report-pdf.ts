// PDF rendering behind an interface — workflows-reports task 2.1.
//
// `renderPdf` is a single async function type; the pure orchestration takes it
// as an injected dep, so unit tests mock it and never launch a browser. The
// real implementation drives Node headless-Chromium.
//
// OPEN QUESTION (design §PDF): Playwright vs Puppeteer vs a lighter Node PDF
// lib is unresolved, so the browser package is NOT added to package.json here —
// `chromiumRenderPdf` imports it lazily by name (so this module typechecks
// without the dep) and throws a clear error if it isn't installed. Add the
// chosen dependency + wire it before the deployed PDF smoke.

export type RenderPdf = (html: string) => Promise<Uint8Array>;

const FOOTER = `
  <div style="font-size:9px; width:100%; text-align:center; color:#888;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;

/**
 * Real headless-Chromium renderer (Playwright API shape). Lazily imported so a
 * missing browser dep degrades to a clear runtime error rather than breaking
 * the build/typecheck. Not exercised by unit tests — smoke-only.
 */
export const chromiumRenderPdf: RenderPdf = async (html: string) => {
  // Non-literal specifier: keeps tsc from requiring the (open-question) dep at
  // compile time. Swap "playwright" for the chosen package once decided.
  const pkg = "playwright";
  let mod: { chromium: { launch: (o?: unknown) => Promise<BrowserLike> } };
  try {
    mod = (await import(pkg)) as typeof mod;
  } catch {
    throw new Error(
      `PDF renderer unavailable: install the headless-Chromium dependency ("${pkg}") ` +
        `and wire it in report-pdf.ts (design open question).`,
    );
  }
  const browser = await mod.chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "18mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: FOOTER,
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
};

// Minimal structural types for the lazily-imported browser (avoids an
// @types/playwright dependency for a module tsc must check without the package).
interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
interface PageLike {
  setContent(html: string, opts?: unknown): Promise<void>;
  pdf(opts?: unknown): Promise<Uint8Array>;
}
