import { describe, expect, it } from 'vitest';
import {
  repsWithDeclaredCasesPct,
  repsWithConvictionsCount,
  totalDeclaredCases,
  partyBreakdown,
  stateBreakdown,
  peopleWithCases,
  coveragePct,
  deriveRate,
} from '../../src/lib/metrics';
import type { PoliticianIndexRow } from '../../src/lib/schemas/artifacts';
import type { CriminalCase } from '../../src/lib/schemas/entities';

const ctx = { asOf: '2024-06-06', sourceIds: ['adr-ls2024-report'] };

function row(over: Partial<PoliticianIndexRow>): PoliticianIndexRow {
  return {
    id: 'pol-x',
    slug: 'x-y',
    name: 'X',
    house: 'lok_sabha',
    electionId: 'ls-2024',
    state: 'MH',
    stateName: 'Maharashtra',
    constituency: 'C',
    partyId: 'bjp',
    party: 'Bharatiya Janata Party',
    partyShort: 'BJP',
    declaredCases: 0,
    hasSeriousDeclared: false,
    convictionsDeclared: null,
    hasCaseRecords: false,
    affidavitStatus: 'summary_only',
    reviewStatus: 'machine_checked',
    membershipStatus: 'winner_at_election',
    statusAsOf: '2024-06-06',
    ...over,
  };
}

describe('representative KPIs', () => {
  it('missing affidavits shrink the denominator instead of counting as zero cases', () => {
    const rows = [
      row({ id: 'p1', declaredCases: 2 }),
      row({ id: 'p2', declaredCases: 0 }),
      row({ id: 'p3', declaredCases: null, affidavitStatus: 'missing' }),
    ];
    const m = repsWithDeclaredCasesPct(rows, ctx);
    expect(m.numerator).toBe(1);
    expect(m.denominator).toBe(2); // p3 excluded, not counted as 0
    expect(m.value).toBeCloseTo(50);
  });

  it('numerator never exceeds denominator', () => {
    const rows = [row({ id: 'p1', declaredCases: 5 }), row({ id: 'p2', declaredCases: 1 })];
    const m = repsWithDeclaredCasesPct(rows, ctx);
    expect(m.numerator!).toBeLessThanOrEqual(m.denominator!);
  });

  it('conviction KPI is null when no conviction data was imported', () => {
    const rows = [row({ id: 'p1' }), row({ id: 'p2' })];
    const m = repsWithConvictionsCount(rows, ctx);
    expect(m.value).toBeNull();
  });

  it('total declared cases counts declaration rows, coverage stays visible', () => {
    const rows = [row({ id: 'p1', declaredCases: 3 }), row({ id: 'p2', declaredCases: 0 })];
    const m = totalDeclaredCases(rows, ctx);
    expect(m.value).toBe(3);
    expect(m.denominator).toBe(2);
  });

  it('empty cohort yields null percent, not 0%', () => {
    const m = repsWithDeclaredCasesPct([], ctx);
    expect(m.value).toBeNull();
  });
});

describe('person-level dedup', () => {
  it('one person with several cases counts once', () => {
    const cases = [
      { politicianId: 'p1' },
      { politicianId: 'p1' },
      { politicianId: 'p1' },
      { politicianId: 'p2' },
    ] as CriminalCase[];
    expect(peopleWithCases(cases)).toBe(2);
  });
});

describe('party breakdown', () => {
  it('applies the minimum-sample suppression flag but keeps raw n/d', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row({ id: `a${i}`, partyId: 'bjp', declaredCases: i % 2 })),
      ...Array.from({ length: 2 }, (_, i) =>
        row({ id: `b${i}`, partyId: 'kec', party: 'Kerala Congress', partyShort: 'KEC', declaredCases: 1 })
      ),
    ];
    const parties = partyBreakdown(rows, 5);
    const big = parties.find((p) => p.partyId === 'bjp')!;
    const small = parties.find((p) => p.partyId === 'kec')!;
    expect(big.suppressed).toBe(false);
    expect(small.suppressed).toBe(true);
    expect(small.covered).toBe(2);
    expect(small.withDeclared).toBe(2);
  });

  it('members without affidavit data appear as missingRecords, not in the denominator', () => {
    const rows = [
      row({ id: 'a1', partyId: 'sp', declaredCases: 1 }),
      row({ id: 'a2', partyId: 'sp', declaredCases: null, affidavitStatus: 'missing' }),
    ];
    const p = partyBreakdown(rows, 1).find((x) => x.partyId === 'sp')!;
    expect(p.covered).toBe(1);
    expect(p.missingRecords).toBe(1);
  });
});

describe('state breakdown and coverage', () => {
  it('groups by state with null-aware coverage', () => {
    const rows = [
      row({ id: 'p1', state: 'UP', stateName: 'Uttar Pradesh', declaredCases: 1 }),
      row({ id: 'p2', state: 'UP', stateName: 'Uttar Pradesh', declaredCases: null, affidavitStatus: 'missing' }),
      row({ id: 'p3', state: 'KL', stateName: 'Kerala', declaredCases: 0 }),
    ];
    const states = stateBreakdown(rows);
    const up = states.find((s) => s.state === 'UP')!;
    expect(up.members).toBe(2);
    expect(up.covered).toBe(1);
    expect(up.withDeclared).toBe(1);
  });

  it('coveragePct uses expected seats as denominator', () => {
    const m = coveragePct(500, 543, ctx);
    expect(m.value).toBeCloseTo((500 / 543) * 100);
  });

  it('deriveRate returns null when either side is missing', () => {
    expect(deriveRate(null, 10)).toBeNull();
    expect(deriveRate(5, null)).toBeNull();
    expect(deriveRate(5, 10)).toBeCloseTo(50);
  });
});
