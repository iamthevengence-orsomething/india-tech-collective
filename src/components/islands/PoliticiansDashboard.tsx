import { useEffect, useMemo, useState } from 'react';
import type { PoliticiansIndexArtifact, PoliticianIndexRow } from '../../lib/schemas/artifacts';
import { partyBreakdown, stateBreakdown } from '../../lib/metrics';
import { readUrlState, writeUrlState, type FilterState } from '../../lib/url-state';
import { normalizeName } from '../../lib/slug';
import { DEFAULT_DISCLAIMER } from '../../lib/share';
import BarList, { type BarListRow } from '../charts/BarList';
import StateGrid, { type StateTileDatum } from '../charts/StateGrid';
import DataTable from '../charts/DataTable';
import ShareRow from './ShareRow';

const FILTER_KEYS = ['q', 'state', 'party', 'cases', 'statute', 'stage', 'review', 'cmpmode', 'cmp'];

const CASES_OPTIONS = [
  { value: '', label: 'Any declared-case status' },
  { value: 'with', label: 'Declared ≥1 case' },
  { value: 'without', label: 'Declared no cases' },
  { value: 'serious', label: 'Meets serious-case criteria' },
  { value: 'convictions', label: 'Declared a conviction' },
];

function applyFilters(rows: PoliticianIndexRow[], f: FilterState): PoliticianIndexRow[] {
  const q = f.q ? normalizeName(f.q) : '';
  const states = f.state ? f.state.split(',').filter(Boolean) : [];
  return rows.filter((r) => {
    if (q) {
      const hay = normalizeName(`${r.name} ${r.constituency} ${r.stateName} ${r.party} ${r.partyShort}`);
      if (!hay.includes(q)) return false;
    }
    if (states.length && !states.includes(r.state)) return false;
    if (f.party && r.partyId !== f.party) return false;
    if (f.cases === 'with' && !((r.declaredCases ?? 0) > 0)) return false;
    if (f.cases === 'without' && r.declaredCases !== 0) return false;
    if (f.cases === 'serious' && r.hasSeriousDeclared !== true) return false;
    if (f.cases === 'convictions' && !((r.convictionsDeclared ?? 0) > 0)) return false;
    if (f.statute === 'pcact' && r.pcActCase !== true) return false;
    if (f.stage === 'chargesframed' && r.chargesFramedAny !== true) return false;
    if (f.review && r.reviewStatus !== f.review) return false;
    return true;
  });
}

