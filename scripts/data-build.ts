/**
 * data:build — compose validated working data into the site's generated
 * artifacts. Deterministic: stable ids, canonical JSON, arrays sorted; the only
 * wall-clock values live in build-info.json / manifest / pipeline-runs, which
 * are excluded from datasetVersion.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readJson, writeJson, canonicalJson, sha256, log, nowIso } from './lib/util';
import { affidavitId, constituencyId, criminalCaseId, membershipId, politicianId } from './lib/ids';
import { normalizeName, politicianSlug } from '../src/lib/slug';
import { normalizeActsSections, qualifyCorruption, type QualificationRules, type StatuteDictionary } from '../src/lib/statutes';
import {
  affidavitsLinked, coveragePct, partyBreakdown, repsCovered, repsWithConvictionsCount,
  repsWithDeclaredCasesPct, repsWithSeriousCasesPct, totalDeclaredCases,
} from '../src/lib/metrics';
import type { CriminalCase, NormalizedProvision } from '../src/lib/schemas/entities';
import type { PoliticianIndexRow } from '../src/lib/schemas/artifacts';
import { toCsv } from '../src/lib/csv';

const WORK = 'data/work';
const GEN = 'data/generated';
const PUB = 'data/generated/site';
const DL = 'public/downloads';

const ELECTION_ID = 'ls-2024';
const RESULT_DATE = '2024-06-04';
const ADR_DATE = '2024-06-06';
const VERIFIED_AT = '2026-07-24T00:00:00Z';
const COHORT_LABEL = '18th Lok Sabha — winners of the 2024 general election';
const ADR_PARSER = '1.1.0';

// ---------- inputs ----------
interface AdrWinner { sno: number; name: string; state: string; constituency: string; party: string; age: number | null; pageRef: number; stateCode: string; partyId: string | null; key: string }
interface CaseEntry { raw: string; ipcSectionsRaw: string | null; otherDetailsRaw: string | null; caseNoRaw: string | null; courtRaw: string | null; firRaw: string | null; chargesFramed: string | null; appealFiled: string | null; punishmentRaw?: string | null; convictionDateRaw?: string | null; appealDetailsRaw?: string | null }
interface CaseBlock { name: string; key: string | null; stateCode: string; totalCases: number | null; seriousIpc: number | null; otherIpc: number | null; pending: CaseEntry[]; convicted: CaseEntry[]; pageRef: number }

const adr = readJson<{ summary: Record<string, any>; winners: AdrWinner[]; caseBlocks: CaseBlock[] }>(join(WORK, 'adr.normalized.json'));
const ogd = readJson<Array<{ key: string; pcNo: number; pcName: string; winnerNameRaw: string; stateCode: string }>>(join(WORK, 'ogd-winners.normalized.json'));
const ncrb = readJson<Record<string, { columns: Array<{ id: string; label: string }>; states: Array<{ stateCode: string; stateRaw: string; values: Record<string, number | null> }>; totals: Record<string, Record<string, number | null>> }>>(join(WORK, 'ncrb.normalized.json'));
const validation = readJson<{ errors: string[]; warnings: string[]; stats: Record<string, unknown> }>(join(GEN, 'validation-report.json'));
const normProblems = readJson<string[]>(join(WORK, 'normalize-problems.json'));

const statesFile = readJson<{ states: Array<{ code: string; name: string; type: string }> }>('data/curated/states.json');
const stateName = new Map(statesFile.states.map((s) => [s.code, s.name]));
const partiesFile = readJson<{ parties: Array<{ partyId: string; name: string; shortName: string }> }>('data/curated/parties.json');
const partyById = new Map(partiesFile.parties.map((p) => [p.partyId, p]));
const dict = readJson<StatuteDictionary>('data/curated/statute-dictionary.json');
const rulesFile = readJson<any>('data/curated/corruption-qualification-rules.json');
const rules: QualificationRules = { version: rulesFile.version, qualifying: rulesFile.qualifying, explicitlyNotAuto: rulesFile.explicitlyNotAuto, defaultRuleId: rulesFile.defaultRuleId };
const expected = readJson<{ houses: any[]; assemblies: Array<{ stateCode: string; bodyName: string; expectedSeats: number }> }>('data/curated/expected-seats.json');
const sourcesRegistry = readJson<{ sources: any[] }>('data/curated/sources.json');
const manifest = readJson<Array<{ sourceId: string; file: string; sha256: string; retrievedAt: string; cached: boolean }>>('data/raw/manifest.json');

// ---------- provisions ----------
function provisionsFor(entry: CaseEntry): NormalizedProvision[] {
  const out: NormalizedProvision[] = [];
  if (entry.ipcSectionsRaw) {
    for (const tok of entry.ipcSectionsRaw.split(/[,;]/)) {
      const section = tok.trim().replace(/\.$/, '');
      if (/^\d+[A-Za-z]{0,2}(\(\d+\))?(\([a-z]{1,3}\))?$/.test(section)) {
        out.push({ actId: 'in-act-ipc-1860', section: section.toUpperCase(), mappingStatus: 'reviewed_alias' });
      } else if (section) {
        out.push({ actId: 'unmapped', section, mappingStatus: 'unmapped' });
      }
    }
  }
  if (entry.otherDetailsRaw && entry.otherDetailsRaw.trim()) {
    out.push(...normalizeActsSections(entry.otherDetailsRaw, dict));
  }
  return out;
}

function policeStationFrom(firRaw: string | null): string | undefined {
  if (!firRaw) return undefined;
  const m = /police\s+s[at]{1,2}tion[.:]?\s*[-]?\s*([A-Za-z0-9 .()/-]{2,50})/i.exec(firRaw);
  return m ? m[1].trim().replace(/\s*(CC|C\.C|Cr|FIR|No).*$/i, '').trim() || undefined : undefined;
}

// ---------- compose winners ----------
const ogdByKey = new Map(ogd.map((o) => [o.key, o]));
const blockByKey = new Map<string, CaseBlock>();
for (const b of adr.caseBlocks) if (b.key) blockByKey.set(b.key, b);

interface Profile {
  row: PoliticianIndexRow;
  politician: Record<string, unknown>;
  membership: Record<string, unknown>;
  affidavit: Record<string, unknown>;
  cases: CriminalCase[];
  age: number | null;
  adrPageRef: number;
  officialResultName: string | null;
}

const profiles: Profile[] = [];
const allCases: CriminalCase[] = [];
const unmappedActs = new Map<string, number>();

for (const rawWinner of adr.winners) {
  // ADR marks multi-seat winners with leading asterisks; keep the marker as an
  // alias, display the clean name. Unit note: one row per SEAT — a person who
  // won two seats appears twice (documented in the data-quality report).
  const w = { ...rawWinner, name: rawWinner.name.replace(/^\*+\s*/, '').trim() };
  const official = ogdByKey.get(w.key);
  const isSurat = !official;
  const pcOfficialName = official?.pcName ?? w.constituency.replace(/\((SC|ST)\)/gi, '').trim();
  const cid = constituencyId(w.stateCode, pcOfficialName);
  const pid = politicianId('lok_sabha', ELECTION_ID, w.key, w.name);
  const slugBase = politicianSlug(w.name, pcOfficialName);
  const party = w.partyId ? partyById.get(w.partyId) : undefined;
  if (!party) throw new Error(`unreachable: party unresolved for ${w.name} (validate should have failed)`);

  const block = blockByKey.get(w.key);
  const pendingCount = block ? block.pending.length : 0;
  const convictedCount = block ? block.convicted.length : 0;
  const declaredCases = block ? pendingCount + convictedCount : 0;
  const hasSerious = block ? (block.seriousIpc ?? 0) > 0 : false;

  const aid = affidavitId(pid, ELECTION_ID);
  const cases: CriminalCase[] = [];
  if (block) {
    const make = (entry: CaseEntry, declarationType: 'pending' | 'conviction', ordinal: number): CriminalCase => {
      const provisions = provisionsFor(entry);
      for (const p of provisions) if (p.mappingStatus === 'unmapped') unmappedActs.set(p.section, (unmappedActs.get(p.section) ?? 0) + 1);
      const q = qualifyCorruption(provisions, rules);
      return {
        id: criminalCaseId(aid, declarationType, ordinal),
        affidavitId: aid,
        politicianId: pid,
        declarationType,
        caseNumberRaw: entry.caseNoRaw || undefined,
        firNumberRaw: entry.firRaw || undefined,
        policeStationRaw: policeStationFrom(entry.firRaw),
        stateRaw: stateName.get(w.stateCode),
        courtNameRaw: entry.courtRaw || undefined,
        actsSectionsRaw: entry.raw,
        normalizedProvisions: provisions,
        descriptionRaw: undefined,
        chargesFramed: entry.chargesFramed ? /^y/i.test(entry.chargesFramed) : undefined,
        sentenceRaw: entry.punishmentRaw || undefined,
        appealStatusRaw: entry.appealDetailsRaw || (entry.appealFiled ? `Appeal filed: ${entry.appealFiled}` : undefined),
        declaredStatus:
          declarationType === 'conviction'
            ? `Convicted (as declared)${entry.convictionDateRaw ? `, order dated ${entry.convictionDateRaw}` : ''}`
            : entry.chargesFramed && /^y/i.test(entry.chargesFramed)
              ? 'Pending — charges framed (as declared)'
              : 'Pending (as declared)',
        statusAsOf: ADR_DATE,
        pageReference: `ADR report, p. ${block.pageRef} ff.`,
        corruptionQualification: q.qualification,
        qualificationRuleId: q.ruleId,
        reviewStatus: 'machine_checked',
        sourceIds: ['adr-ls2024-report'],
      };
    };
    block.pending.forEach((e, i) => cases.push(make(e, 'pending', i + 1)));
    block.convicted.forEach((e, i) => cases.push(make(e, 'conviction', i + 1)));
  }
  allCases.push(...cases);

  const row: PoliticianIndexRow = {
    id: pid,
    slug: slugBase,
    name: w.name,
    house: 'lok_sabha',
    electionId: ELECTION_ID,
    state: w.stateCode,
    stateName: stateName.get(w.stateCode) ?? w.stateCode,
    constituency: pcOfficialName,
    partyId: party.partyId,
    party: party.name,
    partyShort: party.shortName,
    declaredCases,
    hasSeriousDeclared: hasSerious,
    convictionsDeclared: convictedCount,
    hasCaseRecords: Boolean(block),
    pcActCase: block ? cases.some((c) => c.corruptionQualification === 'yes') : false,
    chargesFramedAny: block ? cases.some((c) => c.chargesFramed === true) : false,
    affidavitStatus: block ? 'case_rows_parsed' : 'summary_only',
    reviewStatus: 'machine_checked',
    membershipStatus: 'winner_at_election',
    statusAsOf: RESULT_DATE,
  };

  profiles.push({
    row,
    politician: {
      id: pid,
      slug: slugBase,
      displayName: w.name,
      normalizedName: normalizeName(w.name),
      aliases: [
        ...(official && normalizeName(official.winnerNameRaw) !== normalizeName(w.name) ? [official.winnerNameRaw] : []),
        ...(rawWinner.name !== w.name ? [rawWinner.name] : []),
      ],
      identityReviewStatus: 'auto_matched',
      sourceIds: isSurat ? ['adr-ls2024-report'] : ['ogd-ls2024-results', 'adr-ls2024-report'],
    },
    membership: {
      id: membershipId(pid, ELECTION_ID),
      politicianId: pid,
      electionId: ELECTION_ID,
      houseType: 'lok_sabha',
      constituencyId: cid,
      constituencyName: pcOfficialName,
      stateCode: w.stateCode,
      partyAtElectionId: party.partyId,
      termStart: RESULT_DATE,
      status: 'winner_at_election',
      statusAsOf: RESULT_DATE,
      sourceIds: isSurat ? ['adr-ls2024-report'] : ['ogd-ls2024-results', 'adr-ls2024-report'],
    },
    affidavit: {
      id: aid,
      politicianId: pid,
      electionId: ELECTION_ID,
      sourceUrl:
        'https://adrindia.org/sites/default/files/Lok_Sabha_Elections_2024_Criminal_and_Financial_background_details_of_Winning_Candidates_Finalver_English%20%281%29.pdf',
      languageCodes: ['en'],
      extractionMethod: block ? 'pdf_text' : 'aggregate_report',
      parserVersion: ADR_PARSER,
      reviewStatus: 'machine_checked',
      lastVerifiedAt: VERIFIED_AT,
      declaredSummary: {
        pendingCases: pendingCount,
        hasSeriousDeclared: hasSerious,
        convictions: convictedCount,
        basis: block ? 'parsed_cases' : 'published_report',
        sourceIds: ['adr-ls2024-report'],
      },
      sourceIds: ['adr-ls2024-report', 'eci-affidavit-portal'],
    },
    cases,
    age: w.age,
    adrPageRef: w.pageRef,
    officialResultName: official?.winnerNameRaw ?? null,
  });
}

