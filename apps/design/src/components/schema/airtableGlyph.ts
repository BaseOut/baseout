/**
 * Monochrome Airtable mark, inline so it inherits `currentColor` (a public
 * `<img src="/airtable.svg">` is full-colour and can't follow the text colour).
 * Used as the workspace-grouping glyph on the base-filter group headers — a brand
 * logo, which the Lucide-only rule exempts (same exception as the social-login
 * logos). Kept in ONE place so the Astro FacetFilter and the React FacetDropdown
 * twin render the exact same glyph. The three main shapes only (the 4th path in
 * public/airtable.svg is a fold shadow that's redundant in monochrome).
 */
export const AIRTABLE_GLYPH =
  '<svg viewBox="0 0 64 64" width="14" height="14" fill="currentColor" aria-hidden="true">' +
  '<path d="M28.578 5.906L4.717 15.78c-1.327.55-1.313 2.434.022 2.963l23.96 9.502a8.89 8.89 0 0 0 6.555 0l23.96-9.502c1.335-.53 1.35-2.414.022-2.963l-23.86-9.873a8.89 8.89 0 0 0-6.799 0"/>' +
  '<path d="M34.103 33.433V57.17a1.6 1.6 0 0 0 2.188 1.486l26.7-10.364A1.6 1.6 0 0 0 64 46.806V23.07a1.6 1.6 0 0 0-2.188-1.486l-26.7 10.364a1.6 1.6 0 0 0-1.009 1.486"/>' +
  '<path d="M27.87 34.658l-8.728 4.215-16.727 8.015c-1.06.512-2.414-.26-2.414-1.44V23.17c0-.426.218-.794.512-1.07a1.82 1.82 0 0 1 .405-.304c.4-.24.97-.304 1.455-.112l25.365 10.05c1.3.512 1.4 2.318.133 2.925"/>' +
  '</svg>';
