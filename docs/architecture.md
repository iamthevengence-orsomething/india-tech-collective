# Architecture

## Decision

The repository was a single self-contained `index.html`. It is now an **Astro 7 (static output) + TypeScript** site with **React islands** for the interactive dashboard parts only. The landing page is a manifesto in the style of a constitutional preamble; the toolkit, politician-cases and corruption dashboards are its Parts I–III. Rationale:

- Static-first: 543 representative profiles, dashboards and content pages are generated at build time; direct URLs and refresh work on any static host (Vercel auto-detects Astro).
- Islands keep initial JS lean — only filter/chart/table components hydrate; the manifesto and toolkit pages ship with no framework JS at all.
- No component library. The design system (`src/styles/tokens.css`) is a constitution-manuscript register: cream paper, warm ink, antique-gold rules; EB Garamond for voice and Geist Mono for data, both self-hosted via `@fontsource-variable`. No gradients, glassmorphism or party colours anywhere.
- Charts are hand-built React/SVG + CSS (bar lists, tile cartogram, static SVG trend) — no chart library. The categorical palette was validated for CVD safety against the dark surface (see `tokens.css` comments).
- Zod schemas (`src/lib/schemas/`) are the single contract shared by the data pipeline, the build gate, the pages and the tests.

## Layout

```
src/
  pages/            index (landing), politicians/{index,[slug]}, corruption,
                    coverage, methodology, sources, corrections, 404,
                    data/*.json.ts (mode-aware artifact endpoints)
  layouts/Base.astro
  components/       Astro shell components + charts/ (React) + islands/ (React)
  lib/              schemas/ (Zod), metrics/ (pure functions + registry),
                    statutes.ts, gates.ts, slug.ts, csv.ts, format.ts,
                    url-state.ts, share.ts, data.ts (the ONLY data-path resolver)
  styles/           tokens.css, global.css
scripts/            data-fetch/normalize/validate/build/check, og-generate,
                    csp-hashes, screenshots + lib/ + py/ (pdfplumber extractors)
data/
  raw/              immutable downloads + manifest.json (checksums)
  work/             intermediate (gitignored)
  curated/          reviewed inputs: states, parties, expected seats, statute
                    dictionary, qualification rules, sources registry,
                    pc-name overrides, CAG metadata, corrections log
  generated/        deterministic outputs incl. site/ artifacts, full profiles,
                    build-info, validation + data-quality reports
tests/              unit/ (Vitest), e2e/ (Playwright), fixtures/ (demo data)
assets/og-fonts/    OFL fonts (variable + static instances) for satori
public/             favicon, robots, downloads/ (CSV/JSON), og/ (generated)
```

## Data flow

```
sources ──fetch──► data/raw (checksummed, immutable)
        ──normalize──► data/work (+ Python extractors for PDFs)
        ──validate──► reconciliation gates (exit 1 on any error)
        ──build──► data/generated/site/*.json + politicians.full.json
                   + downloads + build-info + data-quality report
        ──check──► the honesty gate (first step of `npm run build`)
astro build ──► dist/ (pages + /data/*.json endpoints + og images)
```

`DATA_MODE=demo` swaps `src/lib/data.ts` onto `tests/fixtures/generated/` — fixtures
carry `"fixture": true` markers that `data:check` refuses in production artifacts.

## Determinism

Stable ids derive from source facts (`scripts/lib/ids.ts`); artifacts are canonical
JSON (sorted keys/arrays); `datasetVersion` is a hash over all site artifacts;
`build-info.json`, the raw manifest and `pipeline-runs.jsonl` are the only places
wall-clock time exists and are excluded from the hash. OG images regenerate only
when `datasetVersion` changes.

## Quality gates

`npm run build` = `data:check` → `og:generate` → `astro build` → `csp-hashes --verify`.
Vitest covers schemas/metrics/gates/statutes/slug/CSV; Playwright covers routes,
filters, URL state, downloads, a11y (axe) on key pages, and the demo build.
ESLint/Prettier are intentionally omitted; `astro check`, strict TS and the test
suites are the quality bar (time-boxed decision, revisit freely).