// slug uniqueness (same name + same constituency spelling would collide)
const bySlug = new Map<string, Profile[]>();
for (const p of profiles) {
  const list = bySlug.get(p.row.slug) ?? [];
  list.push(p);
  bySlug.set(p.row.slug, list);
}
for (const [slug, list] of bySlug) {
  if (list.length > 1) {
    for (const p of list) {
      const suffix = p.row.id.slice(4, 8);
      p.row.slug = `${slug}-${suffix}`;
      (p.politician as any).slug = p.row.slug;
    }
  }
}
profiles.sort((a, b) => (a.row.slug < b.row.slug ? -1 : 1));

// ---------- sanity ----------
if (profiles.length !== 543) throw new Error(`profiles=${profiles.length}, expected 543`);
const withCases = profiles.filter((p) => (p.row.declaredCases ?? 0) > 0).length;
if (withCases !== adr.summary.withCases) throw new Error(`withCases=${withCases} != printed ${adr.summary.withCases}`);
const withConv = profiles.filter((p) => (p.row.convictionsDeclared ?? 0) > 0).length;
const seriousCount = profiles.filter((p) => p.row.hasSeriousDeclared === true).length;
if (seriousCount !== adr.summary.withSerious) throw new Error(`serious=${seriousCount} != printed ${adr.summary.withSerious}`);

