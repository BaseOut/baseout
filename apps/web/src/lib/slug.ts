export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'organization'
}

function randomHex6(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6)
}

const MAX_ATTEMPTS = 8

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base)
  if (!(await exists(root))) return root
  for (let n = 2; n <= 5; n++) {
    const candidate = `${root}-${n}`
    if (!(await exists(candidate))) return candidate
  }
  for (let i = 0; i < MAX_ATTEMPTS - 5; i++) {
    const candidate = `${root}-${randomHex6()}`
    if (!(await exists(candidate))) return candidate
  }
  throw new Error(
    `Could not generate a unique slug for "${base}" after ${MAX_ATTEMPTS} attempts`,
  )
}
