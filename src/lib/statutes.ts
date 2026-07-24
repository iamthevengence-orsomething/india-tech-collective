import type { NormalizedProvision } from './schemas/entities';

/**
 * Statute normalization. Raw affidavit text is never edited; we attach
 * normalized provisions next to it. Matching is dictionary-driven and
 * versioned — no model-generated labels.
 */

export interface StatuteAct {
  actId: string;
  name: string;
  shortName?: string;
  /** Reviewed alias strings as they appear in affidavits/reports (case-insensitive). */
  aliases: string[];
  notes?: string[];
}

export interface StatuteDictionary {
  version: string;
  updated: string;
  acts: StatuteAct[];
}

export interface QualificationRules {
  version: string;
  /** actIds that make a case a corruption offence for dashboard purposes. */
  qualifying: Array<{ qualificationRuleId: string; actId: string; citation: string }>;
  /**
   * Provisions that must NEVER be auto-classified as corruption.
   * When `sections` is present the rule applies only to those sections of the
   * act (base-section match, e.g. "420" also matches "420(2)"); otherwise to
   * the whole act.
   */
  explicitlyNotAuto: Array<{ qualificationRuleId: string; actId: string; sections?: string[]; reason: string }>;
  defaultRuleId: string;
}

const sectionBase = (s: string) => /^(\d+[A-Z]{0,2})/.exec(s)?.[1] ?? s;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9()]+/g, ' ').trim();

interface AliasEntry {
  alias: string;
  actId: string;
  isCanonical: boolean;
}

function aliasTable(dict: StatuteDictionary): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const act of dict.acts) {
    entries.push({ alias: norm(act.name), actId: act.actId, isCanonical: true });
    if (act.shortName) entries.push({ alias: norm(act.shortName), actId: act.actId, isCanonical: false });
    for (const a of act.aliases) entries.push({ alias: norm(a), actId: act.actId, isCanonical: false });
  }
  // Longest alias first so "prevention of corruption act" wins over "corruption act".
  return entries.sort((a, b) => b.alias.length - a.alias.length);
}

const SECTION_RE = /(\d+[A-Z]{0,2}(?:\(\d+\))?(?:\([a-z]{1,3}\))?)/g;

/**
 * Split a raw "acts & sections" declaration into per-act provisions.
 * Segments that match no dictionary act come back as mappingStatus "unmapped"
 * with the raw segment preserved in `section`.
 */
export function normalizeActsSections(raw: string, dict: StatuteDictionary): NormalizedProvision[] {
  const table = aliasTable(dict);
  const segments = raw
    .split(/;|\band\b|\r?\n|\//i)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: NormalizedProvision[] = [];

  for (const segment of segments) {
    const nseg = norm(segment);
    const hit = table.find((e) => nseg.includes(e.alias));
    if (!hit) {
      out.push({ actId: 'unmapped', section: segment, mappingStatus: 'unmapped' });
      continue;
    }
    const sectionPart = nseg.replace(hit.alias, ' ');
    const sections = [...sectionPart.matchAll(SECTION_RE)].map((m) => m[1]);
    const mappingStatus = hit.isCanonical ? 'exact' : 'reviewed_alias';
    if (sections.length === 0) {
      out.push({ actId: hit.actId, section: '', mappingStatus });
    } else {
      for (const s of sections) out.push({ actId: hit.actId, section: s, mappingStatus });
    }
  }
  return out;
}

/**
 * Corruption qualification: "yes" ONLY via a reviewed qualifying rule.
 * Listed sensitive statutes (PMLA, cheating, breach of trust, …) => needs_review.
 * Unmapped segments => needs_review (a human must look).
 * Everything else (ordinary offences) => "no".
 */
export function qualifyCorruption(
  provisions: NormalizedProvision[],
  rules: QualificationRules
): { qualification: 'yes' | 'no' | 'needs_review'; ruleId: string } {
  for (const p of provisions) {
    const q = rules.qualifying.find((r) => r.actId === p.actId);
    if (q) return { qualification: 'yes', ruleId: q.qualificationRuleId };
  }
  for (const p of provisions) {
    const nr = rules.explicitlyNotAuto.find(
      (r) =>
        r.actId === p.actId &&
        (!r.sections || r.sections.some((s) => sectionBase(s) === sectionBase(p.section)))
    );
    if (nr) return { qualification: 'needs_review', ruleId: nr.qualificationRuleId };
  }
  if (provisions.some((p) => p.mappingStatus === 'unmapped')) {
    return { qualification: 'needs_review', ruleId: rules.defaultRuleId };
  }
  return { qualification: 'no', ruleId: rules.defaultRuleId };
}
