import { z } from 'zod';
import { isoDate, isoDateTime, nonEmpty, fixtureMarker } from './core';

export const sourceSchema = z.strictObject({
  id: nonEmpty,
  publisher: nonEmpty,
  title: nonEmpty,
  url: z.url(),
  sourceType: z.enum([
    'official_portal',
    'official_dataset',
    'official_report',
    'official_document',
    'ngo_report',
    'terms_or_licence',
    'legal_text',
    'boundary_data',
  ]),
  publicationDate: isoDate.optional(),
  /** When we last retrieved or verified the source. */
  retrievalDate: isoDate.optional(),
  statusAsOf: isoDate.optional(),
  licenceOrTermsUrl: z.url().optional(),
  licenceName: z.string().optional(),
  checksum: z.string().optional(),
  archiveUrl: z.url().optional(),
  parserVersion: z.string().optional(),
  notes: z.array(z.string()),
  fixture: fixtureMarker.optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const pipelineRunSchema = z.strictObject({
  runId: nonEmpty,
  startedAt: isoDateTime,
  finishedAt: isoDateTime.optional(),
  gitCommit: z.string().optional(),
  node: z.string().optional(),
  steps: z.array(
    z.strictObject({
      name: nonEmpty,
      ok: z.boolean(),
      records: z.number().int().min(0).optional(),
      durationMs: z.number().min(0).optional(),
      error: z.string().optional(),
    })
  ),
  inputChecksums: z.record(z.string(), z.string()).optional(),
  outputDatasetVersion: z.string().optional(),
});
export type PipelineRun = z.infer<typeof pipelineRunSchema>;

/** Append-only public correction log entry. Never edit or delete existing entries. */
export const correctionSchema = z.strictObject({
  id: nonEmpty,
  date: isoDate,
  profileUrl: z.string().optional(),
  field: nonEmpty,
  oldValue: z.string(),
  newValue: z.string(),
  reason: nonEmpty,
  authoritativeSourceUrl: z.url().optional(),
  notes: z.array(z.string()).optional(),
});
export type Correction = z.infer<typeof correctionSchema>;

export const buildInfoSchema = z.strictObject({
  /** Newest underlying source date across the dataset (what "data as of" means site-wide). */
  dataAsOf: isoDate,
  builtAt: isoDateTime,
  gitCommit: z.string().optional(),
  datasetVersion: nonEmpty,
  dataMode: z.enum(['production', 'demo']),
  counts: z.record(z.string(), z.number().int().min(0)),
});
export type BuildInfo = z.infer<typeof buildInfoSchema>;
