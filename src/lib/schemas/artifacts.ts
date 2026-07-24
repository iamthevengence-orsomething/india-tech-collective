import { z } from 'zod';
import { isoDate, nonEmpty, sourceIdList, reviewStatus, stateCode, houseType } from './core';
import { membershipStatus } from './entities';

/**
 * Site-facing generated artifacts (public/data/*.json).
 * These are the ONLY shapes the UI reads; the pipeline is the only writer.
 */

export const metricResultSchema = z.strictObject({
  metricId: nonEmpty,
  label: nonEmpty,
  value: z.number().nullable(),
  numerator: z.number().min(0).optional(),
  denominator: z.number().min(0).optional(),
  unit: z.enum(['people', 'declaration-rows', 'cases-as-reported', 'percent', 'seats']),
  asOf: isoDate,
  sourceIds: sourceIdList,
  definition: nonEmpty,
  suppressed: z.boolean().optional(),
  suppressedReason: z.string().optional(),
});
export type MetricResult = z.infer<typeof metricResultSchema>;

export const politicianIndexRowSchema = z.strictObject({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  house: houseType,
  electionId: nonEmpty,
  state: stateCode,
  stateName: nonEmpty,
  constituency: nonEmpty,
  partyId: nonEmpty,
  party: nonEmpty,
  partyShort: nonEmpty,
  /** null = unknown (no affidavit-derived data), never silently 0 */
  declaredCases: z.number().int().min(0).nullable(),
  /** true when the source flags ≥1 declared case meeting its published "serious" criteria (charge-level, not a case count) */
  hasSeriousDeclared: z.boolean().nullable(),
  convictionsDeclared: z.number().int().min(0).nullable(),
  /** true when parsed case-level rows exist (case cards on profile) */
  hasCaseRecords: z.boolean(),
  /** ≥1 declared case qualifying under the reviewed corruption-statute rules; null when no case-level data */
  pcActCase: z.boolean().nullable(),
  /** ≥1 declared case where the affidavit digest records charges framed; null when no case-level data */
  chargesFramedAny: z.boolean().nullable(),
  affidavitStatus: z.enum(['case_rows_parsed', 'summary_only', 'missing']),
  reviewStatus,
  membershipStatus,
  statusAsOf: isoDate,
  fixture: z.literal(true).optional(),
});
export type PoliticianIndexRow = z.infer<typeof politicianIndexRowSchema>;

export const politiciansIndexArtifactSchema = z.strictObject({
  cohortLabel: nonEmpty,
  electionIds: z.array(nonEmpty).min(1),
  rows: z.array(politicianIndexRowSchema),
  /** transparent statute-category rollup (people = distinct representatives) */
  actCategories: z.array(
    z.strictObject({
      actId: nonEmpty,
      label: nonEmpty,
      people: z.number().int().min(0),
      cases: z.number().int().min(0),
      mapped: z.boolean(),
    })
  ),
  generatedFrom: sourceIdList,
  dataAsOf: isoDate,
});
export type PoliticiansIndexArtifact = z.infer<typeof politiciansIndexArtifactSchema>;

export const coverageRowSchema = z.strictObject({
  houseType,
  electionId: nonEmpty.optional(),
  bodyName: nonEmpty,
  stateCode: stateCode.optional(),
  termLabel: nonEmpty.optional(),
  expectedSeats: z.number().int().min(0),
  membersIdentified: z.number().int().min(0),
  resultsSourced: z.number().int().min(0),
  affidavitsLocated: z.number().int().min(0),
  affidavitsParsed: z.number().int().min(0),
  summaryRecords: z.number().int().min(0),
  recordsHumanReviewed: z.number().int().min(0),
  latestSourceDate: isoDate.optional(),
  knownGaps: z.array(z.string()),
  nextPlannedUpdate: z.string().optional(),
  status: z.enum(['imported', 'partial', 'not_imported', 'planned']),
});
export type CoverageRow = z.infer<typeof coverageRowSchema>;

export const coverageArtifactSchema = z.strictObject({
  rows: z.array(coverageRowSchema).min(1),
  lastPipelineRun: nonEmpty,
  dataAsOf: isoDate,
  activeFallbacks: z.array(
    z.strictObject({ id: nonEmpty, area: nonEmpty, reason: nonEmpty, effect: nonEmpty })
  ),
});
export type CoverageArtifact = z.infer<typeof coverageArtifactSchema>;

export const enforcementStateRowSchema = z.strictObject({
  state: stateCode,
  stateName: nonEmpty,
  /** metricId -> value (null = not published for that state/year) */
  metrics: z.record(z.string(), z.number().nullable()),
});

export const corruptionStatsArtifactSchema = z.strictObject({
  dataYear: z.number().int(),
  publicationYear: z.number().int(),
  publicationLabel: nonEmpty,
  agencyScope: nonEmpty,
  statuteScope: nonEmpty,
  metricDefs: z.array(
    z.strictObject({
      metricId: nonEmpty,
      label: nonEmpty,
      unit: z.enum(['cases', 'persons', 'percent', 'rate']),
      definition: nonEmpty,
      numeratorMetricId: nonEmpty.optional(),
      denominatorMetricId: nonEmpty.optional(),
      derived: z.boolean().optional(),
    })
  ),
  states: z.array(enforcementStateRowSchema),
  allIndia: z.record(z.string(), z.number().nullable()),
  sourceIds: sourceIdList,
  dataAsOf: isoDate,
  notes: z.array(z.string()),
});
export type CorruptionStatsArtifact = z.infer<typeof corruptionStatsArtifactSchema>;

export const partyCohortRowSchema = z.strictObject({
  partyId: nonEmpty,
  party: nonEmpty,
  partyShort: nonEmpty,
  covered: z.number().int().min(0),
  withDeclared: z.number().int().min(0),
  withSeriousDeclared: z.number().int().min(0).nullable(),
  withConvictions: z.number().int().min(0).nullable(),
  missingRecords: z.number().int().min(0),
  pct: z.number().min(0).max(100).nullable(),
  suppressed: z.boolean(),
});

export const disclosuresArtifactSchema = z.strictObject({
  cohortLabel: nonEmpty,
  electionIds: z.array(nonEmpty).min(1),
  affidavitDateRange: z.strictObject({ from: isoDate.optional(), to: isoDate.optional() }),
  minPartySample: z.number().int().min(1),
  parties: z.array(partyCohortRowSchema),
  qualifyingRulesVersion: nonEmpty,
  /** Case-level corruption-statute layer; null when no reviewed case-level records exist. */
  corruptionStatute: z
    .strictObject({
      covered: z.number().int().min(0),
      withQualifyingCase: z.number().int().min(0),
      note: nonEmpty,
    })
    .nullable(),
  sourceIds: sourceIdList,
  dataAsOf: isoDate,
  notes: z.array(z.string()),
});
export type DisclosuresArtifact = z.infer<typeof disclosuresArtifactSchema>;

export const kpisArtifactSchema = z.strictObject({
  cohortLabel: nonEmpty,
  metrics: z.array(metricResultSchema).min(1),
  dataAsOf: isoDate,
});
export type KpisArtifact = z.infer<typeof kpisArtifactSchema>;
