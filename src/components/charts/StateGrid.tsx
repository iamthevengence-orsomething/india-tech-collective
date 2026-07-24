import { useId, useState } from 'react';

/**
 * Accessible India state/UT tile grid (cartogram). Deliberately NOT a
 * choropleth: no verified Survey of India boundary file was available, and a
 * tile grid depicts no political boundary at all (see /methodology/).
 * Tiles are toggle buttons (keyboard operable); a data-table twin is included.
 */

// (col,row) per state code — hand-laid to approximate geography, 8×8
const LAYOUT: Record<string, [number, number]> = {
  JK: [3, 0], LA: [4, 0],
  PB: [2, 1], HP: [3, 1], UK: [4, 1],
  CH: [1, 2], HR: [2, 2], DL: [3, 2], UP: [4, 2], SK: [6, 2], AR: [7, 2],
  GJ: [0, 3], RJ: [1, 3], MP: [2, 3], CG: [3, 3], BR: [4, 3], AS: [6, 3], NL: [7, 3],
  DH: [0, 4], MH: [1, 4], TG: [2, 4], OD: [3, 4], JH: [4, 4], WB: [5, 4], ML: [6, 4], MN: [7, 4],
  GA: [1, 5], KA: [2, 5], AP: [3, 5], TR: [6, 5], MZ: [7, 5],
  LD: [1, 6], KL: [2, 6], TN: [3, 6], PY: [4, 6],
  AN: [5, 7],
};

// [fill, text] pairs — text flips light on the deep upper ramp steps so tile
// labels keep ≥4.5:1 contrast at every magnitude
const RAMP: Array<[string, string]> = [
  ['var(--seq-1)', 'var(--ink-strong)'],
  ['var(--seq-2)', 'var(--ink-strong)'],
  ['var(--seq-3)', 'var(--ink-strong)'],
  ['var(--seq-4)', '#FCF8ED'],
  ['var(--seq-5)', '#FCF8ED'],
];

export interface StateTileDatum {
  code: string;
  name: string;
  value: number | null; // percent 0..100 (null = no data)
  detail: string;       // e.g. "12 of 25 covered members"
}

function rampColor(value: number | null, max: number): [string, string] {
  if (value === null) return ['var(--seq-none)', 'var(--muted)'];
  if (max <= 0) return RAMP[0];
  const idx = Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length));
  return RAMP[idx];
}

export default function StateGrid({
  data,
  selected,
  onToggle,
  metricLabel,
  maxValue,
}: {
  data: StateTileDatum[];
  selected: string[];
  onToggle: (code: string) => void;
  metricLabel: string;
  maxValue?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  const byCode = new Map(data.map((d) => [d.code, d]));
  const cols = 8;
  const rows = 8;

  return (
    <div className="tile-grid-wrap">
      <div
        className="tile-grid"
        role="group"
        aria-label={`State and union-territory tiles: ${metricLabel}. Positions approximate geography; no boundary is depicted.`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.2rem, 1fr))`, maxWidth: '34rem' }}
      >
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const code = Object.keys(LAYOUT).find((k) => LAYOUT[k][0] === c && LAYOUT[k][1] === r);
            if (!code) return <span key={`${c}-${r}`} aria-hidden="true" />;
            const d = byCode.get(code);
            const value = d?.value ?? null;
            const [bg, fg] = rampColor(value, max);
            return (
              <button
                key={code}
                type="button"
                className={`tile${value === null ? ' tile-none' : ''}`}
                style={value === null ? undefined : { background: bg }}
                aria-pressed={selected.includes(code)}
                aria-label={`${d?.name ?? code}: ${value === null ? 'no data' : `${value.toFixed(0)}%`} — ${d?.detail ?? ''}. Toggle to filter.`}
                title={`${d?.name ?? code} — ${d?.detail ?? 'no data'}`}
                onClick={() => onToggle(code)}
              >
                <span className="tile-code" aria-hidden="true" style={{ color: fg }}>{code}</span>
                <span className="tile-val" aria-hidden="true" style={{ color: fg, opacity: 0.92 }}>{value === null ? '—' : `${value.toFixed(0)}%`}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="tile-legend">
        <span>0%</span>
        <span className="swatches" aria-hidden="true">
          {RAMP.map((c) => (
            <span key={c} className="sw" style={{ background: c }} />
          ))}
        </span>
        <span>{max.toFixed(0)}%</span>
        <span aria-hidden="true">·</span>
        <span className="sw" style={{ background: 'var(--seq-none)', border: '1px dashed var(--line)', width: 14 }} aria-hidden="true" />
        <span>no data</span>
        <button type="button" className="btn btn-small" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((s) => !s)}>
          {showTable ? 'Hide' : 'Show'} data table
        </button>
      </div>
      {showTable && (
        <div className="table-scroll" id={tableId} style={{ marginTop: '0.8rem' }}>
          <table className="data">
            <caption>{metricLabel} — same data as the tile view</caption>
            <thead>
              <tr><th scope="col">State/UT</th><th scope="col" className="num">Value</th><th scope="col">Basis</th></tr>
            </thead>
            <tbody>
              {[...data].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                <tr key={d.code}>
                  <th scope="row" style={{ fontWeight: 500 }}>{d.name}</th>
                  <td className="num">{d.value === null ? '—' : `${d.value.toFixed(1)}%`}</td>
                  <td>{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
