/**
 * Display definitions for every metric. These strings appear verbatim in metric
 * captions, tooltips, downloads, and share cards — keep them precise and honest.
 */

interface MetricDef {
  label: string;
  unit: 'people' | 'declaration-rows' | 'cases-as-reported' | 'percent' | 'seats';
  definition: string;
}

export const METRIC_DEFS = {
  reps_covered: {
    label: 'Representatives covered',
    unit: 'people',
    definition:
      'Elected representatives in this cohort with affidavit-derived case data (parsed case rows or a cited published summary), out of expected seats.',
  },
  reps_with_declared_cases_pct: {
    label: 'Declared ≥1 criminal case',
    unit: 'percent',
    definition:
      'Covered representatives who declared one or more criminal cases in their election affidavit ÷ covered representatives. Counts people, not cases. A declared case is an accusation, not a conviction.',
  },
  reps_with_serious_cases_pct: {
    label: 'Declared ≥1 serious case',
    unit: 'percent',
    definition:
      "Covered representatives with one or more 'serious' declared cases ÷ covered representatives with serious-case data, using the source report's own definition of serious (quoted on the methodology page).",
  },
  reps_with_convictions: {
    label: 'Declared a conviction',
    unit: 'people',
    definition:
      'Covered representatives whose affidavit-derived records disclose at least one conviction. Null when no conviction-level data has been imported for this cohort.',
  },
  total_declared_cases: {
    label: 'Total declared cases',
    unit: 'declaration-rows',
    definition:
      'Sum of declared-case counts across covered representatives, as counted by the underlying source. One person may account for several cases; do not read this as unique court cases.',
  },
  affidavits_linked: {
    label: 'Affidavit records linked',
    unit: 'people',
    definition:
      'Representatives whose profile links affidavit-derived data (parsed rows or published summary), out of all representatives identified in the cohort.',
  },
  coverage_pct: {
    label: 'Coverage',
    unit: 'percent',
    definition:
      'Covered representatives ÷ expected seats for this cohort. Anything below 100% is listed on the coverage page with reasons.',
  },
} as const satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRIC_DEFS;
