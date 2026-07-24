import type { MetricResult, PoliticianIndexRow } from '../schemas/artifacts';
import type { CriminalCase } from '../schemas/entities';
import { pctOf } from '../format';
import { METRIC_DEFS } from './registry';

/**
 * All displayed numbers come from these pure functions. Every result carries
 * its numerator, denominator, unit, as-of date, and displayed definition.
 * Null-valued inputs mean "unknown" and shrink the denominator — a missing
 * affidavit never becomes a zero-case affidavit.
 */

interface Ctx {
  asOf: string;
  sourceIds: string[];
}

function result(
  metricId: keyof typeof METRIC_DEFS,
  value: number | null,
  ctx: Ctx,
  extra: Partial<MetricResult> = {}
): MetricResult {
  const def = METRIC_DEFS[metricId];
  return {
    metricId,
    label: def.label,
    value,
    unit: def.unit,
    asOf: ctx.asOf,
    sourceIds: ctx.sourceIds,
    definition: def.definition,
    ...extra,
  };
}

/** Rows with any affidavit-derived case data (summary or parsed). */
export const coveredRows = (rows: PoliticianIndexRow[]) => rows.filter((r) => r.declaredCases !== null);

export function repsCovered(rows: PoliticianIndexRow[], expectedSeats: number, ctx: Ctx): MetricResult {
  const covered = coveredRows(rows).length;
  return result('reps_covered', covered, ctx, { numerator: covered, denominator: expectedSeats });
}

export function repsWithDeclaredCasesPct(rows: PoliticianIndexRow[], ctx: Ctx): MetricResult {
  const covered = coveredRows(rows);
  const withCases = covered.filter((r) => (r.declaredCases ?? 0) > 0).length;
  return result('reps_with_declared_cases_pct', pctOf(withCases, covered.length), ctx, {
    numerator: withCases,
    denominator: covered.length,
  });
}

export function repsWithSeriousCasesPct(rows: PoliticianIndexRow[], ctx: Ctx): MetricResult {
  const covered = rows.filter((r) => r.hasSeriousDeclared !== null);
  const withSerious = covered.filter((r) => r.hasSeriousDeclared === true).length;
  return result('reps_with_serious_cases_pct', pctOf(withSerious, covered.length), ctx, {
    numerator: withSerious,
    denominator: covered.length,
  });
}

export function repsWithConvictionsCount(rows: PoliticianIndexRow[], ctx: Ctx): MetricResult {
  const covered = rows.filter((r) => r.convictionsDeclared !== null);
  const n = covered.filter((r) => (r.convictionsDeclared ?? 0) > 0).length;
  return result('reps_with_convictions', covered.length === 0 ? null : n, ctx, {
    numerator: n,
    denominator: covered.length,
  });
}

export function totalDeclaredCases(rows: PoliticianIndexRow[], ctx: Ctx): MetricResult {
  const covered = coveredRows(rows);
  const total = covered.reduce((acc, r) => acc + (r.declaredCases ?? 0), 0);
  return result('total_declared_cases', covered.length === 0 ? null : total, ctx, {
    denominator: covered.length,
  });
}

export function affidavitsLinked(rows: PoliticianIndexRow[], ctx: Ctx): MetricResult {
  const linked = rows.filter((r) => r.affidavitStatus !== 'missing').length;
  return result('affidavits_linked', linked, ctx, { numerator: linked, denominator: rows.length });
}

export function coveragePct(covered: number, expectedSeats: number, ctx: Ctx): MetricResult {
  return result('coverage_pct', pctOf(covered, expectedSeats), ctx, {
    numerator: covered,
    denominator: expectedSeats,
  });
}

/** One person with N cases counts once. Input is case rows; output counts distinct people. */
export function peopleWithCases(cases: CriminalCase[]): number {
  return new Set(cases.map((c) => c.politicianId)).size;
}

export interface PartyRow {
  partyId: string;
  party: string;
  partyShort: string;
  covered: number;
  withDeclared: number;
  withSeriousDeclared: number | null;
  withConvictions: number | null;
  missingRecords: number;
  pct: number | null;
  suppressed: boolean;
}

/**
 * Party comparison with a minimum-sample rule: parties below minN keep their
 * raw numerator/denominator but are flagged suppressed and must not be ranked.
 */
export function partyBreakdown(rows: PoliticianIndexRow[], minN = 5): PartyRow[] {
  const byParty = new Map<string, PoliticianIndexRow[]>();
  for (const r of rows) {
    const list = byParty.get(r.partyId) ?? [];
    list.push(r);
    byParty.set(r.partyId, list);
  }
  const out: PartyRow[] = [];
  for (const [partyId, members] of byParty) {
    const covered = members.filter((r) => r.declaredCases !== null);
    const seriousCovered = members.filter((r) => r.hasSeriousDeclared !== null);
    const convCovered = members.filter((r) => r.convictionsDeclared !== null);
    const withDeclared = covered.filter((r) => (r.declaredCases ?? 0) > 0).length;
    out.push({
      partyId,
      party: members[0].party,
      partyShort: members[0].partyShort,
      covered: covered.length,
      withDeclared,
      withSeriousDeclared:
        seriousCovered.length === 0 ? null : seriousCovered.filter((r) => r.hasSeriousDeclared === true).length,
      withConvictions:
        convCovered.length === 0 ? null : convCovered.filter((r) => (r.convictionsDeclared ?? 0) > 0).length,
      missingRecords: members.length - covered.length,
      pct: pctOf(withDeclared, covered.length),
      suppressed: covered.length < minN,
    });
  }
  return out.sort((a, b) => b.covered - a.covered || a.partyShort.localeCompare(b.partyShort));
}

export interface StateRow {
  state: string;
  stateName: string;
  members: number;
  covered: number;
  withDeclared: number;
  pct: number | null;
}

export function stateBreakdown(rows: PoliticianIndexRow[]): StateRow[] {
  const byState = new Map<string, PoliticianIndexRow[]>();
  for (const r of rows) {
    const list = byState.get(r.state) ?? [];
    list.push(r);
    byState.set(r.state, list);
  }
  const out: StateRow[] = [];
  for (const [state, members] of byState) {
    const covered = members.filter((r) => r.declaredCases !== null);
    const withDeclared = covered.filter((r) => (r.declaredCases ?? 0) > 0).length;
    out.push({
      state,
      stateName: members[0].stateName,
      members: members.length,
      covered: covered.length,
      withDeclared,
      pct: pctOf(withDeclared, covered.length),
    });
  }
  return out.sort((a, b) => a.stateName.localeCompare(b.stateName));
}

/** Derived rate from a source's own columns. Null when either side is missing — never invented. */
export function deriveRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  return pctOf(numerator, denominator);
}
