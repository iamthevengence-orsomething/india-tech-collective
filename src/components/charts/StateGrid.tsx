import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { INDIA_MAP_PATHS, INDIA_MAP_VIEWBOX } from '../../data/india-map';

/**
 * Geographic India state/UT data map.
 *
 * The boundary geometry is generated from the 2024 Local Government Directory
 * layer. Every map action has an equivalent HTML button in the adjacent data
 * index, and the full table remains available below.
 */

const RAMP: Array<[string, string]> = [
  ['var(--seq-1)', 'var(--ink-strong)'],
  ['var(--seq-2)', 'var(--ink-strong)'],
  ['var(--seq-3)', 'var(--ink-strong)'],
  ['var(--seq-4)', '#FCF8ED'],
  ['var(--seq-5)', '#FCF8ED'],
];

const SMALL_TERRITORIES = new Set(['AN', 'CH', 'DH', 'DL', 'GA', 'LD', 'PY']);

export interface StateTileDatum {
  code: string;
  name: string;
  value: number | null;
  detail: string;
}

function rampColor(value: number | null, max: number): [string, string, number] {
  if (value === null) return ['var(--seq-none)', 'var(--muted)', -1];
  if (max <= 0) return [...RAMP[0], 0];
  const index = Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length));
  return [...RAMP[index], index];
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
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const tableId = useId();
  const max = maxValue ?? Math.max(1, ...data.map((datum) => datum.value ?? 0));
  const byCode = useMemo(() => new Map(data.map((datum) => [datum.code, datum])), [data]);
  const sorted = useMemo(
    () => [...data].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name)),
    [data],
  );
  const defaultCode = selected[0] ?? sorted[0]?.code ?? null;
  const currentCode = activeCode ?? defaultCode;
  const current = currentCode ? byCode.get(currentCode) : undefined;
  const currentMapPath = currentCode ? INDIA_MAP_PATHS.find((path) => path.code === currentCode) : undefined;

  const keyboardToggle = (event: KeyboardEvent<SVGPathElement>, code: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle(code);
  };

  return (
    <div className="india-map-wrap">
      <div className="india-map-shell">
        <div className="india-map-stage">
          <div className="india-map-stage__head" aria-hidden="true">
            <span>INDIA / STATE + UT / 2024</span>
            <span>LGD BOUNDARY LAYER</span>
          </div>
          <svg
            className="india-map"
            viewBox={INDIA_MAP_VIEWBOX}
            role="group"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>Interactive map of India by state and union territory</title>
            <desc id={descId}>
              {metricLabel}. Each state and union territory can be focused and toggled as a filter. The same controls
              and values are available in the adjacent data index and table.
            </desc>
            <g className="india-map__states">
              {INDIA_MAP_PATHS.map((mapPath) => {
                const datum = byCode.get(mapPath.code);
                const value = datum?.value ?? null;
                const [fill, , ramp] = rampColor(value, max);
                const isSelected = selected.includes(mapPath.code);
                const isActive = currentCode === mapPath.code;
                const label = `${datum?.name ?? mapPath.name}: ${
                  value === null ? 'no data' : `${value.toFixed(1)} percent`
                }. ${datum?.detail ?? ''}. ${isSelected ? 'Selected as a filter.' : 'Activate to filter.'}`;
                return (
                  <path
                    key={mapPath.code}
                    d={mapPath.path}
                    className={`india-map__state${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                    style={{ fill }}
                    data-ramp={ramp}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-pressed={isSelected}
                    onFocus={() => setActiveCode(mapPath.code)}
                    onMouseEnter={() => setActiveCode(mapPath.code)}
                    onClick={() => onToggle(mapPath.code)}
                    onKeyDown={(event) => keyboardToggle(event, mapPath.code)}
                  >
                    <title>{label}</title>
                  </path>
                );
              })}
            </g>
            <g className="india-map__markers" aria-hidden="true">
              {INDIA_MAP_PATHS.filter((path) => SMALL_TERRITORIES.has(path.code)).map((path) => (
                <circle
                  key={path.code}
                  cx={path.label[0]}
                  cy={path.label[1]}
                  r={currentCode === path.code || selected.includes(path.code) ? 5.5 : 3.5}
                />
              ))}
            </g>
          </svg>
          <p className="india-map-stage__note">Boundaries provide geographic orientation; values and filters are available without the map.</p>
        </div>

        <aside className="india-map-index" aria-label="State and union territory data index">
          <div className="india-map-readout" aria-live="polite" aria-atomic="true">
            <p className="file-label">Current map record</p>
            <div className="india-map-readout__code" aria-hidden="true">{current?.code ?? 'IN'}</div>
            <h3>{current?.name ?? currentMapPath?.name ?? 'India'}</h3>
            <strong className="num">{current?.value === null || current?.value === undefined ? 'No data' : `${current.value.toFixed(1)}%`}</strong>
            <p>{current?.detail ?? 'Focus a state or union territory to inspect its value.'}</p>
            {current && (
              <button
                type="button"
                className="btn btn-small"
                aria-pressed={selected.includes(current.code)}
                onClick={() => onToggle(current.code)}
              >
                {selected.includes(current.code) ? 'Remove state filter' : 'Filter to this state'}
              </button>
            )}
          </div>

          <ul className="india-map-list" aria-label="All state and union territory values">
            {sorted.map((datum) => {
              const isSelected = selected.includes(datum.code);
              return (
                <li key={datum.code}>
                  <button
                    type="button"
                    className={currentCode === datum.code ? 'is-current' : undefined}
                    aria-label={`${datum.name}: ${datum.value === null ? 'no data' : `${datum.value.toFixed(1)} percent`}. ${isSelected ? 'Selected; activate to remove filter.' : 'Activate to filter.'}`}
                    aria-pressed={isSelected}
                    onFocus={() => setActiveCode(datum.code)}
                    onMouseEnter={() => setActiveCode(datum.code)}
                    onClick={() => onToggle(datum.code)}
                  >
                    <span>{datum.code}</span>
                    <strong>{datum.name}</strong>
                    <i className="num">{datum.value === null ? '—' : `${datum.value.toFixed(0)}%`}</i>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <div className="tile-legend" aria-label={`Color scale from zero to ${max.toFixed(0)} percent`}>
        <span>0%</span>
        <span className="swatches" aria-hidden="true">
          {RAMP.map(([color]) => <span key={color} className="sw" style={{ background: color }} />)}
        </span>
        <span>{max.toFixed(0)}%</span>
        <span aria-hidden="true">·</span>
        <span className="sw" style={{ background: 'var(--seq-none)', border: '1px dashed var(--line)', width: 14 }} aria-hidden="true" />
        <span>no data</span>
        <button
          type="button"
          className="btn btn-small"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((state) => !state)}
        >
          {showTable ? 'Hide' : 'Show'} accessible data table
        </button>
      </div>

      {showTable && (
        <div className="table-scroll" id={tableId} style={{ marginTop: '0.8rem' }}>
          <table className="data">
            <caption>{metricLabel} — same data as the geographic map</caption>
            <thead>
              <tr><th scope="col">State/UT</th><th scope="col" className="num">Value</th><th scope="col">Basis</th><th scope="col">Filter</th></tr>
            </thead>
            <tbody>
              {[...data].sort((a, b) => a.name.localeCompare(b.name)).map((datum) => (
                <tr key={datum.code}>
                  <th scope="row" style={{ fontWeight: 500 }}>{datum.name}</th>
                  <td className="num">{datum.value === null ? '—' : `${datum.value.toFixed(1)}%`}</td>
                  <td>{datum.detail}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-small"
                      aria-pressed={selected.includes(datum.code)}
                      onClick={() => onToggle(datum.code)}
                    >
                      {selected.includes(datum.code) ? 'Remove' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
