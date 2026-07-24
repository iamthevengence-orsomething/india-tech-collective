import { z } from 'zod';
import { isoDate, isoDateTime, nonEmpty, sourceIdList, reviewStatus, fixtureMarker, stateCode } from './core';

export const corruptionStateStatSchema = z.strictObject({
  id: nonEmpty,
  year: z.number().int().min(1990).max(2100),
  stateCode,
  /** e.g. "acb_vigilance_lokayukta" — which agencies the table covers, as stated by the source. */
  agencyScope: nonEmpty,
  /** e.g. "pc_act_1988" — which statutes the table covers, as stated by the source. */
  statuteScope: nonEmpty,
  metricId: nonEmpty,
  value: z.number().nullable(),
  unit: z.enum(['cases', 'persons', 'percent', 'rate']),
  numeratorMetricId: nonEmpty.optional(),
  denominatorMetricId: nonEmpty.optional(),
  sourceIds: sourceIdList,
  notes: z.array(z.string()),
  fixture: fixtureMarker.optional(),
});
export type CorruptionStateStat = z.infer<typeof corruptionStateStatSchema>;

export const amountType = z.enum([
  'loss',
  'avoidable_expenditure',
  'blocked_funds',
  'short_levy',
  'non_recovery',
  'irregular_expenditure',
  'estimate',
  'other',
]);

export const AUDIT_FINDING_LABEL = 'Audit finding — not a criminal adjudication' as const;

export const auditFindingSchema = z.strictObject({
  id: nonEmpty,
  reportTitle: nonEmpty,
  reportNumber: z.string().optional(),
  publishingAuthority: nonEmpty,
  jurisdiction: z.strictObject({
    level: z.enum(['union', 'state', 'local_body']),
    stateCode: stateCode.optional(),
  }),
  department: z.string().optional(),
  sector: z.string().optional(),
  reportType: z.string().optional(),
  periodAudited: z.string().optional(),
  publicationDate: isoDate.optional(),
  tablingDate: isoDate.optional(),
  findingTitle: nonEmpty,
  /** Short, faithful summary — no editorialising, no totalling of unlike figures. */
  summary: nonEmpty,
  amount: z
    .strictObject({
      value: z.number().min(0),
      currency: z.literal('INR'),
      amountType,
      period: z.string().optional(),
    })
    .optional(),
  paragraphRef: z.string().optional(),
  pageRef: z.string().optional(),
  sourcePdfUrl: z.url(),
  governmentResponse: z.string().optional(),
  reviewStatus,
  reviewedBy: z.string().optional(),
  label: z.literal(AUDIT_FINDING_LABEL),
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type AuditFinding = z.infer<typeof auditFindingSchema>;

/** Real CAG report metadata for the "pipeline in review" listing (no extracted findings). */
export const cagReportMetaSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  url: z.url(),
  authority: nonEmpty,
  date: isoDate.optional(),
  sector: z.string().optional(),
  retrievedAt: isoDateTime,
  fixture: fixtureMarker.optional(),
});
export type CagReportMeta = z.infer<typeof cagReportMetaSchema>;
