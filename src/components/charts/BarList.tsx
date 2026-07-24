/**
 * Single-measure horizontal bar list. One hue (identity lives in labels, not
 * color); numerator/denominator always visible; suppressed rows stay listed
 * but muted and excluded from any ranking implication.
 */
export interface BarListRow {
  key: string;
  label: string;
  value: number | null; // percent or count for bar length
  display: string;      // formatted value text
  detail?: string;      // e.g. "12 / 39 covered"
  suppressed?: boolean;
  suppressedNote?: string;
}

export default function BarList({
  rows,
  max,
  ariaLabel,
}: {
  rows: BarListRow[];
  max?: number;
  ariaLabel: string;
}) {
  const effectiveMax = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="bar-list" role="list" aria-label={ariaLabel}>
      {rows.map((r) => {
        const width = r.value === null ? 0 : Math.max(0.5, (r.value / effectiveMax) * 100);
        return (
          <div className={`bar-row${r.suppressed ? ' suppressed' : ''}`} role="listitem" key={r.key}>
            <span className="bar-label">
              {r.label}
              {r.suppressed && (
                <span className="chip chip-warn" style={{ marginLeft: '0.45rem' }} title={r.suppressedNote}>
                  small sample
                </span>
              )}
            </span>
            <span className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill${r.suppressed ? ' muted' : ''}`}
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="bar-value">
              {r.display}
              {r.detail ? <span style={{ color: 'var(--faint)' }}> · {r.detail}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
