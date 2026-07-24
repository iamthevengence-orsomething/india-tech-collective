/**
 * CSV writer with formula-injection hardening. Cells beginning with = + - @
 * or containing leading control characters are prefixed with a single quote so
 * spreadsheet apps treat them as text, per OWASP CSV-injection guidance.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@'];

export function sanitizeCell(value: string): string {
  if (value.length === 0) return value;
  const first = value[0];
  if (FORMULA_TRIGGERS.includes(first) || first === '\t' || first === '\r') {
    return `'${value}`;
  }
  return value;
}

function encodeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const value = sanitizeCell(String(raw));
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(encodeCell).join(',');
  const body = rows.map((row) => columns.map((c) => encodeCell(row[c])).join(','));
  return [header, ...body].join('\n') + '\n';
}