// ---------- artifacts ----------
mkdirSync(PUB, { recursive: true });
mkdirSync(GEN, { recursive: true });
mkdirSync(DL, { recursive: true });

const rows = profiles.map((p) => p.row);
const ctx = { asOf: ADR_DATE, sourceIds: ['adr-ls2024-report', 'ogd-ls2024-results'] };

// transparent statute-category rollup (people = distinct representatives)
const actLabel = new Map(dict.acts.map((a) => [a.actId, a.shortName ?? a.name]));
const actPeople = new Map<string, Set<string>>();
const actCases = new Map<string, Set<string>>();
for (const c of allCases) {
  const actIds = new Set(c.normalizedProvisions.map((p) => (p.mappingStatus === 'unmapped' ? 'unmapped' : p.actId)));
  for (const a of actIds) {
    (actPeople.get(a) ?? actPeople.set(a, new Set()).get(a)!).add(c.politicianId);
    (actCases.get(a) ?? actCases.set(a, new Set()).get(a)!).add(c.id);
  }
}
const actCategories = [...actPeople.entries()]
  .map(([actId, people]) => ({
    actId,
    label: actId === 'unmapped' ? 'Unmapped statutes (raw text preserved)' : (actLabel.get(actId) ?? actId),
    people: people.size,
    cases: actCases.get(actId)?.size ?? 0,
    mapped: actId !== 'unmapped',
  }))
  .sort((a, b) => b.people - a.people || a.actId.localeCompare(b.actId));

