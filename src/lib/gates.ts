import type { Affidavit, CriminalCase } from './schemas/entities';
import type { AuditFinding } from './schemas/stats';
import type { MetricResult } from './schemas/artifacts';
import type { PartyRow } from './metrics';

/**
 * Honesty gates. Pure functions returning human-readable violation strings;
 * scripts/data-check.ts runs them against the real artifacts and fails the
 * production build on any violation.
 */

const DISPLAYABLE_REVIEW = new Set(['machine_checked', 'human_verified']);

/** Every adverse claim needs ≥1 source, a status-as-of date, and a displayable review state. */
export function checkAdverseClaims(cases: CriminalCase[], affidavits: Affidavit[]): string[] {
  const errors: string[] = [];
  for (const c of cases) {
    if (c.sourceIds.length === 0) errors.push(`case ${c.id}: adverse claim with no sourceIds`);
    if (!c.statusAsOf) errors.push(`case ${c.id}: adverse claim with no statusAsOf`);
    if (!DISPLAYABLE_REVIEW.has(c.reviewStatus))
      errors.push(`case ${c.id}: reviewStatus "${c.reviewStatus}" may not be displayed`);
  }
  for (const a of affidavits) {
    const s = a.declaredSummary;
    if (!s) continue;
    const adverse = (s.pendingCases ?? 0) > 0 || (s.convictions ?? 0) > 0 || s.hasSeriousDeclared === true;
    if (!adverse) continue;
    if (s.sourceIds.length === 0) errors.push(`affidavit ${a.id}: adverse summary with no sourceIds`);
    if (!DISPLAYABLE_REVIEW.has(a.reviewStatus))
      errors.push(`affidavit ${a.id}: adverse summary with reviewStatus "${a.reviewStatus}"`);
  }
  return errors;
}

/** Fixture markers must never reach production artifacts. */
export function checkNoFixtureMarkers(artifactJson: string, artifactName: string): string[] {
  const errors: string[] = [];
  if (artifactJson.includes('"fixture"')) errors.push(`${artifactName}: contains a "fixture" marker`);
  if (/"id"\s*:\s*"fx-/.test(artifactJson)) errors.push(`${artifactName}: contains fx- fixture ids`);
  if (artifactJson.includes('"DEMO"')) errors.push(`${artifactName}: contains DEMO dataset tag`);
  return errors;
}

export function checkMetricSanity(metrics: MetricResult[]): string[] {
  const errors: string[] = [];
  for (const m of metrics) {
    if (m.numerator !== undefined && m.denominator !== undefined && m.numerator > m.denominator) {
      errors.push(`metric ${m.metricId}: numerator ${m.numerator} > denominator ${m.denominator}`);
    }
    if (m.unit === 'percent' && m.value !== null && (m.value < 0 || m.value > 100)) {
      errors.push(`metric ${m.metricId}: percent value ${m.value} out of range`);
    }
    if (m.value !== null && m.value < 0) errors.push(`metric ${m.metricId}: negative value`);
    if (!m.definition) errors.push(`metric ${m.metricId}: missing displayed definition`);
    if (m.sourceIds.length === 0) errors.push(`metric ${m.metricId}: no sourceIds`);
  }
  return errors;
}

/** Parties under the minimum sample must be flagged suppressed (shown, never ranked). */
export function checkPartySuppression(parties: PartyRow[], minN: number): string[] {
  const errors: string[] = [];
  for (const p of parties) {
    if (p.covered < minN && !p.suppressed)
      errors.push(`party ${p.partyId}: covered=${p.covered} < ${minN} but not suppressed`);
    if (p.withDeclared > p.covered)
      errors.push(`party ${p.partyId}: withDeclared ${p.withDeclared} > covered ${p.covered}`);
  }
  return errors;
}

/**
 * Audit findings: empty in production until extraction + review exists.
 * Any present finding must carry review state and its non-adjudication label.
 */
export function checkAuditFindings(findings: AuditFinding[]): string[] {
  const errors: string[] = [];
  for (const f of findings) {
    if (!DISPLAYABLE_REVIEW.has(f.reviewStatus))
      errors.push(`auditFinding ${f.id}: reviewStatus "${f.reviewStatus}" may not be displayed`);
    if (f.amount && !f.amount.amountType) errors.push(`auditFinding ${f.id}: amount without amountType`);
  }
  return errors;
}

/** Index-row consistency: missing affidavit == null counts (never zero), and vice versa. */
export function checkIndexRowConsistency(
  rows: Array<{ id: string; affidavitStatus: string; declaredCases: number | null; hasCaseRecords: boolean }>
): string[] {
  const errors: string[] = [];
  for (const r of rows) {
    if (r.affidavitStatus === 'missing' && r.declaredCases !== null)
      errors.push(`row ${r.id}: affidavit missing but declaredCases=${r.declaredCases} (must be null)`);
    if (r.affidavitStatus !== 'missing' && r.declaredCases === null)
      errors.push(`row ${r.id}: affidavit ${r.affidavitStatus} but declaredCases is null`);
    if (r.hasCaseRecords && r.affidavitStatus !== 'case_rows_parsed')
      errors.push(`row ${r.id}: hasCaseRecords without case_rows_parsed status`);
  }
  return errors;
}
