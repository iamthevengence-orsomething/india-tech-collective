/**
 * data:normalize — turn raw sources into normalized working records.
 * Raw files are read-only; everything here lands in data/work/ (gitignored).
 * Any unresolvable state/party string is an error collected for data:validate.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { normalizeName, slugify } from '../src/lib/slug';
import { runPython, readJson, writeJson, sha256File, log } from './lib/util';

const RAW = 'data/raw';
const WORK = 'data/work';

// ---------- reference dictionaries ----------

interface StateRec { code: string; name: string; type: string; aliases: string[] }
const statesFile = readJson<{ states: StateRec[] }>('data/curated/states.json');
const stateByAlias = new Map<string, StateRec>();
for (const s of statesFile.states) {
  stateByAlias.set(normalizeName(s.name), s);
  for (const a of s.aliases) stateByAlias.set(normalizeName(a), s);
}
export function resolveState(raw: string): StateRec | undefined {
  return stateByAlias.get(normalizeName(raw));
}

interface PartyRec { partyId: string; name: string; shortName: string; aliases: string[] }
const partiesFile = readJson<{ parties: PartyRec[] }>('data/curated/parties.json');
const partyByAlias = new Map<string, PartyRec>();
for (const p of partiesFile.parties) {
  partyByAlias.set(normalizeName(p.name), p);
  partyByAlias.set(normalizeName(p.shortName), p);
  for (const a of p.aliases) partyByAlias.set(normalizeName(a), p);
}
export function resolveParty(raw: string): PartyRec | undefined {
  return partyByAlias.get(normalizeName(raw));
}

const pcOverrides = readJson<{ overrides: Record<string, string> }>('data/curated/pc-name-overrides.json').overrides;

/** PC join key: state code + slug of the PC name without (SC)/(ST) suffixes. */
export function pcKey(stateCode: string, pcNameRaw: string): string {
  const cleaned = pcNameRaw.replace(/\((SC|ST)\)/gi, ' ').trim();
  const key = `${stateCode}-${slugify(cleaned)}`;
  return pcOverrides[key] ?? key;
}

const problems: string[] = [];

// ---------- ADR extraction ----------

interface AdrExtract {
  meta: { parserVersion: string; pages: number };
  summary: Record<string, unknown> & {
    analyzed?: number; withCases?: number; withSerious?: number;
    history?: unknown[]; partySeatAnchors?: Record<string, { seats: number; withSerious: number }>;
  };
  winners: Array<{ sno: number; name: string; state: string; constituency: string; party: string; age: number | null; pageRef: number }>;
  convicted: Array<{ sno: number; nameStatePcParty: string; totalCases: number; convictedCases: number; seriousIpc: number; pageRef: number }>;
  caseBlocks: Array<{
    sno: number | null; name: string; state: string | null; constituency: string | null; party: string | null;
    totalCases: number | null; seriousIpc: number | null; otherIpc: number | null;
    pending: Array<Record<string, string | null>>; convicted: Array<Record<string, string | null>>; pageRef: number;
  }>;
}

function normalizeAdr(): AdrExtract {
  const pdfPath = join(RAW, 'adr-ls2024-report/report.pdf');
  const cachePath = join(WORK, 'adr-extract.json');
  const metaPath = join(WORK, 'adr-extract.meta.json');
  // Cache key covers the input PDF AND the extractor itself.
  const checksum = sha256File(pdfPath) + ':' + sha256File('scripts/py/extract_adr.py');
  if (existsSync(cachePath) && existsSync(metaPath)) {
    const meta = readJson<{ checksum: string }>(metaPath);
    if (meta.checksum === checksum) {
      log('normalize', 'adr: cache hit');
      return readJson<AdrExtract>(cachePath);
    }
  }
  log('normalize', 'adr: running pdf extractor (this takes a few minutes)');
  const extract = runPython<AdrExtract>('scripts/py/extract_adr.py', [pdfPath]);
  writeJson(cachePath, extract);
  writeJson(metaPath, { checksum, parserVersion: extract.meta.parserVersion });
  return extract;
}

// ---------- OGD winners ----------