const indexArtifact = {
  cohortLabel: COHORT_LABEL,
  electionIds: [ELECTION_ID],
  rows,
  actCategories,
  generatedFrom: ['ogd-ls2024-results', 'adr-ls2024-report'],
  dataAsOf: ADR_DATE,
};
writeJson(join(PUB, 'politicians.index.json'), indexArtifact);

const kpis = {
  cohortLabel: COHORT_LABEL,
  metrics: [
    repsCovered(rows, 543, ctx),
    repsWithDeclaredCasesPct(rows, ctx),
    repsWithSeriousCasesPct(rows, ctx),
    repsWithConvictionsCount(rows, ctx),
    totalDeclaredCases(rows, ctx),
    affidavitsLinked(rows, ctx),
    coveragePct(rows.filter((r) => r.declaredCases !== null).length, 543, ctx),
  ],
  dataAsOf: ADR_DATE,
};
writeJson(join(PUB, 'kpis.json'), kpis);

// election + full profiles for static generation
const election = {
  id: ELECTION_ID, type: 'lok_sabha', bodyName: 'Lok Sabha', year: 2024,
  termLabel: '18th Lok Sabha (2024–)', resultDate: RESULT_DATE,
  sourceIds: ['ogd-ls2024-results', 'eci-statistical-reports'],
};
writeJson(join(GEN, 'politicians.full.json'), {
  election,
  cohortLabel: COHORT_LABEL,
  dataAsOf: ADR_DATE,
  adrHistory: adr.summary.history ?? [],
  profiles: profiles.map((p) => ({
    ...p.row,
    politician: p.politician,
    membership: p.membership,
    affidavit: p.affidavit,
    cases: p.cases,
    age: p.age,
    adrPageRef: p.adrPageRef,
    officialResultName: p.officialResultName,
  })),
});

