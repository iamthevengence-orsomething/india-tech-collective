import { describe, expect, it } from 'vitest';
import { sanitizeCell, toCsv } from '../../src/lib/csv';

describe('CSV formula-injection hardening', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tX', '\rX'])('neutralizes %j', (v) => {
    expect(sanitizeCell(v).startsWith("'")).toBe(true);
  });

  it('leaves ordinary values alone', () => {
    expect(sanitizeCell('Narendra Modi')).toBe('Narendra Modi');
    expect(sanitizeCell('13(2)')).toBe('13(2)');
  });

  it('quotes and escapes embedded separators and quotes', () => {
    const csv = toCsv([{ a: 'x,y', b: 'He said "hi"' }], ['a', 'b']);
    expect(csv).toBe('a,b\n"x,y","He said ""hi"""\n');
  });

  it('renders null/undefined as empty cells', () => {
    const csv = toCsv([{ a: null, b: undefined }], ['a', 'b']);
    expect(csv).toBe('a,b\n,\n');
  });
});
