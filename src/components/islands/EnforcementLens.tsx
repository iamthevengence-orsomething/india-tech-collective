import { useEffect, useMemo, useState } from 'react';
import BarList, { type BarListRow } from '../charts/BarList';
import ShareRow from './ShareRow';
import { readUrlState, writeUrlState } from '../../lib/url-state';

/**
 * Lens A — state enforcement (NCRB PC Act tables). Raw counts and NCRB's own
 * published rates only; the mandatory comparison caveat is rendered ABOVE this
 * island by the static page and must stay visible in every view.
 */
interface StatsArtifact {
  dataYear: number;
  publicationYear: number;
  publicationLabel: string;
  agencyScope: string;
  statuteScope: string;
  metricDefs: Array<{ metricId: string; label: string; unit: string; definition: string; derived?: boolean }>;
  states: Array<{ state: string; stateName: string; metrics: Record<string, number | null> }>;
  allIndia: Record<string, number | null>;
  dataAsOf: string;
  notes: string[];
}

const KEYS = ['metric', 'ecmp'];
const DEFAULT_METRIC = 'reg_total';

export default function EnforcementLens() {
  const [artifact, setArtifact] = useState<StatsArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, string>>({});
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setState(readUrlState(KEYS));
    const onPop = () => setState(readUrlState(KEYS));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    fetch('/data/corruption.stats.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setArtifact)
      .catch((e) => setError(String(e)));
  }, []);

  const set = (k: string, v: string) => {
    setState((s) => {
      const next = { ...s, [k]: v };
      if (!v) delete next[k];
      const others = readUrlState(['q', 'state', 'party', 'cases', 'statute', 'stage', 'review', 'cmpmode', 'cmp']);
      writeUrlState({ ...others, ...next });
      return next;
    });
  };

  const metricId = useMemo(() => {
    if (!artifact) return DEFAULT_METRIC;
    return artifact.metricDefs.some((d) => d.metricId === state.metric) ? state.metric! : DEFAULT_METRIC;
  }, [artifact, state.metric]);

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <p><strong>Could not load NCRB data.</strong></p>
        <p className="small">{error}. No placeholder numbers are shown.</p>
      </div>
    );
  }
  if (!artifact) return <div className="empty-state loading-state" role="status">Locating NCRB tables…</div>;

  const def = artifact.metricDefs.find((d) => d.metricId === metricId)!;
  const isRate = def.unit === 'percent';
  const values = artifact.states
    .map((s) => ({ ...s, value: s.metrics[metricId] ?? null }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const allIndia = artifact.allIndia[metricId];

  const rows: BarListRow[] = values.map((s) => ({
    key: s.state,
    label: s.stateName,
    value: s.value,
    display: s.value === null ? 'not published' : isRate ? `${s.value}%` : new Intl.NumberFormat('en-IN').format(s.value),
  }));

  const cmpKeys = (state.ecmp ? state.ecmp.split(',') : []).filter(Boolean).slice(0, 3);
  const cmpStates = cmpKeys.map((k) => artifact.states.find((s) => s.state === k)).filter(Boolean) as StatsArtifact['states'];

  return (
    <div>
      <div className="filter-bar">
        <label htmlFor="enf-year">Year</label>
        <select id="enf-year" className="control" value="2023" onChange={() => {}} aria-label="Data year">
          <option value="2023">{artifact.dataYear} (published {artifact.publicationYear})</option>
        </select>
        <label htmlFor="enf-metric">Measure</label>
        <select id="enf-metric" className="control" value={metricId} onChange={(e) => set('metric', e.target.value)} style={{ maxWidth: 'min(100%, 420px)' }}>
          <optgroup label="Cases registered (Table 8C.2)">
            {artifact.metricDefs.filter((d) => d.metricId.startsWith('reg_')).map((d) => <option key={d.metricId} value={d.metricId}>{d.label}</option>)}
          </optgroup>
          <optgroup label="Police disposal (Table 8C.3)">
            {artifact.metricDefs.filter((d) => d.metricId.startsWith('pol_')).map((d) => <option key={d.metricId} value={d.metricId}>{d.label}</option>)}
          </optgroup>
          <optgroup label="Court disposal + NCRB rates (Table 8C.4)">
            {artifact.metricDefs.filter((d) => d.metricId.startsWith('crt_')).map((d) => <option key={d.metricId} value={d.metricId}>{d.label}{d.derived ? ' (NCRB-published rate)' : ''}</option>)}
          </optgroup>
        </select>
        <button type="button" className="btn btn-small" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
          {showTable ? 'Hide' : 'Show'} full table
        </button>
      </div>

      <p className="result-note">
        <strong>{def.label}</strong> — {artifact.agencyScope}, {artifact.statuteScope}.
        All-India: <strong className="num">{allIndia === null ? 'not published' : isRate ? `${allIndia}%` : new Intl.NumberFormat('en-IN').format(allIndia ?? 0)}</strong>.
        Sorted by value for readability — <em>ordering is not a corruption ranking</em> (see the caveat above).
      </p>

      <BarList rows={rows} ariaLabel={`${def.label} by state/UT, ${artifact.dataYear}`} />
      <p className="metric-caption">
        {def.definition} Data year {artifact.dataYear}; publication: {artifact.publicationLabel}. “Not published”
        renders as missing, never zero.
      </p>

      {showTable && (
        <div className="table-scroll" style={{ marginTop: '1rem' }}>
          <table className="data">
            <caption>All NCRB measures per state/UT — the same numbers as the chart, plus every other column.</caption>
            <thead>
              <tr>
                <th scope="col">State/UT</th>
                {artifact.metricDefs.map((d) => <th scope="col" className="num" key={d.metricId} title={d.definition}>{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...artifact.states].sort((a, b) => a.stateName.localeCompare(b.stateName)).map((s) => (
                <tr key={s.state}>
                  <th scope="row" style={{ fontWeight: 500 }}>{s.stateName}</th>
                  {artifact.metricDefs.map((d) => (
                    <td className="num" key={d.metricId}>{s.metrics[d.metricId] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section style={{ marginTop: '1.6rem' }} aria-labelledby="ecmp-h">
        <h3 id="ecmp-h" style={{ fontSize: '1.05rem' }}>Compare states (all measures)</h3>
        <div className="filter-bar">
          {[0, 1, 2].map((i) => (
            <select
              key={i}
              className="control"
              aria-label={`Comparison state ${i + 1}`}
              value={cmpKeys[i] ?? ''}
              onChange={(e) => {
                const next = [...cmpKeys];
                next[i] = e.target.value;
                set('ecmp', next.filter(Boolean).join(','));
              }}
            >
              <option value="">{i < 2 ? 'Pick a state…' : 'Optional third…'}</option>
              {[...artifact.states].sort((a, b) => a.stateName.localeCompare(b.stateName)).map((s) => (
                <option key={s.state} value={s.state}>{s.stateName}</option>
              ))}
            </select>
          ))}
        </div>
        {cmpStates.length >= 2 ? (
          <div className="table-scroll">
            <table className="data">
              <caption className="visually-hidden">Side-by-side NCRB measures for selected states</caption>
              <thead>
                <tr><th scope="col">Measure ({artifact.dataYear})</th>{cmpStates.map((s) => <th scope="col" className="num" key={s.state}>{s.stateName}</th>)}</tr>
              </thead>
              <tbody>
                {artifact.metricDefs.map((d) => (
                  <tr key={d.metricId}>
                    <th scope="row" style={{ fontWeight: 500 }} title={d.definition}>{d.label}{d.derived ? ' *' : ''}</th>
                    {cmpStates.map((s) => <td className="num" key={s.state}>{s.metrics[d.metricId] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small" style={{ color: 'var(--faint)' }}>Pick two or three states for a side-by-side table. * = NCRB-published rate with its formula in the column heading.</p>
        )}
      </section>

      <div className="share-row" style={{ marginTop: '1.2rem' }}>
        <a className="btn btn-small" href="/downloads/state-enforcement-2023.csv" download>Download CSV</a>
        <a className="btn btn-small" href="/downloads/state-enforcement-2023.json" download>Download JSON</a>
      </div>
      <ShareRow
        spec={{
          headline: `PC Act enforcement by state — ${def.label}, ${artifact.dataYear}`,
          definition: `${def.label}: reported enforcement activity under the Prevention of Corruption Act (NCRB). Not a corruption ranking.`,
          asOf: artifact.dataAsOf,
          source: artifact.publicationLabel + ' via data.gov.in (GODL)',
          url: typeof window !== 'undefined' ? window.location.href : 'https://www.indiatechcollective.org/corruption/',
          disclaimer: 'More registered cases can reflect more reporting or stronger enforcement, not just more corruption.',
        }}
        cardHref="/og/card-corruption-enforcement.png"
      />
    </div>
  );
}