interface OgdWinner { stateCode: string; stateRaw: string; pcNo: number; pcName: string; winnerNameRaw: string; key: string }

function normalizeOgdWinners(): OgdWinner[] {
  const dir = join(RAW, 'ogd-ls2024-winners');
  const rows: OgdWinner[] = [];
  for (const f of readdirSync(dir).filter((x) => x.startsWith('page-')).sort()) {
    const page = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { records: Array<Record<string, unknown>> };
    for (const rec of page.records) {
      const stateRaw = String(rec['state'] ?? '');
      const st = resolveState(stateRaw);
      if (!st) { problems.push(`ogd-winners: unknown state "${stateRaw}"`); continue; }
      const pcName = String(rec['constituency'] ?? '').trim();
      rows.push({
        stateCode: st.code,
        stateRaw,
        pcNo: Number(rec['const_no_'] ?? 0),
        pcName,
        // NOTE: only fields with unique column names are trusted here; the
        // datastore collapsed duplicate winner/runner-up columns (party, votes,
        // gender, category) so those are deliberately NOT read. See sources.config.
        winnerNameRaw: String(rec['winner_name'] ?? '').trim(),
        key: pcKey(st.code, pcName),
      });
    }
  }
  const keys = new Set(rows.map((r) => r.key));
  if (keys.size !== rows.length) problems.push(`ogd-winners: duplicate PC keys (${rows.length} rows, ${keys.size} keys)`);
  return rows.sort((a, b) => (a.key < b.key ? -1 : 1));
}

// ---------- NCRB tables ----------

interface NcrbTable {
  columns: Array<{ id: string; label: string }>;
  states: Array<{ stateCode: string; stateRaw: string; values: Record<string, number | null> }>;
  totals: Record<string, Record<string, number | null>>;
}

function metricIdFromHeader(header: string): string {
  // strip "( Col. N )" locators and "(Col.11/ Col.14)*100"-style formulas from ids
  // (labels keep them; ids stay stable and readable)
  return slugify(
    header
      .replace(/\( ?Col[^)]*\)/gi, ' ')
      .replace(/\*\s*100/g, ' ')
      .replace(/\*/g, ' ')
  ).replace(/-+/g, '_');
}

function parseNcrbCsv(sourceId: string, filename: string): NcrbTable {
  const text = readFileSync(join(RAW, sourceId, filename), 'utf8').replace(/^﻿/, '');
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  const header = rows[0];
  const columns = header.slice(2).map((h) => ({ id: metricIdFromHeader(h), label: h.replace(/\s+/g, ' ').trim() }));
  const states: NcrbTable['states'] = [];
  const totals: NcrbTable['totals'] = {};
  for (const row of rows.slice(1)) {
    const label = (row[1] ?? '').trim();
    const values: Record<string, number | null> = {};
    columns.forEach((c, i) => {
      const cell = (row[i + 2] ?? '').replace(/,/g, '').trim();
      // 'NA' appears where NCRB does not publish a rate (e.g. zero trials completed)
      values[c.id] = cell === '' || cell === '-' || /^na$/i.test(cell) ? null : Number(cell);
      if (values[c.id] !== null && Number.isNaN(values[c.id])) {
        problems.push(`${sourceId}: non-numeric cell "${row[i + 2]}" in ${label}/${c.label}`);
        values[c.id] = null;
      }
    });
    if (/^total/i.test(label) || /^total/i.test((row[0] ?? '').trim())) {
      totals[slugify(label).replace(/-+/g, '_')] = values;
      continue;
    }
    const st = resolveState(label);
    if (!st) { problems.push(`${sourceId}: unknown state "${label}"`); continue; }
    states.push({ stateCode: st.code, stateRaw: label, values });
  }
  if (states.length !== 36) problems.push(`${sourceId}: expected 36 states/UTs, got ${states.length}`);
  return { columns, states: states.sort((a, b) => (a.stateCode < b.stateCode ? -1 : 1)), totals };
}

// ---------- main ----------

