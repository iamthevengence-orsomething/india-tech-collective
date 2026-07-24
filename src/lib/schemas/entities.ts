import { z } from 'zod';
import {
  isoDate,
  isoDateTime,
  nonEmpty,
  sourceIdList,
  reviewStatus,
  fixtureMarker,
  stateCode,
  houseType,
} from './core';

export const electionSchema = z.strictObject({
  id: nonEmpty,
  type: houseType,
  bodyName: nonEmpty,
  stateCode: stateCode.optional(),
  year: z.number().int().min(1951).max(2100),
  termLabel: nonEmpty,
  pollDate: isoDate.optional(),
  resultDate: isoDate.optional(),
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type Election = z.infer<typeof electionSchema>;

export const politicianSchema = z.strictObject({
  id: nonEmpty,
  slug: nonEmpty,
  displayName: nonEmpty,
  normalizedName: nonEmpty,
  aliases: z.array(nonEmpty),
  gender: z.string().optional(),
  dateOfBirth: isoDate.optional(),
  identityReviewStatus: z.enum(['unreviewed', 'auto_matched', 'human_verified']),
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type Politician = z.infer<typeof politicianSchema>;

export const membershipStatus = z.enum([
  'winner_at_election',
  'current',
  'vacant',
  'resigned',
  'deceased',
  'disqualified',
  'term_ended',
  'unknown',
]);
export type MembershipStatus = z.infer<typeof membershipStatus>;

export const membershipSchema = z.strictObject({
  id: nonEmpty,
  politicianId: nonEmpty,
  electionId: nonEmpty,
  houseType,
  constituencyId: nonEmpty.optional(),
  constituencyName: nonEmpty.optional(),
  stateCode: stateCode.optional(),
  seatType: z.string().optional(),
  partyAtElectionId: nonEmpty,
  /** Only set when independently verified after the election — never inferred. */
  currentPartyId: nonEmpty.optional(),
  currentPartyAsOf: isoDate.optional(),
  termStart: isoDate.optional(),
  termEnd: isoDate.optional(),
  status: membershipStatus,
  statusAsOf: isoDate,
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type Membership = z.infer<typeof membershipSchema>;

export const extractionMethod = z.enum([
  'structured',
  'pdf_text',
  'ocr',
  'manual',
  /** Per-politician counts taken from a published aggregate analysis (e.g. an ADR report), not from parsing the affidavit itself. */
  'aggregate_report',
]);

export const affidavitSchema = z.strictObject({
  id: nonEmpty,
  politicianId: nonEmpty,
  electionId: nonEmpty,
  filingDate: isoDate.optional(),
  sourceUrl: z.url(),
  sourceFileChecksum: z.string().optional(),
  sourcePageCount: z.number().int().positive().optional(),
  languageCodes: z.array(nonEmpty),
  extractionMethod,
  parserVersion: nonEmpty,
  parseConfidence: z.number().min(0).max(1).optional(),
  reviewStatus,
  reviewedAt: isoDateTime.optional(),
  lastVerifiedAt: isoDateTime,
  /**
   * Summary counts of declared cases. basis "parsed_cases" = derived from criminalCase rows;
   * basis "published_report" = taken from a cited published analysis, with no case-level rows behind it.
   */
  declaredSummary: z
    .strictObject({
      pendingCases: z.number().int().min(0).nullable(),
      /** ≥1 declared case meets the source's published "serious" criteria (charge-level flag, not a count). */
      hasSeriousDeclared: z.boolean().nullable(),
      convictions: z.number().int().min(0).nullable(),
      basis: z.enum(['parsed_cases', 'published_report']),
      sourceIds: sourceIdList,
    })
    .optional(),
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type Affidavit = z.infer<typeof affidavitSchema>;

export const mappingStatus = z.enum(['exact', 'reviewed_alias', 'unmapped']);

export const normalizedProvision = z.strictObject({
  actId: nonEmpty,
  section: z.string(),
  mappingStatus,
});
export type NormalizedProvision = z.infer<typeof normalizedProvision>;

export const criminalCaseSchema = z.strictObject({
  id: nonEmpty,
  affidavitId: nonEmpty,
  politicianId: nonEmpty,
  declarationType: z.enum(['pending', 'conviction']),
  caseNumberRaw: z.string().optional(),
  firNumberRaw: z.string().optional(),
  policeStationRaw: z.string().optional(),
  districtRaw: z.string().optional(),
  stateRaw: z.string().optional(),
  courtNameRaw: z.string().optional(),
  /** Acts and sections exactly as declared in the affidavit. Never edited. */
  actsSectionsRaw: nonEmpty,
  normalizedProvisions: z.array(normalizedProvision),
  descriptionRaw: z.string().optional(),
  cognizanceTaken: z.boolean().optional(),
  cognizanceDate: isoDate.optional(),
  chargesFramed: z.boolean().optional(),
  chargeFramedDate: isoDate.optional(),
  convictionDate: isoDate.optional(),
  sentenceRaw: z.string().optional(),
  appealStatusRaw: z.string().optional(),
  declaredStatus: nonEmpty,
  statusAsOf: isoDate,
  pageReference: z.string().optional(),
  rowReference: z.string().optional(),
  corruptionQualification: z.enum(['yes', 'no', 'needs_review']),
  qualificationRuleId: nonEmpty.optional(),
  reviewStatus,
  sourceIds: sourceIdList,
  fixture: fixtureMarker.optional(),
});
export type CriminalCase = z.infer<typeof criminalCaseSchema>;

export const caseEventType = z.enum([
  'fir_registered',
  'investigation',
  'chargesheet_filed',
  'cognizance_taken',
  'charge_framed',
  'trial',
  'convicted',
  'appeal_filed',
  'acquitted',
  'discharged',
  'quashed',
  'closure_report',
  'closed',
]);

/** Post-affidavit updates. Only allowed with a primary source; affidavit remains the default truth. */
export const caseEventSchema = z.strictObject({
  id: nonEmpty,
  criminalCaseId: nonEmpty,
  eventType: caseEventType,
  eventDate: isoDate.optional(),
  proceduralLabel: nonEmpty,
  sourceIds: sourceIdList,
  verifiedAt: isoDateTime,
  fixture: fixtureMarker.optional(),
});
export type CaseEvent = z.infer<typeof caseEventSchema>;
