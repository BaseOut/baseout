/**
 * mediaFormat — the ONE file→glyph / file→kind / bytes→text mapping for captured attachments,
 * plus the media-thumbnail markup builder (catalog: `pattern-media-thumb`).
 *
 * `attGlyph()` and `fmtSize()` were LOCAL to `recordReadBody.ts` (the record panel's comment file
 * chips). They are extracted here and RE-IMPORTED there — not copied. Hand-copying is exactly how
 * this repo ended up with four pagers and five entity-glyph ternaries.
 *
 * The thumbnail is built as an HTML STRING rather than only as an Astro component because it has
 * to render in two places: server-side in the listing/gallery (via MediaThumb.astro, which is a
 * thin wrapper around `mediaThumbHtml`) and inside the asset panel's body, which is assembled as
 * innerHTML at runtime. One builder, two call shapes — never two implementations.
 */
import type { MediaAsset, MediaKind } from './dataTypes';

/** The least a helper here needs to know about a file. Every attachment shape in the app satisfies it. */
export interface FileLike {
  filename?: string;
  type?: string;
}

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Lower-cased extension, or '' when the filename is missing or has none. */
export const extOf = (f: FileLike): string => (f.filename || '').split('.').pop()?.toLowerCase() || '';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
const DOC_EXT = ['pdf', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'json'];

/**
 * Which of the five buckets a file falls into. Derived from MIME + extension every time rather
 * than trusted from a stored field — a capture may carry either, or neither, and two sources of
 * the same truth drift.
 */
