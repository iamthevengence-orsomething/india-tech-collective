/**
 * make-fixtures — generate the clearly-labelled DEMO dataset used by
 * DATA_MODE=demo builds and UI tests. Every record carries "fixture": true and
 * fx- ids; scripts/data-check.ts refuses these markers in production artifacts.
 * Output is schema-validated here so fixtures can never drift from contracts.
 */
import { mkdirSync } from 'node:fs';
import {
  politiciansIndexArtifactSchema, kpisArtifactSchema, coverageArtifactSchema,
  corruptionStatsArtifactSchema, disclosuresArtifactSchema, buildInfoSchema,
} from '../src/lib/schemas';
import { writeJson } from './lib/util';

const OUT = 'tests/fixtures/generated';
mkdirSync(`${OUT}/site`, { recursive: true });

const asOf = '2024-06-06';
const fx = (n: number) => `fx-pol-${String(n).padStart(2, '0')}`;

interface RowSpec {
  n: number; name: string; state: string; stateName: string; pc: string;
  partyId: string; party: string; partyShort: string;
  cases: number | null; serious?: boolean; conv?: number; pcAct?: boolean; framed?: boolean;
}
const specs: RowSpec[] = [
  { n: 1, name: 'Demo Netaji Extraordinarily-Long-Name Venkatasubramanian', state: 'KL', stateName: 'Kerala', pc: 'Demo South', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: 6, serious: true, conv: 1, pcAct: true, framed: true },
  { n: 2, name: 'अजय डेमो कुमार', state: 'UP', stateName: 'Uttar Pradesh', pc: 'Demo North', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: 2, serious: true },
  { n: 3, name: 'Demo Clean Record', state: 'UP', stateName: 'Uttar Pradesh', pc: 'Demo Central', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: 0 },
  { n: 4, name: 'Demo Missing Affidavit', state: 'MH', stateName: 'Maharashtra', pc: 'Demo East', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: null },
  { n: 5, name: 'Demo Member Five', state: 'MH', stateName: 'Maharashtra', pc: 'Demo West', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: 1 },
  { n: 6, name: 'Demo Member Six', state: 'KL', stateName: 'Kerala', pc: 'Demo Coast', partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', cases: 0 },
  { n: 7, name: 'Demo Small-Party One', state: 'GA', stateName: 'Goa', pc: 'Demo Hills', partyId: 'demo-b', party: 'Demo Party Beta', partyShort: 'DPB', cases: 1 },
  { n: 8, name: 'Demo Small-Party Two', state: 'GA', stateName: 'Goa', pc: 'Demo Valley', partyId: 'demo-b', party: 'Demo Party Beta', partyShort: 'DPB', cases: 0 },
];

const rows = specs.map((s) => ({
  id: fx(s.n),
  slug: `demo-${s.n}`,
  name: s.name,
  house: 'lok_sabha' as const,
  electionId: 'fx-ls-2024',
  state: s.state,
  stateName: s.stateName,
  constituency: s.pc,
  partyId: s.partyId,
  party: s.party,
  partyShort: s.partyShort,
  declaredCases: s.cases,
  hasSeriousDeclared: s.cases === null ? null : Boolean(s.serious),
  convictionsDeclared: s.cases === null ? null : (s.conv ?? 0),
  hasCaseRecords: (s.cases ?? 0) > 0,
  pcActCase: s.cases === null ? null : Boolean(s.pcAct),
  chargesFramedAny: s.cases === null ? null : Boolean(s.framed),
  affidavitStatus: s.cases === null ? ('missing' as const) : (s.cases > 0 ? ('case_rows_parsed' as const) : ('summary_only' as const)),
  reviewStatus: 'machine_checked' as const,
  membershipStatus: 'winner_at_election' as const,
  statusAsOf: '2024-06-04',
  fixture: true as const,
}));

const index = {
  cohortLabel: 'DEMO cohort — fixtures, not real records',
  electionIds: ['fx-ls-2024'],
  rows,
  actCategories: [
    { actId: 'in-act-ipc-1860', label: 'IPC', people: 4, cases: 8, mapped: true },
    { actId: 'in-act-pca-1988', label: 'PC Act 1988', people: 1, cases: 1, mapped: true },
    { actId: 'unmapped', label: 'Unmapped statutes (raw text preserved)', people: 1, cases: 1, mapped: false },
  ],
  generatedFrom: ['fx-source'],
  dataAsOf: asOf,
};

const covered = rows.filter((r) => r.declaredCases !== null);
const withCases = covered.filter((r) => (r.declaredCases ?? 0) > 0);
const kpis = {
  cohortLabel: index.cohortLabel,
  metrics: [
    { metricId: 'reps_covered', label: 'Representatives covered', value: covered.length, numerator: covered.length, denominator: rows.length, unit: 'people' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO: covered fixtures over total fixtures.' },
    { metricId: 'reps_with_declared_cases_pct', label: 'Declared ≥1 criminal case', value: (withCases.length / covered.length) * 100, numerator: withCases.length, denominator: covered.length, unit: 'percent' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO: fixtures with ≥1 case over covered fixtures.' },
    { metricId: 'reps_with_serious_cases_pct', label: 'Declared ≥1 serious case', value: (2 / covered.length) * 100, numerator: 2, denominator: covered.length, unit: 'percent' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO serious flag.' },
    { metricId: 'reps_with_convictions', label: 'Declared a conviction', value: 1, numerator: 1, denominator: covered.length, unit: 'people' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO convictions.' },
    { metricId: 'total_declared_cases', label: 'Total declared cases', value: 10, denominator: covered.length, unit: 'declaration-rows' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO rows.' },
    { metricId: 'affidavits_linked', label: 'Affidavit records linked', value: covered.length, numerator: covered.length, denominator: rows.length, unit: 'people' as const, asOf, sourceIds: ['fx-source'], definition: 'DEMO linked.' },
  ],
  dataAsOf: asOf,
};

const coverage = {
  rows: [
    {
      houseType: 'lok_sabha' as const, electionId: 'fx-ls-2024', bodyName: 'DEMO House', termLabel: 'DEMO',
      expectedSeats: 8, membersIdentified: 8, resultsSourced: 8, affidavitsLocated: 0, affidavitsParsed: 0,
      summaryRecords: 7, recordsHumanReviewed: 0, latestSourceDate: asOf,
      knownGaps: ['This is fixture data for UI testing.'], status: 'partial' as const,
    },
  ],
  lastPipelineRun: '2026-07-24T00:00:00Z',
  dataAsOf: asOf,
  activeFallbacks: [{ id: 'fx-demo', area: 'Everything', reason: 'DEMO fixtures loaded', effect: 'No real records are shown.' }],
};

const stats = {
  dataYear: 2023,
  publicationYear: 2026,
  publicationLabel: 'DEMO stats (fixtures)',
  agencyScope: 'DEMO agencies',
  statuteScope: 'DEMO statute',
  metricDefs: [
    { metricId: 'reg_total', label: 'Total (DEMO)', unit: 'cases' as const, definition: 'DEMO metric.' },
    { metricId: 'crt_conviction_rate', label: 'Conviction rate (DEMO)', unit: 'percent' as const, definition: 'DEMO rate.', derived: true },
  ],
  states: [
    { state: 'KL', stateName: 'Kerala', metrics: { reg_total: 12, crt_conviction_rate: 40 } },
    { state: 'UP', stateName: 'Uttar Pradesh', metrics: { reg_total: 30, crt_conviction_rate: null } },
    { state: 'MH', stateName: 'Maharashtra', metrics: { reg_total: 55, crt_conviction_rate: 61.5 } },
    { state: 'GA', stateName: 'Goa', metrics: { reg_total: 0, crt_conviction_rate: null } },
  ],
  allIndia: { reg_total: 97, crt_conviction_rate: 46.2 },
  sourceIds: ['fx-source'],
  dataAsOf: '2026-07-24',
  notes: ['DEMO DATA. States/UTs should not be compared on raw counts alone.'],
};

const disclosures = {
  cohortLabel: index.cohortLabel,
  electionIds: ['fx-ls-2024'],
  affidavitDateRange: {},
  minPartySample: 5,
  parties: [
    { partyId: 'demo-a', party: 'Demo Party Alpha', partyShort: 'DPA', covered: 5, withDeclared: 3, withSeriousDeclared: 2, withConvictions: 1, missingRecords: 1, pct: 60, suppressed: false },
    { partyId: 'demo-b', party: 'Demo Party Beta', partyShort: 'DPB', covered: 2, withDeclared: 1, withSeriousDeclared: 0, withConvictions: 0, missingRecords: 0, pct: 50, suppressed: true },
  ],
  qualifyingRulesVersion: '1.0.0',
  corruptionStatute: { covered: 7, withQualifyingCase: 1, note: 'DEMO note: fixtures only.' },
  sourceIds: ['fx-source'],
  dataAsOf: asOf,
  notes: ['DEMO'],
};

const sources = {
  note: 'DEMO source registry (fixtures).',
  sources: [
    { id: 'fx-source', publisher: 'DEMO', title: 'DEMO fixture source', url: 'https://example.com/demo', sourceType: 'official_dataset', notes: ['Fixture'], fixture: true, retrieval: null },
  ],
};

const buildInfo = {
  dataAsOf: asOf,
  builtAt: '2026-07-24T00:00:00Z',
  datasetVersion: 'DEMO-fixtures',
  dataMode: 'demo' as const,
  counts: { politicians: rows.length },
};

const mkCase = (i: number, pid: string, aid: string, type: 'pending' | 'conviction', pcAct = false) => ({
  id: `fx-case-${pid}-${type}-${i}`,
  affidavitId: aid,
  politicianId: pid,
  declarationType: type,
  actsSectionsRaw: pcAct
    ? 'IPC Sections - 420, Other Details - Section 13(2) PC Act, Case No. - DEMO/1, Court - DEMO Court, FIR No. - DEMO PS CC 1/2020, Charges Framed - Yes, Appeal Filed - No'
    : 'IPC Sections - 147, 341, Other Details - Some Unmapped State Act 5, Case No. - DEMO/2, Court - DEMO Court, FIR No. - DEMO PS CC 2/2021, Charges Framed - No, Appeal Filed - No',
  normalizedProvisions: pcAct
    ? [{ actId: 'in-act-ipc-1860', section: '420', mappingStatus: 'reviewed_alias' as const }, { actId: 'in-act-pca-1988', section: '13(2)', mappingStatus: 'reviewed_alias' as const }]
    : [{ actId: 'in-act-ipc-1860', section: '147', mappingStatus: 'reviewed_alias' as const }, { actId: 'unmapped', section: 'Some Unmapped State Act 5', mappingStatus: 'unmapped' as const }],
  caseNumberRaw: 'DEMO/1',
  courtNameRaw: 'DEMO Court',
  chargesFramed: pcAct,
  declaredStatus: type === 'conviction' ? 'Convicted (as declared)' : 'Pending (as declared)',
  statusAsOf: asOf,
  pageReference: 'DEMO p. 1',
  corruptionQualification: pcAct ? ('yes' as const) : ('needs_review' as const),
  qualificationRuleId: pcAct ? 'cq-pca-1988' : 'cq-default',
  reviewStatus: 'machine_checked' as const,
  sourceIds: ['fx-source'],
  fixture: true as const,
});

const full = {
  election: { id: 'fx-ls-2024', type: 'lok_sabha', bodyName: 'DEMO House', year: 2024, termLabel: 'DEMO', sourceIds: ['fx-source'] },
  cohortLabel: index.cohortLabel,
  dataAsOf: asOf,
  adrHistory: [
    { year: 2009, analyzed: 8, withCases: 2, withCasesPct: 25, withSerious: 1, withSeriousPct: 13 },
    { year: 2014, analyzed: 8, withCases: 3, withCasesPct: 38, withSerious: 1, withSeriousPct: 13 },
    { year: 2019, analyzed: 8, withCases: 3, withCasesPct: 38, withSerious: 2, withSeriousPct: 25 },
    { year: 2024, analyzed: 8, withCases: 4, withCasesPct: 50, withSerious: 2, withSeriousPct: 25 },
  ],
  profiles: rows.map((r) => {
    const aid = `fx-aff-${r.id}`;
    const cases =
      r.id === fx(1)
        ? [...Array.from({ length: 5 }, (_, i) => mkCase(i, r.id, aid, 'pending', i === 0)), mkCase(0, r.id, aid, 'conviction')]
        : (r.declaredCases ?? 0) > 0
          ? Array.from({ length: r.declaredCases! }, (_, i) => mkCase(i, r.id, aid, 'pending'))
          : [];
    return {
      ...r,
      politician: { id: r.id, slug: r.slug, displayName: r.name, normalizedName: r.name.toLowerCase(), aliases: [], identityReviewStatus: 'auto_matched', sourceIds: ['fx-source'], fixture: true },
      membership: { id: `fx-mem-${r.id}`, politicianId: r.id, electionId: 'fx-ls-2024', houseType: 'lok_sabha', constituencyName: r.constituency, stateCode: r.state, partyAtElectionId: r.partyId, status: 'winner_at_election', statusAsOf: '2024-06-04', sourceIds: ['fx-source'], fixture: true },
      affidavit: r.declaredCases === null
        ? { id: aid, politicianId: r.id, electionId: 'fx-ls-2024', sourceUrl: 'https://example.com/demo.pdf', languageCodes: ['en'], extractionMethod: 'manual', parserVersion: 'demo', reviewStatus: 'unreviewed', lastVerifiedAt: '2026-07-24T00:00:00Z', sourceIds: ['fx-source'], fixture: true }
        : {
            id: aid, politicianId: r.id, electionId: 'fx-ls-2024', sourceUrl: 'https://example.com/demo.pdf',
            languageCodes: ['en'], extractionMethod: cases.length ? 'pdf_text' : 'aggregate_report', parserVersion: 'demo',
            reviewStatus: 'machine_checked', lastVerifiedAt: '2026-07-24T00:00:00Z',
            declaredSummary: { pendingCases: cases.filter((c) => c.declarationType === 'pending').length, hasSeriousDeclared: r.hasSeriousDeclared, convictions: cases.filter((c) => c.declarationType === 'conviction').length, basis: cases.length ? 'parsed_cases' : 'published_report', sourceIds: ['fx-source'] },
            sourceIds: ['fx-source'], fixture: true,
          },
      cases,
      age: 52,
      adrPageRef: 1,
      officialResultName: null,
    };
  }),
};

// schema-validate everything before writing
politiciansIndexArtifactSchema.parse(index);
kpisArtifactSchema.parse(kpis);
coverageArtifactSchema.parse(coverage);
corruptionStatsArtifactSchema.parse(stats);
disclosuresArtifactSchema.parse(disclosures);
buildInfoSchema.parse(buildInfo);

writeJson(`${OUT}/site/politicians.index.json`, index);
writeJson(`${OUT}/site/kpis.json`, kpis);
writeJson(`${OUT}/site/coverage.json`, coverage);
writeJson(`${OUT}/site/corruption.stats.json`, stats);
writeJson(`${OUT}/site/corruption.disclosures.json`, disclosures);
writeJson(`${OUT}/site/sources.json`, sources);
writeJson(`${OUT}/politicians.full.json`, full);
writeJson(`${OUT}/build-info.json`, buildInfo);
writeJson(`${OUT}/data-quality-report.json`, { validation: { errors: [], warnings: [] }, counts: {}, unmappedActStrings: [], unmappedActStringsTotal: 1, activeFallbacks: coverage.activeFallbacks, reviewLadder: {}, fixture: true });
console.log('[fixtures] wrote DEMO dataset for', rows.length, 'fixture representatives');
