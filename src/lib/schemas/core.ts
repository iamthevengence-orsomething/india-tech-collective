import { z } from 'zod';

/** YYYY-MM-DD (we never store partial dates; unknown = absent). */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

/** UTC instant, second precision or better. */
export const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, 'expected ISO-8601 UTC datetime');

export const nonEmpty = z.string().min(1);

/** Every stored record must be traceable to at least one source registry entry. */
export const sourceIdList = z.array(nonEmpty).min(1);

/**
 * Review ladder for any record that makes a claim about a named person.
 * "machine_checked" = passed automated reconciliation gates but no human read it.
 * Only machine_checked / human_verified records may be displayed in production.
 */
export const reviewStatus = z.enum(['unreviewed', 'machine_checked', 'human_verified', 'rejected']);
export type ReviewStatus = z.infer<typeof reviewStatus>;

/** Demo/fixture marker. Its presence in a production artifact fails the build (data:check). */
export const fixtureMarker = z.literal(true);

export const stateCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'expected two-letter state/UT code (ISO 3166-2:IN style)');

export const houseType = z.enum([
  'lok_sabha',
  'assembly',
  'rajya_sabha',
  'legislative_council',
  'local_body',
]);
export type HouseType = z.infer<typeof houseType>;