export function mediaKind(f: FileLike): MediaKind {
  const type = (f.type || '').toLowerCase();
  const ext = extOf(f);
  if (type.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image';
  if (type.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video';
  if (type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  if (
    type === 'application/pdf' ||
    type.startsWith('text/') ||
    type.includes('spreadsheet') ||
    type.includes('word') ||
    type.includes('presentation') ||
    DOC_EXT.includes(ext)
  ) return 'document';
  return 'other';
}

/**
 * Human label for a kind — the Type facet's rows, the listing's Type column and the panel's Type
 * tile. The identifier stays `KIND_LABEL` (and the type stays `MediaKind`) deliberately: those
 * never reach the screen, and renaming them would churn every call site to say the same thing.
 */
export const KIND_LABEL: Record<MediaKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  other: 'Other',
};

/**
 * The five CATEGORY glyphs — one per MediaKind, the same five the Type facet lists.
 *
 * Deliberately NOT `attGlyph()`, which is FORMAT-level: it splits documents into pdf / spreadsheet
 * / archive / plain, and it is already rendered a few pixels away inside the thumbnail box. A
 * format glyph in the Type cell would restate the thumbnail and disagree with the facet — five
 * stable icons make the column and the filter one vocabulary, which is the whole point of the
 * column carrying icons at all.
 *
 * Written as five literal class strings so Tailwind's `@source` scan sees them; a name assembled
 * at runtime would need a safelist entry (the dynamic-icon gotcha this repo has hit before).
 */
export const KIND_ICON: Record<MediaKind, string> = {
  image: 'lucide--image',
  video: 'lucide--video',
  audio: 'lucide--music',
  document: 'lucide--file-text',
  other: 'lucide--file',
};

/**
 * The file→icon mapping. Lucide only. Extracted verbatim from `recordReadBody.ts` and widened to
 * cover the kinds a whole-Space asset index sees (video / audio / archive) — the comment chip only
 * ever met images, PDFs and spreadsheets.
 */
export function attGlyph(f: FileLike): string {
  const type = (f.type || '').toLowerCase();
  const ext = extOf(f);
  if (type.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'lucide--image';
  if (type.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'lucide--file-video';
  if (type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'lucide--file-audio';
  if (type === 'application/pdf' || ext === 'pdf') return 'lucide--file-text';
  if (type.includes('csv') || type.includes('spreadsheet') || ['csv', 'xls', 'xlsx'].includes(ext)) return 'lucide--file-spreadsheet';
  if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext)) return 'lucide--file-archive';
  return 'lucide--file';
}

/**
 * Human-readable size that degrades honestly when Airtable withheld it — never prints "undefined".
 * A GB tier was added for the asset index (the record-panel chip never met a file that big); every
 * value under 1 GB formats exactly as it did before, so the chip is unchanged.
 */
export function fmtSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}

/**
 * The FORMAT chip stamped into the thumbnail's lower-left (PDF · PNG · MP4 …). This is what carries
 * file type on this surface, which is why there is no per-row category pill — a category pill on
 * every row is the exact noise the Comments status column was rebuilt to remove.
 * Returns '' when neither the filename nor the MIME type yields a real format, and the caller then
 * omits the chip. It used to fall back to the kind's first three letters, which stamped "IMA", "DOC"
 * and "OTH" onto the tile — invented codes that look like formats and are not any. A file we cannot
 * name the format of should say nothing; the glyph already carries the kind.
 */
export function formatLabel(f: FileLike): string {
  const ext = extOf(f);
  if (ext && ext.length <= 4) return ext.toUpperCase();
  const t = (f.type || '').split('/')[1] || '';
  if (t && t.length <= 4) return t.toUpperCase();
  return '';
}

/**
 * STORAGE MARKS — one mark per place the bytes actually live, drawn as the REAL brand mark.
 *
 * This is the documented Lucide-only exemption, stated in `ui/SocialButton.astro`'s header (cited by
 * file, not by line — the line number this used to carry went stale the first time that file was
 * edited, which is the argument against citing one at all): Lucide has no
 * Google "G", and a hand-drawn stand-in for a brand mark is worse than the dependency it replaces.
 * Two grey outlines that differ only in silhouette make the reader decode; the marks they already
 * know make them recognise. So the assets that already exist are reused — `/brands/*.svg` are the
 * same files `SpacePipelineHero` and the destination wizard render — and nothing is drawn by hand.
 *
 * The second half of that quote is a CONSTRAINT, not only a permission: a provider we hold no asset
 * for (`box`, `onedrive`) falls back to `lucide--cloud` rather than to an invented mark. Neither
 * appears in the media fixtures today, so the fallback is currently unreachable — it exists so the
 * column cannot render blank the day the engine sends one.
 *
 * Baseout's own mark is THEME-PAIRED, exactly as the sidebar and the pipeline hero render it: both
 * <img>s ship and `brand-logo-cyan` / `brand-logo-blue` (styles/components/brand-logo.css) show the
 * one that belongs to the live theme. Hardcoding one file would put a twilight-blue mark on the
 * dark theme.
 *
 * Every icon here is `aria-hidden`; the cell's `sr-only` span and its daisyUI tooltip carry the
 * full wording, so the accessible name is unchanged by the marks being pictures rather than glyphs.
 * The Lucide fallbacks are written as LITERAL class strings — a name assembled at runtime is not
 * something Tailwind's `@source` scan can see.
 */
const PROVIDER_MARK: Partial<Record<NonNullable<MediaAsset['storage']['provider']>, string>> = {
  google_drive: '/brands/google-drive.svg',
  dropbox: '/brands/dropbox.svg',
  s3: '/brands/aws.svg',
};

const markImg = (src: string, cls = '') =>
  `<img src="${src}" alt="" aria-hidden="true" width="16" height="16" class="md-store-mk${cls ? ` ${cls}` : ''}" />`;

/**
 * The marks for one asset's storage, in the order the bytes were written: ours, then theirs.
 * Both copies = both marks side by side — it is two places at once, not a third kind of storage.
 */
export function storeMarksHtml(storage: MediaAsset['storage']): string {
  const marks: string[] = [];
  if (storage.baseout) {
    marks.push(markImg('/images/logo/icon-dark.svg', 'brand-logo-cyan'));
    marks.push(markImg('/images/logo/icon-light.svg', 'brand-logo-blue'));
  }
  if (storage.provider) {
    const src = PROVIDER_MARK[storage.provider];
    marks.push(src
      ? markImg(src)
      : '<span class="iconify lucide--cloud size-4 md-store-ic" aria-hidden="true"></span>');
  }
  // Nowhere is a REAL state and must not render as blank.
  if (!marks.length) marks.push('<span class="iconify lucide--circle-slash size-4 md-store-ic" aria-hidden="true"></span>');
  return marks.join('');
}

/** A file's display name, degrading to a stable placeholder rather than to "undefined". */
export const displayName = (a: { filename?: string; id: string }): string => a.filename || a.id;

/** The two sizes this pattern has. There is deliberately no third. */
export type ThumbSize = 'sm' | 'lg';
const PX: Record<ThumbSize, number> = { sm: 32, lg: 112 };

/**
 * The media thumbnail (catalog `pattern-media-thumb`).
 *
 * Rules encoded here so no call site can get them wrong:
 *  · `src` is ONLY ever `asset.thumbUrl` — our stored copy. An Airtable attachment URL expires in
 *    ~2 hours and would render a wall of broken images by the same afternoon.
 *  · The glyph state is rendered SERVER-SIDE, in the same box the image would have occupied, so
 *    the grid never reflows between the two states. There is no `onerror` swap: by the time that
 *    fires the broken image has already flashed on screen.
 *  · The filename lives in a daisyUI tooltip; `alt` stays empty because the row/tile already names
 *    the file in text, and a second copy would just be read twice by a screen reader.
 */
export function mediaThumbHtml(
  a: Pick<MediaAsset, 'id' | 'filename' | 'type' | 'thumbUrl'>,
  opts: { size?: ThumbSize; tip?: boolean } = {},
): string {
  const { size = 'sm', tip = true } = opts;
  // The gallery tile stretches to its grid track (`minmax(112px, 1fr)`) but keeps a FIXED height,
  // which is what stops the matrix reflowing between the image and glyph states.
  const box = size === 'lg' ? `width:100%;height:${PX.lg}px` : `width:${PX.sm}px;height:${PX.sm}px`;
  const name = displayName(a);
  const tipAttr = tip ? ` data-tip="${esc(name)}"` : '';
  // No format we can name → no chip. An empty or invented badge is worse than none: the glyph
  // already says what kind of thing this is.
  const fmt = formatLabel(a);
  // SOLID, not soft — the one badge in the app that sits over arbitrary imagery, so its contrast
  // cannot depend on what is behind it. Soft neutral put near-black text on a near-black
  // placeholder and measured 1.3:1; the opaque plate measures 13.9:1 over a dark box and over a
  // white photo alike. The app-wide soft+semantic rule governs STATUS on a known surface, and this
  // is a stamp on media, not a status.
  const chip = size === 'lg' && fmt
    ? `<span class="badge badge-neutral badge-sm md-thumb-fmt">${esc(fmt)}</span>`
    : '';
  const inner = a.thumbUrl
    ? `<img class="md-thumb-img" src="${esc(a.thumbUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="iconify ${attGlyph(a)} md-thumb-gl" aria-hidden="true"></span>`;
  return `<span class="md-thumb md-thumb-${size}"${tipAttr} style="${box}">${inner}${chip}</span>`;
}
