import { useEffect, useState } from 'react';
import BarList, { type BarListRow } from '../charts/BarList';
import ShareRow from './ShareRow';

/**
 * Lens B — representative disclosures. Party comparison of affidavit-declared
 * cases with hard minimum-sample suppression, plus the narrow reviewed
 * corruption-statute layer. Distinct dataset and unit from Lens A — never joined.
 */
interface Disclosures {
  cohortLabel: string;
  minPartySample: number;
  parties: Array<{
    partyId: string; party: string; partyShort: string;
    covered: number; withDeclared: number; withSeriousDeclared: number | null;
    withConvictions: number | null; missingRecords: number; pct: number | null; suppressed: boolean;
  }>;
  qualifyingRulesVersion: string;
  corruptionStatute: { covered: number; withQualifyingCase: number; note: string } | null;
  dataAsOf: string;
  notes: string[];
}

export default function DisclosuresLens() {
  const [artifact, setArtifact] = useState<Disclosures | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/corruption.disclosures.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setArtifact)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <p><strong>Could not load disclosure data.</strong></p>
        <p className="small">{error}. No placeholder numbers are shown.</p>
      </div>
    );
  }
  if (!artifact) return <div className="empty-state" role="status">Loading disclosure data…</div>;

  const cs = artifact.corruptionStatute;
  const rows: BarListRow[] = artifact.parties.slice(0, 14).map((p) => ({
    key: p.partyId,
    label: p.partyShort,
    value: p.suppressed ? null : p.pct,
    display: p.pct === null ? '—' : `${p.pct.toFixed(0)}%`,
    detail: `${p.withDeclared} of ${p.covered} covered${p.missingRecords ? ` · ${p.missingRecords} missing` : ''}`,
    suppressed: p.suppressed,
    suppressedNote: `Fewer than ${artifact.minPartySample} covered representatives — shown, never ranked.`,
  }));

  return (
    <div>
      <p className="result-note">
        Cohort: <strong>{artifact.cohortLabel}</strong> · party at election · minimum sample for comparison:{' '}
        {artifact.minPartySample} covered representatives.
      </p>

      <h3 style={{ fontSize: '1.05rem', marginTop: '0.8rem' }}>Declared cases by party</h3>
      <BarList rows={rows} max={100} ariaLabel="Percent of covered representatives declaring at least one case, by party at election" />
      <p className="metric-caption">
        % of covered representatives in the party declaring ≥1 criminal case in their 2024 affidavit; count and
        denominator shown per row. {artifact.parties.length - 14 > 0 ? `${artifact.parties.length - 14} smaller parties omitted from the chart appear in the politicians table and CSV.` : ''}
        {' '}Parties below the minimum sample are visible but never ranked. Later defections are not reflected.
      </p>

      <h3 style={{ fontSize: '1.05rem', marginTop: '1.6rem' }}>The corruption-statute layer (narrow, reviewed)</h3>
      {cs ? (
        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))' }}>
          <div className="kpi">
            <span className="kpi-label">Declared a PC Act case</span>
            <span className="kpi-value num">{cs.withQualifyingCase}</span>
            <span className="kpi-frac num">of {cs.covered} covered representatives</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Qualification rules</span>
            <span className="kpi-value" style={{ fontSize: '1.2rem' }}>v{artifact.qualifyingRulesVersion}</span>
            <span className="kpi-frac">PC Act 1988 + mapped predecessor only</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">Insufficient reviewed case-level records — no corruption-statute comparison is shown.</div>
      )}
      {cs && <p className="metric-caption">{cs.note}</p>}

      <ShareRow
        spec={{
          headline: `Party-wise affidavit disclosures — ${artifact.cohortLabel}`,
          definition: 'Share of covered representatives per party declaring ≥1 case in their sworn 2024 affidavit (people, not cases; visible denominators; small parties suppressed from ranking).',
          asOf: artifact.dataAsOf,
          source: 'ADR/NEW analysis of ECI affidavits',
          url: typeof window !== 'undefined' ? window.location.href : 'https://www.indiatechcollective.org/corruption/',
        }}
      />
    </div>
  );
}
