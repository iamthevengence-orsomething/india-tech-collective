# Data sources — acquisition record

Authoritative registry: `data/curated/sources.json` (published at `/sources/` and `/data/sources.json`).
Raw checksums: `data/raw/manifest.json`. This file records the acquisition story and the terms reasoning.

## Used in this release

| Source | How obtained | Licence/terms | Notes |
|---|---|---|---|
| OGD “State/UT-wise List of Successful Candidate during 2024” | data.gov.in datastore API, paged (documented public sample key; set `OGD_API_KEY` for a personal key) | GODL – India | 542 rows; Surat uncontested seat absent at source. **Winner/runner-up party columns are corrupted in the portal's datastore copy** (duplicate column names collapsed at their ingestion) — names/constituencies/states used; party not used. |
| ADR/NEW “Lok Sabha Elections 2024 … Winning Candidates” report (PDF, 6 Jun 2024) | Single HTTP download of the published report; cached by checksum | ADR terms: free for non-commercial information dissemination **with citation**; systematic/automated collection prohibited | We downloaded one published report once and extracted its printed tables — no crawling of MyNeta/ADR pages. Extraction is validated against the report's own printed totals (543/251/170/27 and the party-wise seat table) and fails the build on any mismatch. |
| NCRB Crime in India 2023, tables 8C.2–8C.4 | Direct CSV downloads from data.gov.in file storage | GODL – India | Data year 2023; published later — the UI shows both. The host 403s custom user-agents; the fetcher retries once with a generic client string (documented, no auth/CAPTCHA involved). |
| CAG audit-report listing | Single HTML fetch of the public listing | Public portal | Metadata (titles/links) only; findings are NOT extracted yet — audit lens ships as pipeline-in-review. |

## Attempted and honestly failed (recorded as fallbacks)

- **affidavit.eci.gov.in** — HTTP 403 to automated access (curl and a normal headless browser). No WAF/CAPTCHA bypass was attempted. Consequence: primary Form 26 PDFs are not linked per representative yet; case data derives from the ADR digest and says so on every profile.
- **OGD flat files for election results** (`4_List_of_Successful_Candidate.csv` etc.) — 403 for these specific paths while other files on the same host download fine.
- **ECI statistical-report file endpoints** — the SPA's hardcoded file paths 404; no stable API discovered lawfully.
- **Survey of India boundary products / Bharatmaps / mapservice.gov.in** — unreachable or unverifiable from the build environment; no boundary file shipped (tile grid instead).

## Rules the pipeline enforces

1. Raw downloads are immutable (`--force=<sourceId>` required to re-fetch a changed file).
2. Every stored byte is checksummed into the manifest with retrieval time and HTTP status.
3. Polite client: identified UA, ≥2s spacing, no parallel hammering, 403s are never retried in a loop.
4. No MyNeta/ADR scraping; no eCourts access; OCR output would be review-gated (no OCR used this release).
5. Fixtures live under `tests/` only; `data:check` fails production artifacts containing fixture markers.
