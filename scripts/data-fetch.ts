/**
 * data:fetch — download configured sources into data/raw/ (immutable cache).
 *
 * Rules: raw files are never overwritten (a changed upstream file requires
 * --force <sourceId>); requests are polite (UA, spacing, no 403 hammering);
 * every stored byte is checksummed into data/raw/manifest.json.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FETCH_SOURCES, OGD_API_BASE, OGD_API_KEY, type FetchDescriptor } from './sources.config';
import { politeFetch } from './lib/http';
import { canonicalJson, log, nowIso, sha256, sha256File } from './lib/util';

interface ManifestEntry {
  sourceId: string;
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  contentType?: string;
  httpStatus?: number;
  retrievedAt: string;
  cached: boolean;
  notes?: string;
}

const RAW = 'data/raw';
const force = new Set(process.argv.filter((a) => a.startsWith('--force=')).map((a) => a.slice('--force='.length)));
const manifest: ManifestEntry[] = [];

async function fetchFile(d: FetchDescriptor): Promise<void> {
  const dir = join(RAW, d.sourceId);
  const path = join(dir, d.filename ?? 'download');
  if (existsSync(path) && !force.has(d.sourceId)) {
    manifest.push({
      sourceId: d.sourceId,
      file: path,
      url: d.target,
      sha256: sha256File(path),
      bytes: statSync(path).size,
      retrievedAt: nowIso(),
      cached: true,
      notes: d.notes,
    });
    log('fetch', `${d.sourceId}: cached (${path})`);
    return;
  }
  const res = await politeFetch(d.target, { maxBytes: d.maxBytes });
  if (res.status !== 200) {
    throw new Error(`${d.sourceId}: HTTP ${res.status} for ${d.target} (policy denials are not retried — see data-quality report)`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, res.body);
  manifest.push({
    sourceId: d.sourceId,
    file: path,
    url: d.target,
    sha256: sha256(res.body),
    bytes: res.body.length,
    contentType: res.contentType,
    httpStatus: res.status,
    retrievedAt: nowIso(),
    cached: false,
    notes: d.notes,
  });
  log('fetch', `${d.sourceId}: downloaded ${res.body.length} bytes`);
}

async function fetchDatastore(d: FetchDescriptor): Promise<void> {
  const dir = join(RAW, d.sourceId);
  mkdirSync(dir, { recursive: true });
  const existing = readdirSync(dir).filter((f) => f.startsWith('page-')).sort();
  if (existing.length > 0 && !force.has(d.sourceId)) {
    for (const f of existing) {
      const path = join(dir, f);
      manifest.push({
        sourceId: d.sourceId,
        file: path,
        url: `${OGD_API_BASE}${d.target}`,
        sha256: sha256File(path),
        bytes: statSync(path).size,
        retrievedAt: nowIso(),
        cached: true,
      });
    }
    log('fetch', `${d.sourceId}: cached (${existing.length} pages)`);
    return;
  }
  let offset = 0;
  let total = Infinity;
  let pages = 0;
  while (offset < total) {
    const url = `${OGD_API_BASE}${d.target}?api-key=${OGD_API_KEY}&format=json&limit=10&offset=${offset}`;
    const res = await politeFetch(url, { accept: 'application/json' });
    if (res.status !== 200) throw new Error(`${d.sourceId}: HTTP ${res.status} at offset ${offset}`);
    const parsed = JSON.parse(res.body.toString('utf8')) as { total: number; count: number };
    if (!Number.isFinite(parsed.total)) throw new Error(`${d.sourceId}: malformed datastore response at offset ${offset}`);
    total = parsed.total;
    const path = join(dir, `page-${String(offset).padStart(5, '0')}.json`);
    writeFileSync(path, res.body);
    manifest.push({
      sourceId: d.sourceId,
      file: path,
      url: url.replace(OGD_API_KEY, 'API_KEY'),
      sha256: sha256(res.body),
      bytes: res.body.length,
      contentType: res.contentType,
      httpStatus: res.status,
      retrievedAt: nowIso(),
      cached: false,
    });
    pages += 1;
    offset += parsed.count;
    if (parsed.count === 0) break;
  }
  if (d.expectTotal !== undefined && total !== d.expectTotal) {
    throw new Error(`${d.sourceId}: datastore total ${total} != expected ${d.expectTotal}`);
  }
  log('fetch', `${d.sourceId}: ${pages} pages, total ${total}`);
}

async function main() {
  for (const d of FETCH_SOURCES) {
    if (d.kind === 'file') await fetchFile(d);
    else await fetchDatastore(d);
  }
  manifest.sort((a, b) => (a.file < b.file ? -1 : 1));
  writeFileSync(join(RAW, 'manifest.json'), canonicalJson(manifest));
  log('fetch', `manifest written: ${manifest.length} files`);
}

main().catch((err) => {
  console.error('[fetch] FAILED:', err.message ?? err);
  process.exit(1);
});
