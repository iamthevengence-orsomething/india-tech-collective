import { describe, expect, it } from 'vitest';
import {
  affidavitSchema,
  criminalCaseSchema,
  corruptionStateStatSchema,
  auditFindingSchema,
  membershipSchema,
  politicianIndexRowSchema,
  AUDIT_FINDING_LABEL,
} from '../../src/lib/schemas';

const validCase = {
  id: 'case-1',
  affidavitId: 'aff-1',
  politicianId: 'pol-1',
  declarationType: 'pending',
  actsSectionsRaw: 'IPC Sections 147, 148',
  normalizedProvisions: [{ actId: 'in-act-ipc-1860', section: '147', mappingStatus: 'reviewed_alias' }],
  declaredStatus: 'Pending trial',
  statusAsOf: '2024-04-04',
  corruptionQualification: 'no',
  reviewStatus: 'machine_checked',
  sourceIds: ['eci-affidavit-portal'],
};

describe('criminalCase schema', () => {
  it('accepts a valid record', () => {
    expect(criminalCaseSchema.safeParse(validCase).success).toBe(true);
  });
  it('rejects an empty sourceIds list (adverse claim must be sourced)', () => {
    expect(criminalCaseSchema.safeParse({ ...validCase, sourceIds: [] }).success).toBe(false);
  });
  it('rejects a missing statusAsOf', () => {
    const { statusAsOf: _omit, ...rest } = validCase;
    expect(criminalCaseSchema.safeParse(rest).success).toBe(false);
  });
  it('rejects an invalid declarationType', () => {
    expect(criminalCaseSchema.safeParse({ ...validCase, declarationType: 'guilty' }).success).toBe(false);
  });
  it('rejects malformed dates', () => {
    expect(criminalCaseSchema.safeParse({ ...validCase, statusAsOf: '04-04-2024' }).success).toBe(false);
  });
  it('rejects unknown extra fields (strict objects)', () => {
    expect(criminalCaseSchema.safeParse({ ...validCase, dangerScore: 9 }).success).toBe(false);
  });
});

describe('affidavit schema', () => {
  const valid = {
    id: 'aff-1',
    politicianId: 'pol-1',
    electionId: 'ls-2024',
    sourceUrl: 'https://affidavit.eci.gov.in/some.pdf',
    languageCodes: ['en'],
    extractionMethod: 'pdf_text',
    parserVersion: '1.0.0',
    reviewStatus: 'machine_checked',
    lastVerifiedAt: '2026-07-24T00:00:00Z',
    sourceIds: ['eci-affidavit-portal'],
  };
  it('accepts a valid record', () => {
    expect(affidavitSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects negative declared counts', () => {
    const bad = {
      ...valid,
      declaredSummary: {
        pendingCases: -1,
        hasSeriousDeclared: null,
        convictions: null,
        basis: 'published_report',
        sourceIds: ['adr-ls2024-report'],
      },
    };
    expect(affidavitSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a bad review status', () => {
    expect(affidavitSchema.safeParse({ ...valid, reviewStatus: 'trusted' }).success).toBe(false);
  });
});

describe('membership schema', () => {
  const valid = {
    id: 'mem-1',
    politicianId: 'pol-1',
    electionId: 'ls-2024',
    houseType: 'lok_sabha',
    partyAtElectionId: 'bjp',
    status: 'winner_at_election',
    statusAsOf: '2024-06-06',
    sourceIds: ['ogd-ls2024-results'],
  };
  it('accepts a valid record', () => {
    expect(membershipSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects an invalid membership status', () => {
    expect(membershipSchema.safeParse({ ...valid, status: 'expelled_maybe' }).success).toBe(false);
  });
});

describe('corruptionStateStat schema', () => {
  const valid = {
    id: 'ncrb-2023-MH-registered',
    year: 2023,
    stateCode: 'MH',
    agencyScope: 'acb_vigilance_lokayukta',
    statuteScope: 'pc_act_1988',
    metricId: 'cases_registered',
    value: 100,
    unit: 'cases',
    sourceIds: ['ogd-ncrb-pca-registered-2023'],
    notes: [],
  };
  it('accepts a valid record and null values (not published)', () => {
    expect(corruptionStateStatSchema.safeParse(valid).success).toBe(true);
    expect(corruptionStateStatSchema.safeParse({ ...valid, value: null }).success).toBe(true);
  });
  it('rejects a bad state code', () => {
    expect(corruptionStateStatSchema.safeParse({ ...valid, stateCode: 'Maharashtra' }).success).toBe(false);
  });
});

describe('auditFinding schema', () => {
  it('requires the non-adjudication label and typed amounts', () => {
    const base = {
      id: 'audit-1',
      reportTitle: 'Report 1 of 2026',
      publishingAuthority: 'CAG of India',
      jurisdiction: { level: 'union' },
      findingTitle: 'Example finding',
      summary: 'Example summary',
      sourcePdfUrl: 'https://cag.gov.in/some.pdf',
      reviewStatus: 'human_verified',
      label: AUDIT_FINDING_LABEL,
      sourceIds: ['cag-report-search'],
    };
    expect(auditFindingSchema.safeParse(base).success).toBe(true);
    expect(auditFindingSchema.safeParse({ ...base, label: 'Money lost!' }).success).toBe(false);
    expect(
      auditFindingSchema.safeParse({
        ...base,
        amount: { value: 100, currency: 'INR' },
      }).success
    ).toBe(false);
    expect(
      auditFindingSchema.safeParse({
        ...base,
        amount: { value: 100, currency: 'INR', amountType: 'short_levy' },
      }).success
    ).toBe(true);
  });
});

describe('politician index row', () => {
  const valid = {
    id: 'pol-1',
    slug: 'a-b',
    name: 'A',
    house: 'lok_sabha',
    electionId: 'ls-2024',
    state: 'MH',
    stateName: 'Maharashtra',
    constituency: 'Mumbai North',
    partyId: 'bjp',
    party: 'Bharatiya Janata Party',
    partyShort: 'BJP',
    declaredCases: null,
    hasSeriousDeclared: null,
    convictionsDeclared: null,
    hasCaseRecords: false,
    pcActCase: null,
    chargesFramedAny: null,
    affidavitStatus: 'missing',
    reviewStatus: 'unreviewed',
    membershipStatus: 'winner_at_election',
    statusAsOf: '2024-06-06',
  };
  it('accepts null counts for missing affidavits (never zero-filled)', () => {
    expect(politicianIndexRowSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects negative counts', () => {
    expect(politicianIndexRowSchema.safeParse({ ...valid, declaredCases: -2 }).success).toBe(false);
  });
});