// disclosures artifact (party comparison + corruption-statute layer)
const parties = partyBreakdown(rows, 5);
const qualifyingPeople = new Set(allCases.filter((c) => c.corruptionQualification === 'yes').map((c) => c.politicianId));
const needsReviewPeople = new Set(allCases.filter((c) => c.corruptionQualification === 'needs_review').map((c) => c.politicianId));
const disclosures = {
  cohortLabel: COHORT_LABEL,
  electionIds: [ELECTION_ID],
  affidavitDateRange: {},
  minPartySample: 5,
  parties,
  qualifyingRulesVersion: rules.version,
  corruptionStatute: {
    covered: rows.filter((r) => r.declaredCases !== null).length,
    withQualifyingCase: qualifyingPeople.size,
    note: `Counts people with ≥1 declared case mapped to the Prevention of Corruption Act (rules v${rules.version}). ${needsReviewPeople.size} further people have ≥1 declared case that needs manual review before classification (PMLA, cheating, breach of trust and unmapped statutes are never auto-classified).`,
  },
  sourceIds: ['adr-ls2024-report'],
  dataAsOf: ADR_DATE,
  notes: [
    'party_at_election as recorded in the winning candidate analysis; later defections/mergers are not reflected.',
    'Parties with fewer than 5 covered representatives are shown but never ranked.',
  ],
};
writeJson(join(PUB, 'corruption.disclosures.json'), disclosures);

