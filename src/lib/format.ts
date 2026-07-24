/** en-IN formatting (lakh/crore digit grouping) and shared date/percent display. */

const intFmt = new Intl.NumberFormat('en-IN');

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return intFmt.format(n);
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(digits)}%`;
}

/** "24 Jul 2026" from YYYY-MM-DD; falls back to the raw string. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** Ratio → percent with explicit null when the denominator is 0/absent (never fake 0%). */
export function pctOf(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}
