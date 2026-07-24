# Methodology (maintainer copy)

The public, always-current explanation lives at `/methodology/` on the site
(`src/pages/methodology.astro`) — that page is the canonical text for readers.
This file records the parts maintainers need beyond the public page.

## Units

- **Representative rows are seat-winners** for the given election (matching the source
  report's unit): a person who won two seats appears once per seat. Cross-election /
  cross-house person identity is out of scope until human-reviewed.
- “People” metrics count distinct rows in the cohort; one row with N cases counts once.
- “Total declared cases” counts declaration rows as parsed; it is not a count of unique
  court cases (the same underlying case can appear in two co-accused winners' affidavits).

## Reconciliation gates (fail the build)

- ADR extraction: winners == 543 with unique serials; case blocks == printed 251;
  serious flags == printed 170; blocks with convictions == printed 27 == convicted
  table rows; per-block parsed entries == printed Total Cases (0 mismatches currently);
  extracted party seat totals == the report's printed party anchors.
- Join: OGD 542 rows ↔ ADR 543 with exactly `GJ-surat` ADR-only; PC-name spelling
  variants resolve only via the reviewed `pc-name-overrides.json`.
- NCRB: 36 states/UTs per table; sum(states) == printed All-India for every count column;
  `NA` rates stay null.

## Metric formulas

Displayed definitions are code (`src/lib/metrics/registry.ts`) and are rendered on the
methodology page from the same constant — edit there, never in copy.

```
representatives_with_pending_cases_pct =
  covered reps declaring ≥1 pending case ÷ covered reps with affidavit-derived data
representatives_with_convictions = covered reps with ≥1 disclosed conviction (count)
party_corruption_disclosure = people with ≥1 case where corruptionQualification == "yes"
  (rule ids recorded per case; PC Act 1988/1947 only)
NCRB rates = NCRB's own published columns (formula in the column heading); never computed here
```

## Statute rules

`data/curated/statute-dictionary.json` (aliases; IPC↔BNS crosswalk display-only,
per-pair review status) and `data/curated/corruption-qualification-rules.json`
(qualifying: PC Act 1988 + 1947; explicitly-not-auto: PMLA, IPC 415–420, 405–409,
171B/171E, BNS 316/318; unmapped ⇒ needs_review; other mapped offences ⇒ no).
Every case stores the rule id that produced its qualification.

## Review ladder

`unreviewed → machine_checked → human_verified` (or `rejected`). Only
machine_checked/human_verified render. This release: everything machine_checked,
nothing human_verified; profiles with adverse records are `noindex` until verified.
The first human-review pass should start with: the 27 disclosed convictions, the
20 PC Act-qualifying records, and the needs_review stack.