function CompareTray({
  rows,
  mode,
  keys,
  onClear,
}: {
  rows: PoliticianIndexRow[];
  mode: 'states' | 'parties';
  keys: string[];
  onClear: () => void;
}) {
  if (keys.length < 2) return null;
  const groups = keys.slice(0, 3).map((k) => {
    const members = rows.filter((r) => (mode === 'states' ? r.state === k : r.partyId === k));
    const covered = members.filter((r) => r.declaredCases !== null);
    const withCases = covered.filter((r) => (r.declaredCases ?? 0) > 0).length;
    const serious = covered.filter((r) => r.hasSeriousDeclared === true).length;
    const conv = covered.filter((r) => (r.convictionsDeclared ?? 0) > 0).length;
    const label = mode === 'states' ? members[0]?.stateName ?? k : members[0]?.partyShort ?? k;
    return { k, label, members: members.length, covered: covered.length, withCases, serious, conv };
  });
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h3 style={{ fontSize: '1.05rem' }}>Compare ({mode === 'states' ? 'states/UTs' : 'parties'}, full cohort)</h3>
        <button type="button" className="btn btn-small" onClick={onClear}>Clear comparison</button>
      </div>
      <div className="table-scroll" style={{ marginTop: '0.7rem', border: 'none' }}>
        <table className="data">
          <caption className="visually-hidden">Side-by-side comparison of selected {mode}</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {groups.map((g) => <th scope="col" key={g.k}>{g.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">Members (2024 winners)</th>{groups.map((g) => <td className="num" key={g.k}>{g.members}</td>)}</tr>
            <tr><th scope="row">Covered (affidavit-derived data)</th>{groups.map((g) => <td className="num" key={g.k}>{g.covered}</td>)}</tr>
            <tr>
              <th scope="row">Declared ≥1 case</th>
              {groups.map((g) => (
                <td className="num" key={g.k}>
                  {g.withCases} ({g.covered ? ((g.withCases / g.covered) * 100).toFixed(0) : '—'}%)
                </td>
              ))}
            </tr>
            <tr><th scope="row">Serious-case criteria met</th>{groups.map((g) => <td className="num" key={g.k}>{g.serious}</td>)}</tr>
            <tr><th scope="row">Declared convictions</th>{groups.map((g) => <td className="num" key={g.k}>{g.conv}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="metric-caption">
        Denominator is covered representatives per group (visible above). Self-declared affidavit data; comparison
        reflects disclosures, not guilt.
      </p>
    </div>
  );
}

export default function PoliticiansDashboard() {
  const [artifact, setArtifact] = useState<PoliticiansIndexArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({});

  useEffect(() => {
    setFilters(readUrlState(FILTER_KEYS));
    const onPop = () => setFilters(readUrlState(FILTER_KEYS));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/politicians.index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setArtifact(j); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);

  const set = (key: string, value: string) => {
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (!value) delete next[key];
      writeUrlState(next);
      return next;
    });
  };
  const clearAll = () => {
    setFilters({});
    writeUrlState({});
  };

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <p><strong>Could not load the dataset.</strong></p>
        <p className="small">{error} — the underlying JSON is at <a href="/data/politicians.index.json">/data/politicians.index.json</a>. No placeholder numbers are shown.</p>
        <button className="btn btn-small" type="button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  if (!artifact) {
    return <div className="empty-state" role="status" aria-live="polite">Loading 543 representative records…</div>;
  }

  const rows = artifact.rows;
  const filtered = applyFilters(rows, filters);
  const selectedStates = filters.state ? filters.state.split(',').filter(Boolean) : [];

  const partiesAll = [...new Map(rows.map((r) => [r.partyId, { id: r.partyId, label: r.partyShort, name: r.party }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label));

  const partyRows = partyBreakdown(filtered, 5);
  const partyBars: BarListRow[] = partyRows.slice(0, 14).map((p) => ({
    key: p.partyId,
    label: p.partyShort,
    value: p.suppressed ? null : p.pct,
    display: p.pct === null ? '—' : `${p.pct.toFixed(0)}%`,
    detail: `${p.withDeclared} of ${p.covered} covered`,
    suppressed: p.suppressed,
    suppressedNote: `Fewer than 5 covered representatives (${p.covered}); shown but not ranked.`,
  }));

  const states = stateBreakdown(filtered);
  const tileData: StateTileDatum[] = states.map((s) => ({
    code: s.state,
    name: s.stateName,
    value: s.covered > 0 ? (s.withDeclared / s.covered) * 100 : null,
    detail: `${s.withDeclared} of ${s.covered} covered members declared ≥1 case`,
  }));

  const toggleState = (code: string) => {
    const nextStates = selectedStates.includes(code)
      ? selectedStates.filter((c) => c !== code)
      : [...selectedStates, code];
    set('state', nextStates.join(','));
  };

  const cmpMode = filters.cmpmode === 'parties' ? 'parties' : 'states';
  const cmpKeys = filters.cmp ? filters.cmp.split(',').filter(Boolean).slice(0, 3) : [];

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://www.indiatechcollective.org/politicians/';
  const activeFilterCount = FILTER_KEYS.filter((k) => filters[k]).length;

  return (
    <div>
      {/* ---------- filters ---------- */}
      <section className="section" aria-label="Search and filters">
        <div className="filter-bar" role="search">
          <input
            className="control search-box"
            type="search"
            placeholder="Find your MP, constituency, state or party…"
            aria-label="Search representative, constituency, state, house or party"
            value={filters.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
          />
          <select className="control" aria-label="Filter by state or union territory" value={selectedStates[0] && selectedStates.length === 1 ? selectedStates[0] : selectedStates.length > 1 ? '__multi' : ''} onChange={(e) => set('state', e.target.value === '__multi' ? filters.state ?? '' : e.target.value)}>
            <option value="">All states/UTs</option>
            {selectedStates.length > 1 && <option value="__multi">{selectedStates.length} selected (via tiles)</option>}
            {[...new Map(rows.map((r) => [r.state, r.stateName])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <select className="control" aria-label="Filter by party at election" value={filters.party ?? ''} onChange={(e) => set('party', e.target.value)}>
            <option value="">All parties (at election)</option>
            {partiesAll.map((p) => <option key={p.id} value={p.id} title={p.name}>{p.label}</option>)}
          </select>
          <select className="control" aria-label="Filter by declared-case status" value={filters.cases ?? ''} onChange={(e) => set('cases', e.target.value)}>
            {CASES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="control" aria-label="Filter by statute category" value={filters.statute ?? ''} onChange={(e) => set('statute', e.target.value)}>
            <option value="">Any statute</option>
            <option value="pcact">Prevention of Corruption Act (reviewed mapping)</option>
          </select>
          <select className="control" aria-label="Filter by case procedural stage" value={filters.stage ?? ''} onChange={(e) => set('stage', e.target.value)}>
            <option value="">Any stage (as declared)</option>
            <option value="chargesframed">Charges framed in ≥1 case</option>
          </select>
          <select className="control" aria-label="Filter by review status" value={filters.review ?? ''} onChange={(e) => set('review', e.target.value)}>
            <option value="">Any review status</option>
            <option value="machine_checked">Machine-checked</option>
            <option value="human_verified">Human-verified (none yet)</option>
          </select>
          <span className="fchip" title="All records derive from the June 2024 affidavit digest">House: Lok Sabha · Election: 2024</span>
          {activeFilterCount > 0 && (
            <button type="button" className="btn btn-small" onClick={clearAll}>Clear all filters</button>
          )}
        </div>
        <p className="result-note" role="status" aria-live="polite">
          Showing <strong className="num">{filtered.length}</strong> of {rows.length} representatives
          {filters.q ? ` matching “${filters.q}”` : ''}. Filters are saved in the page URL — copy it to share this exact view.
        </p>
      </section>

      {/* ---------- geography ---------- */}
      <section className="section" aria-labelledby="geo-h">
        <h2 className="section-title" id="geo-h">Where declared cases concentrate</h2>
        <p className="section-sub">
          Share of covered representatives (current filter) who declared at least one criminal case, by state/UT.
          Tiles approximate geography and depict no boundary; press a tile to filter by that state.
        </p>
        <StateGrid data={tileData} selected={selectedStates} onToggle={toggleState} metricLabel="% of covered representatives declaring ≥1 case" />
        <p className="metric-caption">
          People, not cases: one representative with several cases counts once. Denominators are visible per tile.
          Data as of {artifact.dataAsOf} · Source: ADR/NEW winners analysis of ECI affidavits + OGD results (GODL).
        </p>
      </section>

      {/* ---------- parties ---------- */}
      <section className="section" aria-labelledby="party-h">
        <h2 className="section-title" id="party-h">Party comparison</h2>
        <p className="section-sub">
          Percentage of covered representatives (current filter) declaring ≥1 case, by party at election. Sorted by
          party size; parties under 5 covered representatives are shown but never ranked.
        </p>
        <BarList rows={partyBars} max={100} ariaLabel="Percent of covered representatives declaring at least one case, by party" />
        {partyRows.length > 14 && <p className="small" style={{ marginTop: '0.5rem', color: 'var(--faint)' }}>{partyRows.length - 14} smaller parties are in the table below and the CSV download.</p>}
        <p className="metric-caption">
          party_at_election as recorded in the winners analysis — later defections are not reflected. Count and
          percentage shown together; denominator = covered representatives in that party within the current filter.
        </p>
      </section>

      {/* ---------- statute categories ---------- */}
      <section className="section" aria-labelledby="cat-h">
        <h2 className="section-title" id="cat-h">Case categories (by statute)</h2>
        <p className="section-sub">
          Distinct representatives with ≥1 declared case citing each statute — from the reviewed statute dictionary,
          full cohort (not affected by filters). Raw affidavit text is preserved on every profile.
        </p>
        <BarList
          rows={artifact.actCategories.slice(0, 10).map((c) => ({
            key: c.actId,
            label: c.label,
            value: c.people,
            display: `${c.people} people`,
            detail: `${c.cases} declared cases`,
            suppressed: !c.mapped,
            suppressedNote: 'Raw statute text that has not been mapped to the dictionary; excluded from any category ranking.',
          }))}
          ariaLabel="Representatives per statute category"
        />
        <p className="metric-caption">
          A case citing several statutes appears in each cited category; categories therefore do not sum to the case
          total. Mappings: statute dictionary v1 (see /methodology/).
        </p>
      </section>

      {/* ---------- compare ---------- */}
      <section className="section" aria-labelledby="cmp-h">
        <h2 className="section-title" id="cmp-h">Compare states or parties</h2>
        <div className="filter-bar">
          <label htmlFor="cmpmode">Compare</label>
          <select id="cmpmode" className="control" value={cmpMode} onChange={(e) => { set('cmpmode', e.target.value); set('cmp', ''); }}>
            <option value="states">States/UTs</option>
            <option value="parties">Parties</option>
          </select>
          {[0, 1, 2].map((i) => (
            <select
              key={i}
              className="control"
              aria-label={`Comparison slot ${i + 1}`}
              value={cmpKeys[i] ?? ''}
              onChange={(e) => {
                const next = [...cmpKeys];
                next[i] = e.target.value;
                set('cmp', next.filter(Boolean).join(','));
              }}
            >
              <option value="">{i < 2 ? `Pick ${cmpMode === 'states' ? 'a state' : 'a party'}…` : 'Optional third…'}</option>
              {(cmpMode === 'states'
                ? [...new Map(rows.map((r) => [r.state, r.stateName])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => ({ v, l }))
                : partiesAll.map((p) => ({ v: p.id, l: p.label }))
              ).map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
        <CompareTray rows={rows} mode={cmpMode} keys={cmpKeys} onClear={() => set('cmp', '')} />
        {cmpKeys.length < 2 && <p className="small" style={{ color: 'var(--faint)' }}>Pick two or three to see a side-by-side comparison (full cohort, visible denominators).</p>}
      </section>

      {/* ---------- table ---------- */}
      <section className="section" aria-labelledby="table-h">
        <h2 className="section-title" id="table-h">All representatives</h2>
        <DataTable rows={filtered} />
      </section>

      {/* ---------- downloads + share ---------- */}
      <section className="section" aria-labelledby="dl-h">
        <h2 className="section-title" id="dl-h">Take the data with you</h2>
        <div className="share-row">
          <a className="btn btn-small" href="/downloads/representatives-ls2024.csv" download>Download CSV</a>
          <a className="btn btn-small" href="/downloads/representatives-ls2024.json" download>Download JSON</a>
          <a className="btn btn-small" href="/downloads/README.txt">Provenance &amp; licence</a>
        </div>
        <ShareRow
          spec={{
            headline: `Cases declared by elected representatives — ${filtered.length} of ${rows.length} MPs in this view`,
            definition:
              'Criminal cases self-declared in sworn 2024 election affidavits (people, not cases; visible denominators).',
            asOf: artifact.dataAsOf,
            source: 'ADR/National Election Watch analysis of ECI affidavits; OGD election results (GODL)',
            url: shareUrl,
            disclaimer: DEFAULT_DISCLAIMER,
          }}
          cardHref="/og/card-politicians.png"
        />
      </section>
    </div>
  );
}