function main() {
  const adr = normalizeAdr();

  // Attach normalized codes/ids to ADR winners
  const adrWinners = adr.winners.map((w) => {
    const st = resolveState(w.state);
    if (!st) problems.push(`adr-winners: unknown state "${w.state}" (sno ${w.sno})`);
    const party = resolveParty(w.party);
    if (!party) problems.push(`adr-winners: unresolved party "${w.party}" (sno ${w.sno}, ${w.name})`);
    return {
      ...w,
      stateCode: st?.code ?? 'XX',
      partyId: party?.partyId ?? null,
      key: st ? pcKey(st.code, w.constituency) : `XX-${slugify(w.constituency)}`,
    };
  });

  const adrBlocks = adr.caseBlocks.map((raw) => {
    // Some pages render the winner header on one physical line:
    // "Name State:X Constituency:Y Party: Z ..." — unglue before resolving.
    const b = { ...raw };
    if (b.name && /State\s*:/.test(b.name)) {
      const m = /^(.*?)\s+State\s*:\s*(.*?)(?:\s+Constituency\s*:\s*(.*?))?(?:\s+Party\s*:\s*(.*?))?$/.exec(b.name);
      if (m) {
        b.name = m[1].trim();
        b.state = b.state ?? m[2]?.trim() ?? null;
        b.constituency = b.constituency ?? m[3]?.trim() ?? null;
        b.party = b.party ?? m[4]?.trim() ?? null;
      }
    }
    let st = b.state ? resolveState(b.state) : undefined;
    // PDF line wrap can truncate two-word states ("ANDHRA\nPRADESH")
    if (!st && b.state && !/\s/.test(b.state.trim())) st = resolveState(`${b.state} PRADESH`);
    let key = st && b.constituency ? pcKey(st.code, b.constituency) : null;
    if (!key) {
      // conservative fallback: exact, UNIQUE name match against the winners list
      const nameMatches = adrWinners.filter((w) => normalizeName(w.name) === normalizeName(b.name));
      if (nameMatches.length === 1) {
        key = nameMatches[0].key;
        st = st ?? { code: nameMatches[0].stateCode, name: '', type: '', aliases: [] };
        b.constituency = b.constituency ?? nameMatches[0].constituency;
        problems.push(`adr-caseblocks: NOTE ${b.name} joined by unique name match (state line wrapped in PDF)`);
      } else {
        problems.push(`adr-caseblocks: unknown/missing state "${b.state}" (${b.name})`);
        if (!b.constituency) problems.push(`adr-caseblocks: missing constituency (${b.name})`);
      }
    }
    return { ...b, stateCode: st?.code ?? 'XX', key };
  });

  const ogdWinners = normalizeOgdWinners();

  writeJson(join(WORK, 'adr.normalized.json'), { summary: adr.summary, meta: adr.meta, winners: adrWinners, convicted: adr.convicted, caseBlocks: adrBlocks });
  writeJson(join(WORK, 'ogd-winners.normalized.json'), ogdWinners);

  const ncrb = {
    registered: parseNcrbCsv('ogd-ncrb-pca-registered-2023', 'NCRB_CII_2023_Table_8C.2.csv'),
    policeDisposal: parseNcrbCsv('ogd-ncrb-police-disposal-2023', 'NCRB_CII_2023_Table_8C.3.csv'),
    courtDisposal: parseNcrbCsv('ogd-ncrb-court-disposal-2023', 'NCRB_CII_2023_Table_8C.4.csv'),
  };
  writeJson(join(WORK, 'ncrb.normalized.json'), ncrb);

  writeJson(join(WORK, 'normalize-problems.json'), problems);
  log('normalize', `adr winners=${adrWinners.length} blocks=${adrBlocks.length} | ogd winners=${ogdWinners.length} | ncrb states=${ncrb.registered.states.length}/${ncrb.policeDisposal.states.length}/${ncrb.courtDisposal.states.length}`);
  if (problems.length > 0) {
    log('normalize', `${problems.length} problem(s) recorded — data:validate will decide severity`);
    for (const p of problems.slice(0, 25)) console.log('  -', p);
    if (problems.length > 25) console.log(`  … and ${problems.length - 25} more`);
  }
}

main();
