import { createHash } from 'node:crypto';
import { normalizeName, slugify } from '../../src/lib/slug';

/**
 * Deterministic ids. Derived only from stable source facts so reruns and
 * re-imports produce identical ids (no dedup drift, no broken profile URLs).
 */

export function constituencyId(stateCode: string, constituencyName: string): string {
  return `${stateCode}-${slugify(constituencyName)}`;
}

export function politicianId(houseType: string, electionId: string, constituencyKey: string, displayName: string): string {
  const input = `${houseType}|${electionId}|${constituencyKey}|${normalizeName(displayName)}`;
  return 'pol-' + createHash('sha256').update(input).digest('hex').slice(0, 10);
}

export function membershipId(politicianIdValue: string, electionId: string): string {
  return `mem-${electionId}-${politicianIdValue.replace(/^pol-/, '')}`;
}

export function affidavitId(politicianIdValue: string, electionId: string): string {
  return `aff-${electionId}-${politicianIdValue.replace(/^pol-/, '')}`;
}

export function criminalCaseId(affidavitIdValue: string, declarationType: string, ordinal: number): string {
  return `case-${affidavitIdValue.replace(/^aff-/, '')}-${declarationType === 'conviction' ? 'c' : 'p'}${ordinal}`;
}
