// Same-origin CSRF check for admin's mutating routes. The session cookie is
// SameSite=Lax (cross-site POSTs don't carry it); this is the second layer.
// A missing Origin header is rejected — all modern browsers send it on POST.
export function checkOrigin(originHeader: string | null, selfOrigin: string): boolean {
  if (!originHeader) return false
  try {
    return new URL(originHeader).origin === new URL(selfOrigin).origin
  } catch {
    return false
  }
}
