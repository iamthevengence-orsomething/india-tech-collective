# Runbook

## Prerequisites

- Node ≥ 22, npm. `npm install`.
- Python venv for PDF extraction: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
- Optional: `OGD_API_KEY` env var (personal data.gov.in key; the documented public
  sample key works but caps pages at 10 records).

## Everyday commands

```bash
npm run dev              # local dev server
npm run data:all         # fetch → normalize → validate → build → check
npm run build            # data:check + og:generate + astro build + csp verify
npm run build:demo       # fixture build into dist-demo (DEMO banner, noindex)
npm test                 # Vitest unit/data tests
npm run test:e2e         # Playwright (uses pre-staged Chromium if present)
npm run screenshots      # capture key routes at 3 viewports into screenshots/
```

The pipeline is cache-friendly: raw files re-download only with
`tsx scripts/data-fetch.ts --force=<sourceId>`; the ADR extraction re-runs only when
the PDF checksum or the extractor changes; OG images re-render only when
`datasetVersion` changes.

## Deploying (Vercel)

Framework preset: **Astro** (auto-detected). Build command `npm run build`, output
`dist/`. `vercel.json` ships security headers; keep the CSP hashes in sync by
letting the build's `csp-hashes --verify` step pass. Python is NOT needed on Vercel
as long as `data/work/adr-extract.json` cache and generated artifacts are committed
(they are) — the fetch/extract steps only run when you refresh data locally.

## Updating data

- **New NCRB year**: add the three resource descriptors in `scripts/sources.config.ts`,
  extend the artifact to carry multiple years, run `npm run data:all`, review the
  validation report, commit raw+generated together.
- **By-elections / vacancies / party changes**: create curated membership-status
  records with a primary source and statusAsOf; extend data-build to overlay them;
  until then the site says statuses are election-day results (by design).
- **Affidavit PDFs**: when lawful access to affidavit.eci.gov.in works, store PDFs
  under `data/raw/_large/` (gitignored, manifest-tracked), parse into case rows with
  page refs, and lift the corresponding coverage fallback.
- **New election cohort**: new election record + fetch descriptors + extractor +
  cohort artifacts; never merge cohorts silently.
- **Corrections**: see `docs/corrections-policy.md`.

## Scheduled updates (future workflow)

Only sources whose terms allow automation may be scheduled (the GODL OGD/NCRB
files qualify; ADR/MyNeta and affidavit.eci.gov.in do NOT). A scheduled job should:
fetch permitted sources → verify checksums/schemas → generate a change report →
**open a PR** (never auto-publish) → CI runs tests/build; a human merges. Materially
adverse changes must sit behind the review gate regardless of automation.

## Incidents

- Build fails at `data:check`: read the printed violations — that gate exists to stop
  the deploy; do not bypass it.
- Upstream file changed shape: fetch refuses to overwrite raw; inspect, then
  `--force=<id>` re-fetch, fix the normalizer, and reconcile gates before shipping.
- Disk/space or proxy issues in CI: all fetches are cached in-repo; a network-free
  rebuild (`npm run build`) works from committed artifacts alone.
