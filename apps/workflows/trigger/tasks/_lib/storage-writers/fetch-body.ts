// A Uint8Array is a valid `fetch` body at runtime under both the Node (undici)
// runtime these writers actually run on AND the workerd runtime whose
// @cloudflare/workers-types are pulled into the type graph when apps/server
// typechecks this shared code (it imports task references from @baseout/
// workflows). But workers-types' `BodyInit` overloads reject a bare
// Uint8Array at compile time (only string | ArrayBuffer | Blob | stream |
// FormData | URLSearchParams). Copying the view into a standalone ArrayBuffer
// yields a body both type-checkers accept, at the cost of one small copy per
// upload (negligible for CSVs + per-attachment blobs).

export function toFetchBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}
