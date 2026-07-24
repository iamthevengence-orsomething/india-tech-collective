/**
 * Name normalization and slugs. Pure string functions — shared by the pipeline
 * (id derivation) and the site (getStaticPaths). No crypto here; hashing lives
 * in scripts/lib/ids.ts so browser bundles never pull in node:crypto.
 */

/** Lowercase, strip diacritics, drop punctuation, collapse whitespace. Conservative: no honorific stripping. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugify(text: string): string {
  return normalizeName(text).replace(/\s/g, '-');
}

/** Human-readable profile slug: name + constituency. Collision suffix appended by the pipeline when needed. */
export function politicianSlug(displayName: string, constituencyName: string, collisionSuffix?: string): string {
  const base = `${slugify(displayName)}-${slugify(constituencyName)}`;
  return collisionSuffix ? `${base}-${collisionSuffix}` : base;
}
