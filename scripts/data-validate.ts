/**
 * data:validate — schema + referential integrity + reconciliation gates.
 * Hard errors exit 1 (the build never sees unreconciled data). Warnings are
 * carried into the data-quality report.
 */
import { join } from 'node:path';
import { readJson, writeJson, fail, log } from './lib/util';
import { resolveParty } from './data-normalize';

const WORK = 'data/work';
const errors: string[] = [];
const warnings: string[] = [];
const stats: Record<string, unknown> = {};

interface AdrNormalized {
  summary: {
    analyzed?: number; withCases?: number; withSerious?: number;
    history?: Array<{ year: number }>;
    partySeatAnchors?: Record<string, { seats: number; withSerious: number }>;
  };
  winners: Array<{ sno: number; name: string; stateCode: string; partyId: string | null; party: string; key: string; constituency: string }>;
  convicted: Array<{ sno: number }>;
  caseBlocks: Array<{
    name: string; key: string | null; stateCode: string; totalCases: number | null; seriousIpc: number | null;
    pending: unknown[]; convicted: unknown[];
  }>;
}

function main() {
  const adr = readJson<AdrNormalized>(join(WORK, 'adr.normalized.json'));
  const ogd = readJson<Array<{ key: string; winnerNameRaw: string; stateCode: string }>>(join(WORK, 'ogd-winners.normalized.json'));
  const ncrb = readJson<Record<string, { columns: Array<{ id: string }>; states: Array<{ stateCode: string; values: Record<string, number | null> }>; totals: Record<string, Record<string, number | null>> }>>(join(WORK, 'ncrb.normalized.json'));
  const normalizeProblems = readJson<string[]>(join(WORK, 'normalize-problems.json'));

  for (const p of normalizeProblems) {
    (/unknown state|unresolved party|duplicate/.test(p) ? errors : warnings).push(`normalize: ${p}`);
  }

  // ---- ADR internal gates ----
  const s = adr.summary;
  if (s.analyzed !== 543) errors.push(`adr: printed analyzed=${s.analyzed}, expected 543`);
  if (s.withCases !== 251) errors.push(`adr: printed withCases=${s.withCases}, expected the report's own 251`);
  if (adr.winners.length !== 543) errors.push(`adr: extracted winners=${adr.winners.length}, must equal printed 543`);
  const snos = new Set(adr.winners.map((w) => w.sno));
  if (snos.size !== 543) errors.push(`adr: winner S.No. not unique/complete (${snos.size})`);
  if (adr.caseBlocks.length !== s.withCases) {
    errors.push(`adr: caseBlocks=${adr.caseBlocks.length} != printed withCases=${s.withCases}`);
  }
  const seriousBlocks = adr.caseBlocks.filter((b) => (b.seriousIpc ?? 0) > 0).length;
  if (s.withSerious !== undefined && seriousBlocks !== s.withSerious) {
    errors.push(`adr: blocks with serious charges=${seriousBlocks} != printed withSerious=${s.withSerious}`);
  }
  const convictedBlocks = adr.caseBlocks.filter((b) => b.convicted.length > 0).length;
  if (convictedBlocks !== adr.convicted.length) {
    errors.push(`adr: blocks with convicted entries=${convictedBlocks} != printed convicted table rows=${adr.convicted.length}`);
  }
  if (adr.convicted.length !== 27) warnings.push(`adr: convicted table rows=${adr.convicted.length} (report prints 27)`);

  // Party seat aggregation vs the report's own printed anchors
  const seatByParty = new Map<string, number>();
  for (const w of adr.winners) {
    if (!w.partyId) continue;
    seatByParty.set(w.partyId, (seatByParty.get(w.partyId) ?? 0) + 1);
  }
  for (const [anchorName, anchor] of Object.entries(s.partySeatAnchors ?? {})) {
    const rec = resolveParty(anchorName);
    if (!rec) { errors.push(`adr: anchor party "${anchorName}" not in parties.json`); continue; }
    const got = seatByParty.get(rec.partyId) ?? 0;
    if (got !== anchor.seats) errors.push(`adr: ${anchorName} seats extracted=${got} != printed=${anchor.seats}`);
  }
  const totalSeats = [...seatByParty.values()].reduce((a, b) => a + b, 0);
  if (totalSeats !== 543) errors.push(`adr: party-resolved seats sum=${totalSeats} != 543 (unresolved parties above)`);

  // ---- OGD winners + join gates ----
  if (ogd.length !== 542) errors.push(`ogd: winners=${ogd.length}, expected 542 (Surat excluded at source)`);
  stats.ogdStates = new Set(ogd.map((o) => o.stateCode)).size;
  if (stats.ogdStates !== 36) errors.push(`ogd: distinct states=${stats.ogdStates}, expected 36`);

  const ogdKeys = new Set(ogd.map((o) => o.key));
  const adrKeys = new Set(adr.winners.map((w) => w.key));
  const adrOnly = [...adrKeys].filter((k) => !ogdKeys.has(k)).sort();
  const ogdOnly = [...ogdKeys].filter((k) => !adrKeys.has(k)).sort();
  stats.joined = 543 - adrOnly.length;
  if (!(adrOnly.length === 1 && adrOnly[0].endsWith('-surat') && ogdOnly.length === 0)) {
    errors.push(
      `join: expected exactly ADR-only=[GJ-surat]; got adrOnly=[${adrOnly.slice(0, 8).join(', ')}${adrOnly.length > 8 ? '…' : ''}] ogdOnly=[${ogdOnly.slice(0, 8).join(', ')}${ogdOnly.length > 8 ? '…' : ''}] — add reviewed pc-name-overrides`
    );
  }

  // Case blocks must join to winners
  const blockKeys = adr.caseBlocks.map((b) => b.key);
  const unjoinedBlocks = blockKeys.filter((k) => !k || !adrKeys.has(k));
  if (unjoinedBlocks.length > 0) errors.push(`adr: ${unjoinedBlocks.length} case block(s) with no winner join`);
  const distinctBlockKeys = new Set(blockKeys.filter(Boolean));
  if (distinctBlockKeys.size !== adr.caseBlocks.length) {
    errors.push(`adr: duplicate case-block constituencies (${distinctBlockKeys.size} keys for ${adr.caseBlocks.length} blocks)`);
  }

  // Block internal consistency: totalCases vs parsed entries
  let totalMismatch = 0;
  for (const b of adr.caseBlocks) {
    const parsed = b.pending.length + b.convicted.length;
    if (b.totalCases !== null && parsed !== b.totalCases) totalMismatch += 1;
  }
  stats.caseCountMismatches = totalMismatch;
  if (totalMismatch > 0) {
    warnings.push(`adr: ${totalMismatch} block(s) where parsed entries != printed Total Cases (parsed counts used; raw preserved)`);
  }

  // ---- NCRB gates ----
  for (const [table, t] of Object.entries(ncrb)) {
    if (t.states.length !== 36) errors.push(`ncrb/${table}: states=${t.states.length}, expected 36`);
    const allIndia = t.totals['total_all_india'];
    if (!allIndia) { errors.push(`ncrb/${table}: no Total All India row`); continue; }
    for (const col of t.columns) {
      if (/rate|percentage/.test(col.id)) continue;
      const sum = t.states.reduce((acc, st) => acc + (st.values[col.id] ?? 0), 0);
      const printed = allIndia[col.id];
      if (printed !== null && printed !== undefined && sum !== printed) {
        errors.push(`ncrb/${table}: sum(states)=${sum} != All-India=${printed} for ${col.id}`);
      }
    }
  }
  // Cross-table: registrations total equals police-disposal "reported during year"
  const reg = ncrb.registered, pol = ncrb.policeDisposal;
  if (reg && pol) {
    const regTotalCol = reg.columns.find((c) => c.id === 'total')?.id;
    const repCol = pol.columns.find((c) => c.id.includes('reported'))?.id;
    if (regTotalCol && repCol) {
      let mismatches = 0;
      for (const st of reg.states) {
        const other = pol.states.find((p) => p.stateCode === st.stateCode);
        if (other && st.values[regTotalCol] !== other.values[repCol]) mismatches += 1;
      }
      stats.ncrbCrossTableMismatches = mismatches;
      if (mismatches > 0) warnings.push(`ncrb: ${mismatches} state(s) where 8C.2 total != 8C.3 reported-during-year (both shown as published)`);
    }
  }

  writeJson('data/generated/validation-report.json', { errors, warnings, stats });
  log('validate', `errors=${errors.length} warnings=${warnings.length} stats=${JSON.stringify(stats)}`);
  if (errors.length > 0) fail('validate', errors);
}

main();
