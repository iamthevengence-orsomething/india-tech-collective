/**
 * og:generate — build-time Open Graph images (1200×630) and square share
 * cards (1080×1080) via satori + resvg. Deterministic: all text comes from the
 * generated artifacts (dataAsOf, counts), never from the clock. Output lands
 * in public/og/ (gitignored; rebuilt in every `npm run build`).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readJson, log } from './lib/util';

const OUT = 'public/og';
const isDemo = process.env.DATA_MODE === 'demo';
const SITE_DIR = isDemo ? 'tests/fixtures/generated/site' : 'data/generated/site';
const GEN_DIR = isDemo ? 'tests/fixtures/generated' : 'data/generated';

const kpis = readJson<any>(`${SITE_DIR}/kpis.json`);
const stats = readJson<any>(`${SITE_DIR}/corruption.stats.json`);
const full = readJson<any>(`${GEN_DIR}/politicians.full.json`);
const buildInfo = readJson<any>(`${GEN_DIR}/build-info.json`);

const fonts = [
  { name: 'Garamond', data: readFileSync('assets/og-fonts/static/EBGaramond-SemiBold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Garamond', data: readFileSync('assets/og-fonts/static/EBGaramond-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'GaramondItalic', data: readFileSync('assets/og-fonts/static/EBGaramond-Italic.ttf'), weight: 500 as const, style: 'italic' as const },
  { name: 'Mono', data: readFileSync('assets/og-fonts/static/GeistMono-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
  { name: 'Mono', data: readFileSync('assets/og-fonts/static/GeistMono-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
];

const C = {
  bg: '#F6F1E5', surface: '#FBF7EC', ink: '#211A10', strong: '#14100A',
  muted: 'rgba(33,26,16,0.72)', faint: 'rgba(33,26,16,0.55)',
  saffron: '#9A7420', green: '#6E5214', line: 'rgba(33,26,16,0.28)',
};

const el = (type: string, style: Record<string, unknown>, children?: unknown): any => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });
const txt = (text: string, style: Record<string, unknown>): any => el('div', style, text);

interface CardSpec {
  kicker: string;
  headline: string;
  stat?: { value: string; label: string };
  definition: string;
  asOf: string;
  source: string;
  disclaimer: string;
  url: string;
}

function cardTree(spec: CardSpec, w: number, h: number) {
  const square = w === h;
  return el('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: C.bg, padding: square ? 60 : 52, fontFamily: 'Garamond', color: C.ink,
    justifyContent: 'space-between',
    border: `10px solid ${C.bg}`, boxShadow: `inset 0 0 0 2px ${C.line}`,
  }, [
    el('div', { display: 'flex', flexDirection: 'column', padding: square ? 24 : 20 }, [
      txt('INDIA TECH COLLECTIVE — ' + spec.kicker, {
        fontFamily: 'Mono', fontSize: square ? 22 : 19, letterSpacing: 6, color: C.green, fontWeight: 500,
      }),
      txt(spec.headline, {
        fontFamily: 'Garamond', fontWeight: 600, color: C.strong,
        fontSize: square ? 68 : 58, lineHeight: 1.08, marginTop: 26, maxWidth: w - (square ? 160 : 140),
      }),
      spec.stat
        ? el('div', { display: 'flex', alignItems: 'baseline', gap: 22, marginTop: 30 }, [
            txt(spec.stat.value, { fontFamily: 'Mono', fontWeight: 500, fontSize: square ? 104 : 86, color: C.saffron, lineHeight: 1 }),
            txt(spec.stat.label, { fontSize: square ? 31 : 26, color: C.muted, maxWidth: w * 0.5, lineHeight: 1.3 }),
          ])
        : el('div', { display: 'flex' }),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', gap: 11, padding: square ? 24 : 20 }, [
      txt(spec.definition, { fontSize: square ? 27 : 23, color: C.ink, maxWidth: w - (square ? 160 : 140), lineHeight: 1.35 }),
      txt(`Data as of ${spec.asOf} · ${spec.source}`, { fontFamily: 'Mono', fontSize: square ? 19 : 16, color: C.muted }),
      txt(spec.disclaimer, { fontFamily: 'GaramondItalic', fontStyle: 'italic', fontSize: square ? 24 : 21, color: C.faint, maxWidth: w - (square ? 160 : 140), lineHeight: 1.3 }),
      el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.line}`, paddingTop: 16, marginTop: 4 }, [
        txt(spec.url, { fontFamily: 'Mono', fontSize: square ? 21 : 18, color: C.green, fontWeight: 500 }),
        txt('A PUBLIC RECORD, KEPT IN PUBLIC', { fontFamily: 'Mono', fontSize: square ? 15 : 13, letterSpacing: 3, color: C.faint }),
      ]),
    ]),
  ]);
}

async function render(file: string, spec: CardSpec, w: number, h: number) {
  const svg = await satori(cardTree(spec, w, h), { width: w, height: h, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
  writeFileSync(`${OUT}/${file}`, png);
}

const DISCLAIMER = 'Self-declared in sworn election affidavits. A declared case is an accusation, not a conviction.';

async function main() {
  mkdirSync(`${OUT}/profiles`, { recursive: true });

  // cache: skip when the dataset hasn't changed
  const stampFile = `${OUT}/.stamp`;
  const stamp = `${buildInfo.datasetVersion}:${isDemo ? 'demo' : 'prod'}:v4-manuscript`;
  if (existsSync(stampFile) && readFileSync(stampFile, 'utf8') === stamp) {
    log('og', 'cache hit — images match current datasetVersion');
    return;
  }

  const m = (id: string) => kpis.metrics.find((x: any) => x.metricId === id);
  const withCases = m('reps_with_declared_cases_pct');
  const asOf = kpis.dataAsOf as string;

  // route-level 1200×630
  await render('site.png', {
    kicker: 'MANIFESTO',
    headline: 'A public record, kept in public',
    definition: 'Open-source tools for speech under pressure, and open records of public power — sourced, dated, and honest about their limits.',
    asOf: buildInfo.dataAsOf, source: 'sources listed at /sources', disclaimer: 'Non-partisan · lawful · grounded in Article 19.',
    url: 'indiatechcollective.org',
  }, 1200, 630);

  await render('toolkit.png', {
    kicker: 'PART I — THE TOOLKIT',
    headline: 'Instruments, open to inspection',
    definition: 'Twenty-seven open-source tools for difficult days: mesh messengers, secure channels, lawful circumvention, evidence.',
    asOf: buildInfo.dataAsOf, source: 'official project links at /toolkit', disclaimer: 'Chosen is not endorsed — verify each project’s own documentation.',
    url: 'indiatechcollective.org/toolkit',
  }, 1200, 630);

  await render('politicians.png', {
    kicker: 'PART II — POLITICIAN CASES',
    headline: 'Cases declared by elected representatives',
    stat: { value: `${withCases.value.toFixed(0)}%`, label: `${withCases.numerator} of ${withCases.denominator} Lok Sabha winners declared ≥1 criminal case` },
    definition: withCases.definition,
    asOf, source: 'ADR/NEW analysis of ECI affidavits + OGD results (GODL)', disclaimer: DISCLAIMER,
    url: 'indiatechcollective.org/politicians',
  }, 1200, 630);

  const reg = stats.allIndia['reg_total'];
  await render('corruption.png', {
    kicker: 'PART III — CORRUPTION DATA',
    headline: 'PC Act enforcement, disclosures and audits — three honest lenses',
    stat: { value: String(reg ?? '—'), label: `PC Act cases registered by ACBs/Vigilance across India in ${stats.dataYear} (reported enforcement activity)` },
    definition: 'Reported enforcement is not a corruption ranking: counts reflect reporting and enforcement capacity too.',
    asOf: stats.dataAsOf, source: `NCRB Crime in India ${stats.dataYear} via data.gov.in (GODL)`, disclaimer: 'No composite corruption score exists on this site.',
    url: 'indiatechcollective.org/corruption',
  }, 1200, 630);

  await render('coverage.png', {
    kicker: 'COVERAGE & GAPS',
    headline: 'What this data covers — and what it doesn’t yet',
    definition: 'Seat-by-seat coverage, review states and every active fallback, stated plainly.',
    asOf: buildInfo.dataAsOf, source: 'pipeline data-quality report', disclaimer: 'Missing data is shown as missing, never as zero.',
    url: 'indiatechcollective.org/coverage',
  }, 1200, 630);

  await render('methodology.png', {
    kicker: 'METHODOLOGY',
    headline: 'Every number, defined. Every source, cited.',
    definition: 'Form 26 affidavits, statute mappings, denominators, and why there is no corruption score.',
    asOf: buildInfo.dataAsOf, source: 'indiatechcollective.org/sources', disclaimer: DISCLAIMER,
    url: 'indiatechcollective.org/methodology',
  }, 1200, 630);

  // landing square card (restores the missing /og-card.png reference)
  await render('card-1080.png', {
    kicker: 'OPEN DEMOCRACY TOOLKIT',
    headline: 'They can cut the internet. Not the network.',
    definition: '27 open-source tools + accountability dashboards built from official disclosures.',
    asOf: buildInfo.dataAsOf, source: 'indiatechcollective.org', disclaimer: 'Non-partisan · lawful · grounded in Article 19.',
    url: 'indiatechcollective.org',
  }, 1080, 1080);

  // the landing page's og:image points at /og-card.png — keep it in sync
  writeFileSync('public/og-card.png', readFileSync(`${OUT}/card-1080.png`));

  await render('card-politicians.png', {
    kicker: 'PART II — POLITICIAN CASES',
    headline: `${withCases.value.toFixed(0)}% of Lok Sabha winners declared criminal cases`,
    stat: { value: `${withCases.numerator}/${withCases.denominator}`, label: 'winners of the 2024 general election (people, not cases)' },
    definition: withCases.definition,
    asOf, source: 'ADR/NEW analysis of ECI affidavits', disclaimer: DISCLAIMER,
    url: 'indiatechcollective.org/politicians',
  }, 1080, 1080);

  await render('card-corruption-enforcement.png', {
    kicker: 'PART III — STATE ENFORCEMENT',
    headline: 'PC Act cases: registered, chargesheeted, tried, convicted',
    stat: { value: String(reg ?? '—'), label: `cases registered across India in ${stats.dataYear} (NCRB)` },
    definition: 'Reported enforcement activity under the Prevention of Corruption Act — not a corruption level.',
    asOf: stats.dataAsOf, source: `NCRB Crime in India ${stats.dataYear} (GODL)`, disclaimer: 'States should not be compared on raw counts alone.',
    url: 'indiatechcollective.org/corruption',
  }, 1080, 1080);

  // per-profile OGs
  let count = 0;
  for (const p of full.profiles) {
    const spec: CardSpec = {
      kicker: 'PART II — POLITICIAN CASES',
      headline: p.name,
      stat: {
        value: p.declaredCases === null ? '—' : String(p.declaredCases),
        label: `criminal case(s) self-declared in the 2024 election affidavit · ${p.partyShort} · ${p.constituency}, ${p.stateName}`,
      },
      definition: p.convictionsDeclared ? `Includes ${p.convictionsDeclared} disclosed conviction(s), shown separately as declared.` : 'No conviction disclosed in the affidavit digest.',
      asOf, source: 'ADR/NEW digest of ECI affidavits · machine-checked', disclaimer: DISCLAIMER,
      url: `indiatechcollective.org/politicians/${p.slug}`,
    };
    await render(`profiles/${p.slug}.png`, spec, 1200, 630);
    count += 1;
  }

  writeFileSync(stampFile, stamp);
  log('og', `rendered ${count + 8} images into ${OUT}/`);
}

main().catch((e) => {
  console.error('[og] FAILED:', e);
  process.exit(1);
});
