/**
 * csp-hashes — maintain the hash-based Content-Security-Policy in vercel.json.
 * Scans every built HTML file for inline scripts, computes sha256 hashes, and
 * writes (default) or verifies (--verify, used in `npm run build`) the header.
 * A drifted CSP fails the build rather than silently breaking pages in prod.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const VERCEL = 'vercel.json';
const verify = process.argv.includes('--verify');

function* htmlFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

const hashes = new Set<string>();
let scanned = 0;
for (const file of htmlFiles(DIST)) {
  scanned += 1;
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim().length === 0) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
}
if (hashes.size === 0) {
  console.error('[csp] no inline scripts found — is dist/ built?');
  process.exit(1);
}
if (hashes.size > 24) {
  console.error(`[csp] ${hashes.size} distinct inline scripts — unexpected growth; investigate before shipping`);
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const config = JSON.parse(readFileSync(VERCEL, 'utf8'));
const all = config.headers.find((h: any) => h.source === '/(.*)');
const existing = all.headers.find((h: any) => h.key === 'Content-Security-Policy');

if (verify) {
  if (!existing || existing.value !== csp) {
    console.error('[csp] vercel.json CSP is out of date. Run: tsx scripts/csp-hashes.ts');
    console.error('[csp] expected:', csp.slice(0, 200) + '…');
    process.exit(1);
  }
  console.log(`[csp] verified — ${hashes.size} inline-script hashes across ${scanned} pages`);
} else {
  if (existing) existing.value = csp;
  else all.headers.push({ key: 'Content-Security-Policy', value: csp });
  writeFileSync(VERCEL, JSON.stringify(config, null, 2) + '\n');
  console.log(`[csp] wrote ${hashes.size} inline-script hashes (from ${scanned} pages) into vercel.json`);
}