// NCRB enforcement artifact
const tablePrefix: Record<string, string> = { registered: 'reg', policeDisposal: 'pol', courtDisposal: 'crt' };
const tableSource: Record<string, string> = {
  registered: 'ogd-ncrb-pca-registered-2023',
  policeDisposal: 'ogd-ncrb-police-disposal-2023',
  courtDisposal: 'ogd-ncrb-court-disposal-2023',
};
const tableTitle: Record<string, string> = {
  registered: 'NCRB Crime in India 2023, Table 8C.2 (cases registered by type)',
  policeDisposal: 'NCRB Crime in India 2023, Table 8C.3 (police disposal)',
  courtDisposal: 'NCRB Crime in India 2023, Table 8C.4 (court disposal)',
};
const metricDefs: any[] = [];
const stateMetrics = new Map<string, Record<string, number | null>>();
const allIndia: Record<string, number | null> = {};
for (const [key, t] of Object.entries(ncrb)) {
  const prefix = tablePrefix[key];
  for (const col of t.columns) {
    const metricId = `${prefix}_${col.id}`;
    const derived = /rate|percentage/.test(col.id);
    metricDefs.push({
      metricId,
      label: col.label.replace(/ \( Col\. \d+ \)/, '').trim(),
      unit: derived ? 'percent' : 'cases',
      definition: `${col.label.replace(/ \( Col\. \d+ \)/, '').trim()} — as published in ${tableTitle[key]}. ${derived ? "NCRB's own formula, shown in the column heading; 'NA' where the denominator is zero." : 'Reported enforcement activity under the Prevention of Corruption Act; not a measure of underlying corruption.'}`,
      ...(derived ? { derived: true } : {}),
    });
  }
  for (const st of t.states) {
    const m = stateMetrics.get(st.stateCode) ?? {};
    for (const col of t.columns) m[`${prefix}_${col.id}`] = st.values[col.id] ?? null;
    stateMetrics.set(st.stateCode, m);
  }
  const ai = t.totals['total_all_india'] ?? {};
  for (const col of t.columns) allIndia[`${prefix}_${col.id}`] = ai[col.id] ?? null;
}
const statsArtifact = {
  dataYear: 2023,
  publicationYear: 2026,
  publicationLabel: 'Crime in India 2023 (NCRB; tables published on data.gov.in, retrieved 2026)',
  agencyScope: 'Anti-Corruption Bureaus, Vigilance bodies and Lokayuktas',
  statuteScope: 'Prevention of Corruption Act, 1988 and related sections',
  metricDefs,
  states: [...stateMetrics.entries()]
    .map(([code, metrics]) => ({ state: code, stateName: stateName.get(code) ?? code, metrics }))
    .sort((a, b) => (a.state < b.state ? -1 : 1)),
  allIndia,
  sourceIds: Object.values(tableSource),
  dataAsOf: '2026-07-24',
  notes: [
    'More registered cases can reflect more underlying corruption, more reporting, stronger enforcement, or all three. States/UTs should not be compared on raw counts alone.',
    'Data year 2023; the NCRB publication was released later — both are shown.',
    'Only NCRB-published values and NCRB-published derived rates are shown; this site adds no denominators of its own.',
  ],
};
writeJson(join(PUB, 'corruption.stats.json'), statsArtifact);

// coverage artifact
const coverageRows = [
  {
    houseType: 'lok_sabha', electionId: ELECTION_ID, bodyName: 'Lok Sabha', termLabel: '18th Lok Sabha (2024–)',
    expectedSeats: 543, membersIdentified: 543, resultsSourced: 542, affidavitsLocated: 0, affidavitsParsed: 0,
    summaryRecords: 543, recordsHumanReviewed: 0, latestSourceDate: ADR_DATE,
    knownGaps: [
      'Surat (uncontested) is absent from the official OGD results file; its winner is recorded from the ADR analysis and marked accordingly.',
      'Primary affidavit PDFs are not yet linked: affidavit.eci.gov.in returned HTTP 403 to automated access on 2026-07-24.',
      'Case-level records derive from the ADR published digest of affidavits; machine-checked, not yet human-verified.',
      'Membership changes after 2024-06-04 (deaths, resignations, by-elections, party changes) are not yet imported — status shown is winner-at-election.',
    ],
    nextPlannedUpdate: 'Link primary ECI affidavit PDFs and record post-election membership changes.',
    status: 'partial',
  },
  {
    houseType: 'rajya_sabha', bodyName: 'Rajya Sabha', termLabel: 'Current (elected seats)',
    expectedSeats: 233, membersIdentified: 0, resultsSourced: 0, affidavitsLocated: 0, affidavitsParsed: 0,
    summaryRecords: 0, recordsHumanReviewed: 0,
    knownGaps: ['Planned after the Lok Sabha import is complete and reviewed.'], status: 'planned',
  },
  ...expected.assemblies.map((a) => ({
    houseType: 'assembly', bodyName: a.bodyName, stateCode: a.stateCode,
    expectedSeats: a.expectedSeats, membersIdentified: 0, resultsSourced: 0, affidavitsLocated: 0,
    affidavitsParsed: 0, summaryRecords: 0, recordsHumanReviewed: 0,
    knownGaps: ['Not yet imported.'], nextPlannedUpdate: 'State-by-state import as clean structured sources are verified.',
    status: 'not_imported',
  })),
];
const activeFallbacks = [
  { id: 'eci-affidavit-403', area: 'Politician Cases', reason: 'affidavit.eci.gov.in returns HTTP 403 to automated access (no bypass attempted)', effect: 'Case records come from the ADR published digest; profiles cite the digest, not the primary PDF.' },
  { id: 'ogd-winner-party-corrupt', area: 'Politician Cases', reason: 'The OGD datastore copy of the winners list collapsed duplicate winner/runner-up columns at ingestion, corrupting winner party fields', effect: 'Winner party attribution comes from the ADR analysis and is reconciled against its printed party-wise seat table.' },
  { id: 'cag-pipeline-review', area: 'Corruption — audit findings', reason: 'CAG report finding extraction is not yet reviewed', effect: 'The audit-findings lens lists real report metadata only; zero findings are shown.' },
  { id: 'boundaries-pending', area: 'Maps', reason: 'No Survey of India-published boundary file could be verified this release (SoI portal products and government map services were unreachable or unverifiable from the build environment)', effect: 'Geographic views use an accessible state-tile grid instead of a choropleth; no political boundary is depicted.' },
];
const coverage = {
  rows: coverageRows,
  lastPipelineRun: VERIFIED_AT,
  dataAsOf: ADR_DATE,
  activeFallbacks,
};
writeJson(join(PUB, 'coverage.json'), coverage);

