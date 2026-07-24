/**
 * data:check — the honesty gate. First step of `npm run build`; a failure here
 * fails the deploy. Verifies that every displayed artifact is schema-valid,
 * fixture-free, internally consistent, and that every adverse claim carries
 * source + status date + displayable review state.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  politiciansIndexArtifactSchema, kpisArtifactSchema, coverageArtifactSchema,
  corruptionStatsArtifactSchema, disclosuresArtifactSchema, buildInfoSchema,
  criminalCaseSchema, affidavitSchema, membershipSchema, politicianSchema,
} from '../src/lib/schemas';
import {
  checkAdverseClaims, checkAuditFindings, checkIndexRowConsistency,
  checkMetricSanity, checkNoFixtureMarkers, checkPartySuppression,
} from '../src/lib/gates';
import { readJson, sha256, fail, log } from './lib/util';

const PUB = 'data/generated/site';
const GEN = 'data/generated';
const errors: string[] = [];
const isDemo = process.env.DATA_MODE === 'demo';

function parseArtifact<T>(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown; data?: T } }, path: string): T | null {
  const raw = readJson(path);
  const res = schema.safeParse(raw);
  if (!res.success) {
    errors.push(`${path}: schema violation — ${String(res.error).split('\n').slice(0, 6).join(' | ').slice(0, 500)}`);
    return null;
  }
  return res.data as T;
}

// 1. Schema-parse every artifact
const index = parseArtifact<any>(politiciansIndexArtifactSchema, join(PUB, 'politicians.index.json'));
const kpis = parseArtifact<any>(kpisArtifactSchema, join(PUB, 'kpis.json'));
const coverage = parseArtifact<any>(coverageArtifactSchema, join(PUB, 'coverage.json'));
const stats = parseArtifact<any>(corruptionStatsArtifactSchema, join(PUB, 'corruption.stats.json'));
const disclosures = parseArtifact<any>(disclosuresArtifactSchema, join(PUB, 'corruption.disclosures.json'));
const buildInfo = parseArtifact<any>(buildInfoSchema, join(GEN, 'build-info.json'));
const full = readJson<{ profiles: any[] }>(join(GEN, 'politicians.full.json'));

// 2. Fixture isolation (production only)
if (!isDemo) {
  for (const f of ['politicians.index.json', 'kpis.json', 'coverage.json', 'corruption.stats.json', 'corruption.disclosures.json', 'sources.json']) {
    errors.push(...checkNoFixtureMarkers(readFileSync(join(PUB, f), 'utf8'), f));
  }
  errors.push(...checkNoFixtureMarkers(readFileSync(join(GEN, 'politicians.full.json'), 'utf8'), 'politicians.full.json'));
}

// 3. Entity-level schema + adverse-claim gates over full profiles
if (full) {
  const cases: any[] = [];
  const affidavits: any[] = [];
  for (const p of full.profiles) {
    const pol = politicianSchema.safeParse(p.politician);
    if (!pol.success) errors.push(`profile ${p.slug}: politician schema violation`);
    const mem = membershipSchema.safeParse(p.membership);
    if (!mem.success) errors.push(`profile ${p.slug}: membership schema violation`);
    const aff = affidavitSchema.safeParse(p.affidavit);
    if (!aff.success) errors.push(`profile ${p.slug}: affidavit schema violation`);
    else affidavits.push(aff.data);
    for (const c of p.cases) {
      const parsed = criminalCaseSchema.safeParse(c);
      if (!parsed.success) errors.push(`profile ${p.slug}: case ${c.id} schema violation`);
      else cases.push(parsed.data);
    }
  }
  errors.push(...checkAdverseClaims(cases, affidavits));

  // unmapped provisions must not be counted in category aggregates — assert
  // qualification never says "yes" off an unmapped-only provision list
  for (const c of cases) {
    if (c.corruptionQualification === 'yes' && !c.normalizedProvisions.some((p: any) => p.mappingStatus !== 'unmapped')) {
      errors.push(`case ${c.id}: qualification=yes with only unmapped provisions`);
    }
  }
}

// 4. Metric sanity + party suppression + row consistency
if (kpis) errors.push(...checkMetricSanity(kpis.metrics));
if (disclosures) errors.push(...checkPartySuppression(disclosures.parties, disclosures.minPartySample));
if (index) errors.push(...checkIndexRowConsistency(index.rows));

// 5. Dashboard totals must match profile records
if (index && full) {
  const idxIds = new Set(index.rows.map((r: any) => r.id));
  const fullIds = new Set(full.profiles.map((p: any) => p.id));
  if (idxIds.size !== fullIds.size || [...idxIds].some((id) => !fullIds.has(id))) {
    errors.push(`index rows (${idxIds.size}) and full profiles (${fullIds.size}) are not the same set`);
  }
  for (const p of full.profiles) {
    const parsedCount = p.cases.length;
    if (p.hasCaseRecords && parsedCount !== p.declaredCases) {
      errors.push(`profile ${p.slug}: declaredCases=${p.declaredCases} != case records ${parsedCount}`);
    }
  }
}
if (index && kpis) {
  const rows = index.rows;
  const withCases = rows.filter((r: any) => (r.declaredCases ?? 0) > 0).length;
  const kpi = kpis.metrics.find((m: any) => m.metricId === 'reps_with_declared_cases_pct');
  if (kpi && kpi.numerator !== withCases) {
    errors.push(`KPI numerator ${kpi.numerator} != index rows with declared cases ${withCases}`);
  }
}

// 6. Enforcement artifact: every displayed metric needs a definition; no self-invented rates
if (stats) {
  const defined = new Set(stats.metricDefs.map((d: any) => d.metricId));
  for (const st of stats.states) {
    for (const id of Object.keys(st.metrics)) {
      if (!defined.has(id)) errors.push(`corruption.stats: state ${st.state} metric ${id} lacks a definition`);
    }
  }
  if (!stats.notes.some((n: string) => n.includes('should not be compared on raw counts alone'))) {
    errors.push('corruption.stats: mandatory comparison caveat missing from notes');
  }
}

// 7. Audit findings: must be empty (pipeline in review) and any present record labelled
const cag = readJson<{ reports: any[] }>('data/curated/cag-reports.json');
const auditFindings: any[] = []; // none may exist this release
errors.push(...checkAuditFindings(auditFindings));
if ((cag as any).findings?.length) errors.push('cag-reports.json: findings present but the audit lens is pipeline-in-review');

// 8. Dataset version freshness (artifacts regenerated together)
if (buildInfo) {
  const artifactFiles = [
    join(PUB, 'politicians.index.json'), join(PUB, 'kpis.json'), join(PUB, 'coverage.json'),
    join(PUB, 'corruption.stats.json'), join(PUB, 'corruption.disclosures.json'), join(PUB, 'sources.json'),
    join(GEN, 'politicians.full.json'),
  ];
  const recomputed = sha256(artifactFiles.map((f) => readFileSync(f, 'utf8')).join('\n')).slice(0, 16);
  if (recomputed !== buildInfo.datasetVersion) {
    errors.push(`datasetVersion mismatch: build-info=${buildInfo.datasetVersion} recomputed=${recomputed} — rerun data:build`);
  }
  if (!isDemo && buildInfo.dataMode !== 'production') errors.push(`build-info dataMode=${buildInfo.dataMode} in a production check`);
}

if (errors.length > 0) fail('check', errors);
log('check', `OK — ${index?.rows.length ?? 0} representatives, ${full?.profiles.reduce((a, p) => a + p.cases.length, 0) ?? 0} case records, dataset ${buildInfo?.datasetVersion}`);
