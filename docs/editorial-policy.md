# Editorial policy

## What this site is

A non-partisan re-publication of **official disclosures**: sworn election affidavits
(as digested by a cited published analysis), national crime statistics, and audit
reports. The site adds structure, definitions and provenance — never allegations.

## Hard rules

1. **Presumption of innocence, everywhere.** A declared case is an accusation. The words
   “criminal”, “guilty”, “corrupt” are never applied to a person. Disclosed convictions
   are shown separately, as declared, with appeal status where stated.
2. **Every adverse claim carries**: ≥1 source id, a status-as-of date, a procedural
   stage as declared, and a review state (`machine_checked` minimum). The build fails
   otherwise (`scripts/data-check.ts`).
3. **No composite scores.** No “corruption index”, “criminality score”, “danger rating”
   or ranking that mixes datasets. Enforcement stats, disclosures and audits stay in
   separate lenses with separate units.
4. **Denominators are visible** on every chart, KPI and share card. Small samples
   (party n<5) are shown but never ranked.
5. **Party neutrality**: no party colors on data marks; identity is textual;
   `party_at_election` never silently becomes “current party”.
6. **No guilt-signalling visuals**: no police tape, mugshots, handcuffs, prison bars,
   blood-red backdrops; no AI-generated images of politicians; no photos at all until a
   licensed, neutral source is established.
7. **Share cards never say more than the page**: each carries the definition,
   numerator/denominator, as-of date, source and the presumption-of-innocence line.
8. **Missing data is missing** — rendered as “—”/“not published”, excluded from
   denominators, listed on /coverage/. Never zero-filled, never imputed.
9. **Right of reply**: any named person can trigger the corrections process
   (`/corrections/`); materially adverse changes require human review before publication.

## Legal context (guardrails, not advice)

Considered while writing copy and policy: Bharatiya Nyaya Sanhita 2023 s.356
(defamation) — truth for public good and fair reporting of public documents are the
operative frames; Digital Personal Data Protection Act 2023 — the site processes
publicly-mandated disclosures of public figures, minimizes fields, and publishes no
private contact or financial detail beyond the official disclosures themselves;
ECI directions on criminal-antecedent publicity, which make these disclosures
intentionally public.

## Launch checklist

- [x] Every adverse record sourced, dated, review-stated (build-enforced)
- [x] Methodology, sources, coverage, corrections pages live
- [x] Correction/right-of-reply channel live (GitHub template; no invented email)
- [x] noindex on profiles with adverse records until human-verified
- [ ] Human review pass over convictions, PC Act records, needs_review stack
- [ ] **Pre-publication review by an Indian lawyer — NOT yet done. Required before
      promoting the dashboards publicly. Code review does not satisfy this.**
