import { describe, expect, it } from 'vitest';
import {
  checkAdverseClaims,
  checkNoFixtureMarkers,
  checkMetricSanity,
  checkPartySuppression,
  checkIndexRowConsistency,
} from '../../src/lib/gates';
import type { CriminalCase } from '../../src/lib/schemas/entities';
import type { MetricResult } from '../../src/lib/schemas/artifacts';

const baseCase: CriminalCase = {
  id: 'case-1',
  affidavitId: 'aff-1',
  politicianId: 'pol-1',
  declarationType: 'pending',
  actsSectionsRaw: 'IPC 147',
  normalizedProvisions: [],
  declaredStatus: 'Pending',
  statusAsOf: '2024-04-04',
  corruptionQualification: 'no',
  reviewStatus: 'machine_checked',
  sourceIds: ['eci-affidavit-portal'],
};

describe('adverse-claim gate', () => {
  it('passes sourced, dated, reviewed records', () => {
    expect(checkAdverseClaims([baseCase], [])).toEqual([]);
  });
  it('fails unreviewed adverse records', () => {
    const errs = checkAdverseClaims([{ ...baseCase, reviewStatus: 'unreviewed' }], []);
    expect(errs.length).toBeGreaterThan(0);
  });
  it('fails rejected adverse records', () => {
    expect(checkAdverseClaims([{ ...baseCase, reviewStatus: 'rejected' }], []).length).toBeGreaterThan(0);
  });
});

describe('fixture isolation gate', () => {
  it('flags fixture markers in production artifacts', () => {
    expect(checkNoFixtureMarkers('{"fixture": true}', 'x.json').length).toBe(1);
    expect(checkNoFixtureMarkers('{"id": "fx-abc"}', 'x.json').length).toBe(1);
    expect(checkNoFixtureMarkers('{"tag": "DEMO"}', 'x.json').length).toBe(1);
  });
  it('passes clean artifacts', () => {
    expect(checkNoFixtureMarkers('{"id": "pol-abc"}', 'x.json')).toEqual([]);
  });
});

describe('metric sanity gate', () => {
  const m = (over: Partial<MetricResult>): MetricResult => ({
    metricId: 'reps_with_declared_cases_pct',
    label: 'x',
    value: 10,
    unit: 'percent',
    asOf: '2024-06-06',
    sourceIds: ['adr-ls2024-report'],
    definition: 'def',
    ...over,
  });
  it('fails numerator > denominator', () => {
    expect(checkMetricSanity([m({ numerator: 10, denominator: 5 })]).length).toBe(1);
  });
  it('fails out-of-range percents and negatives', () => {
    expect(checkMetricSanity([m({ value: 140 })]).length).toBe(1);
    expect(checkMetricSanity([m({ value: -1, unit: 'people' })]).length).toBe(1);
  });
  it('fails missing definition or sources', () => {
    expect(checkMetricSanity([m({ definition: '' })]).length).toBe(1);
    expect(checkMetricSanity([m({ sourceIds: [] })]).length).toBe(1);
  });
});

describe('party suppression gate', () => {
  it('fails unsuppressed small samples', () => {
    const errs = checkPartySuppression(
      [
        {
          partyId: 'x',
          party: 'X',
          partyShort: 'X',
          covered: 2,
          withDeclared: 1,
          withSeriousDeclared: null,
          withConvictions: null,
          missingRecords: 0,
          pct: 50,
          suppressed: false,
        },
      ],
      5
    );
    expect(errs.length).toBe(1);
  });
});

describe('index-row consistency gate', () => {
  it('missing affidavit must mean null counts', () => {
    const errs = checkIndexRowConsistency([
      { id: 'a', affidavitStatus: 'missing', declaredCases: 0, hasCaseRecords: false },
    ]);
    expect(errs.length).toBe(1);
  });
  it('null counts require missing status', () => {
    const errs = checkIndexRowConsistency([
      { id: 'a', affidavitStatus: 'summary_only', declaredCases: null, hasCaseRecords: false },
    ]);
    expect(errs.length).toBe(1);
  });
});