// public sources registry (+ retrieval facts from manifest)
const retrievalBySource = new Map<string, { files: number; retrievedAt: string }>();
for (const m of manifest) {
  const cur = retrievalBySource.get(m.sourceId);
  retrievalBySource.set(m.sourceId, {
    files: (cur?.files ?? 0) + 1,
    retrievedAt: cur && cur.retrievedAt > m.retrievedAt ? cur.retrievedAt : m.retrievedAt,
  });
}
writeJson(join(PUB, 'sources.json'), {
  note: 'Machine-readable source registry for www.indiatechcollective.org accountability dashboards.',
  sources: sourcesRegistry.sources.map((s) => ({
    ...s,
    retrieval: retrievalBySource.get(s.id) ?? null,
  })),
});

// downloads
const dlRows = rows.map((r) => ({
  name: r.name, state: r.stateName, constituency: r.constituency, house: 'Lok Sabha', election: '2024 general election',
  party: r.party, party_short: r.partyShort, declared_criminal_cases: r.declaredCases,
  has_serious_declared: r.hasSeriousDeclared === null ? '' : r.hasSeriousDeclared ? 'yes' : 'no',
  convictions_declared: r.convictionsDeclared, review_status: r.reviewStatus,
  membership_status: r.membershipStatus, status_as_of: r.statusAsOf,
  profile: `https://www.indiatechcollective.org/politicians/${r.slug}/`,
  sources: 'ogd-ls2024-results; adr-ls2024-report',
}));
writeFileSync(join(DL, 'representatives-ls2024.csv'), toCsv(dlRows, Object.keys(dlRows[0])));
writeJson(join(DL, 'representatives-ls2024.json'), { licenceNote: 'Underlying data: GODL (OGD results) and ADR published report (non-commercial, cite ADR/NEW). See /sources.', dataAsOf: ADR_DATE, rows: dlRows });
const enfRows = statsArtifact.states.map((s) => ({ state: s.stateName, code: s.state, ...s.metrics }));
writeFileSync(join(DL, 'state-enforcement-2023.csv'), toCsv(enfRows, Object.keys(enfRows[0])));
writeJson(join(DL, 'state-enforcement-2023.json'), { licenceNote: 'Government Open Data License – India (GODL). Source: NCRB Crime in India 2023 via data.gov.in. Reported enforcement activity, not corruption level.', dataYear: 2023, rows: enfRows });
writeFileSync(
  join(DL, 'README.txt'),
  `India Tech Collective — accountability dashboards: data downloads
====================================================================
representatives-ls2024.csv/json
  One row per winner of the 2024 Lok Sabha general election (543).
  declared_criminal_cases counts self-declared cases in the candidate's
  election affidavit as analysed by ADR/National Election Watch from the
  ECI affidavit portal. A declared case is an accusation, not a conviction.
  Sources: data.gov.in "List of Successful Candidate 2024" (GODL);
  ADR "Lok Sabha Elections 2024" winners report (cite ADR/NEW; non-commercial).

state-enforcement-2023.csv/json
  NCRB Crime in India 2023 tables 8C.2-8C.4 (Prevention of Corruption Act
  cases handled by ACBs/Vigilance/Lokayuktas), via data.gov.in (GODL).
  Reported enforcement activity — NOT a corruption ranking.

Metric definitions, methodology, caveats: https://www.indiatechcollective.org/methodology/
Full source registry: https://www.indiatechcollective.org/sources/
`
);

