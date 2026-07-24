import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeActsSections, qualifyCorruption } from '../../src/lib/statutes';
import type { StatuteDictionary, QualificationRules } from '../../src/lib/statutes';

const dict = JSON.parse(readFileSync('data/curated/statute-dictionary.json', 'utf8')) as StatuteDictionary;
const rulesFile = JSON.parse(readFileSync('data/curated/corruption-qualification-rules.json', 'utf8'));
const rules: QualificationRules = {
  version: rulesFile.version,
  qualifying: rulesFile.qualifying,
  explicitlyNotAuto: rulesFile.explicitlyNotAuto,
  defaultRuleId: rulesFile.defaultRuleId,
};

describe('statute normalization', () => {
  it('maps PC Act aliases to the canonical act', () => {
    const provisions = normalizeActsSections('P.C. Act Section 13(2)', dict);
    expect(provisions[0].actId).toBe('in-act-pca-1988');
    expect(provisions[0].section).toBe('13(2)');
  });

  it('splits multi-act declarations', () => {
    const provisions = normalizeActsSections('IPC Sections 147, 148; PC Act Section 7', dict);
    const acts = provisions.map((p) => p.actId);
    expect(acts).toContain('in-act-ipc-1860');
    expect(acts).toContain('in-act-pca-1988');
    expect(provisions.filter((p) => p.actId === 'in-act-ipc-1860').map((p) => p.section)).toEqual([
      '147',
      '148',
    ]);
  });

  it('keeps unknown statutes as unmapped raw text', () => {
    const provisions = normalizeActsSections('Some Obscure State Act Section 5', dict);
    expect(provisions[0].mappingStatus).toBe('unmapped');
    expect(provisions[0].section).toContain('Some Obscure State Act');
  });
});

describe('corruption qualification', () => {
  it('PC Act cases qualify with an explicit rule id', () => {
    const provisions = normalizeActsSections('Prevention of Corruption Act, 1988 Section 13(1)(d)', dict);
    const q = qualifyCorruption(provisions, rules);
    expect(q.qualification).toBe('yes');
    expect(q.ruleId).toBe('cq-pca-1988');
  });

  it('PMLA is NEVER auto-classified as corruption', () => {
    const provisions = normalizeActsSections('Prevention of Money Laundering Act Section 3', dict);
    const q = qualifyCorruption(provisions, rules);
    expect(q.qualification).toBe('needs_review');
  });

  it('IPC 420 cheating is NEVER auto-classified as corruption', () => {
    const provisions = normalizeActsSections('IPC Section 420', dict);
    const q = qualifyCorruption(provisions, rules);
    expect(q.qualification).toBe('needs_review');
  });

  it('IPC 406 breach of trust is NEVER auto-classified as corruption', () => {
    const provisions = normalizeActsSections('IPC Section 406', dict);
    expect(qualifyCorruption(provisions, rules).qualification).toBe('needs_review');
  });

  it('ordinary offences are "no", not corruption', () => {
    const provisions = normalizeActsSections('IPC Sections 147, 148, 149', dict);
    expect(qualifyCorruption(provisions, rules).qualification).toBe('no');
  });

  it('unmapped statutes require review', () => {
    const provisions = normalizeActsSections('Unknown Act 12', dict);
    expect(qualifyCorruption(provisions, rules).qualification).toBe('needs_review');
  });
});
