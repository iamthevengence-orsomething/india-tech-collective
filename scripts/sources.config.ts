/**
 * Fetch descriptors for scripts/data-fetch.ts. Every descriptor's sourceId must
 * exist in data/curated/sources.json (the human-reviewed registry).
 *
 * kinds:
 *  - file:          direct download, cached by existence + checksum
 *  - ogd-datastore: api.data.gov.in paged JSON (pages stored verbatim as raw)
 */

export interface FetchDescriptor {
  sourceId: string;
  kind: 'file' | 'ogd-datastore';
  /** file: URL. ogd-datastore: resource UUID. */
  target: string;
  filename?: string;
  maxBytes?: number;
  /** datastore sanity check: expected total records (fetch fails loudly on drift) */
  expectTotal?: number;
  notes?: string;
}

export const OGD_API_BASE = 'https://api.data.gov.in/resource/';

/**
 * data.gov.in's documented public sample key (published in their API docs for
 * evaluation use; capped at 10 records/request). For production refreshes,
 * register a personal key and set OGD_API_KEY — see docs/runbook.md.
 */
export const OGD_API_KEY =
  process.env.OGD_API_KEY ?? '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

export const FETCH_SOURCES: FetchDescriptor[] = [
  {
    sourceId: 'adr-ls2024-report',
    kind: 'file',
    target:
      'https://adrindia.org/sites/default/files/Lok_Sabha_Elections_2024_Criminal_and_Financial_background_details_of_Winning_Candidates_Finalver_English%20%281%29.pdf',
    filename: 'report.pdf',
    maxBytes: 50 * 1024 * 1024,
    notes: 'Single retrieval of a published report; cached thereafter. Citation-based use per ADR terms.',
  },
  {
    sourceId: 'ogd-ls2024-winners',
    kind: 'ogd-datastore',
    target: '194d454f-3ea8-4621-a915-b211c66e46a7',
    expectTotal: 542,
    notes:
      'State/UT-wise List of Successful Candidate during 2024. 542 rows (Surat PC-24 excluded by the source due to an uncontested election). Winner/runner-up party columns are corrupted in the datastore copy (duplicate column names collapsed at ingestion) — winner name/constituency/state are used; party attribution comes from adr-ls2024-report and is reconciled against its printed party table.',
  },
  {
    sourceId: 'ogd-ncrb-pca-registered-2023',
    kind: 'file',
    target: 'https://www.data.gov.in/files/ogdpv2dms/s3fs-public/NCRB_CII_2023_Table_8C.2_0.csv',
    filename: 'NCRB_CII_2023_Table_8C.2.csv',
    maxBytes: 5 * 1024 * 1024,
    notes: 'PC Act cases registered by ACB/Vigilance during 2023, by type (trap/DA/criminal misconduct/others).',
  },
  {
    sourceId: 'ogd-ncrb-police-disposal-2023',
    kind: 'file',
    target: 'https://www.data.gov.in/files/ogdpv2dms/s3fs-public/NCRB_CII_2023_Table_8C.3_0.csv',
    filename: 'NCRB_CII_2023_Table_8C.3.csv',
    maxBytes: 5 * 1024 * 1024,
    notes: 'Police disposal of ACB/Vigilance/Lokayukta PC Act cases during 2023.',
  },
  {
    sourceId: 'ogd-ncrb-court-disposal-2023',
    kind: 'file',
    target: 'https://www.data.gov.in/files/ogdpv2dms/s3fs-public/NCRB_CII_2023_Table_8C.4_0.csv',
    filename: 'NCRB_CII_2023_Table_8C.4.csv',
    maxBytes: 5 * 1024 * 1024,
    notes: 'Court disposal of ACB/Vigilance/Lokayukta PC Act cases during 2023.',
  },
];