// data-quality report
writeJson(join(GEN, 'data-quality-report.json'), {
  validation,
  normalizeNotes: normProblems,
  joinStats: validation.stats,
  counts: {
    profiles: profiles.length,
    withDeclaredCases: withCases,
    withSeriousDeclared: seriousCount,
    withDeclaredConvictions: withConv,
    caseRecords: allCases.length,
    pendingCaseRecords: allCases.filter((c) => c.declarationType === 'pending').length,
    convictionCaseRecords: allCases.filter((c) => c.declarationType === 'conviction').length,
    corruptionQualifying: qualifyingPeople.size,
    corruptionNeedsReview: needsReviewPeople.size,
  },
  unmappedActStringsTotal: unmappedActs.size,
  unmappedActStrings: [...unmappedActs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([s, n]) => ({ raw: s, count: n })),
  activeFallbacks,
  reviewLadder: { human_verified: 0, machine_checked: profiles.length, note: 'No record is human-verified yet; adverse records are displayed only with machine_checked review state and per-record source citations.' },
  unitNotes: [
    'Rows are seat-winners: a person who won two seats in the same election appears once per seat (matching the source report’s own unit). Cross-seat person deduplication has not been human-reviewed.',
  ],
});

// build info + dataset version
const artifactFiles = [
  join(PUB, 'politicians.index.json'), join(PUB, 'kpis.json'), join(PUB, 'coverage.json'),
  join(PUB, 'corruption.stats.json'), join(PUB, 'corruption.disclosures.json'), join(PUB, 'sources.json'),
  join(GEN, 'politicians.full.json'),
];
const datasetVersion = sha256(artifactFiles.map((f) => readFileSync(f, 'utf8')).join('\n')).slice(0, 16);
let gitCommit: string | undefined;
try { gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { /* not a repo */ }
writeJson(join(GEN, 'build-info.json'), {
  dataAsOf: '2026-07-24',
  builtAt: nowIso(),
  gitCommit,
  datasetVersion,
  dataMode: 'production',
  counts: {
    politicians: profiles.length,
    memberships: profiles.length,
    affidavits: profiles.length,
    criminalCases: allCases.length,
    enforcementStates: statsArtifact.states.length,
    sources: sourcesRegistry.sources.length,
  },
});

appendFileSync(
  'data/pipeline-runs.jsonl',
  JSON.stringify({
    runId: `run-${datasetVersion}`,
    startedAt: nowIso(),
    gitCommit,
    node: process.version,
    steps: [
      { name: 'fetch', ok: true, records: manifest.length },
      { name: 'normalize', ok: true, records: adr.winners.length + ogd.length },
      { name: 'validate', ok: validation.errors.length === 0 },
      { name: 'build', ok: true, records: profiles.length + allCases.length },
    ],
    outputDatasetVersion: datasetVersion,
  }) + '\n'
);

log('build', `profiles=${profiles.length} cases=${allCases.length} (pending=${allCases.filter((c) => c.declarationType === 'pending').length}, conviction=${allCases.filter((c) => c.declarationType === 'conviction').length})`);
log('build', `withCases=${withCases} serious=${seriousCount} convictions=${withConv} pcQualifying=${qualifyingPeople.size} needsReview=${needsReviewPeople.size}`);
log('build', `datasetVersion=${datasetVersion}`);
