import { readFileSync, existsSync } from 'node:fs';

/**
 * The ONLY place data paths resolve. Build-time only (Astro pages/endpoints);
 * client islands fetch the /data/*.json endpoints these files feed.
 *
 * DATA_MODE=demo swaps in clearly-labelled fixtures for UI development and
 * tests. Production artifacts live in data/generated/ and are verified by
 * scripts/data-check.ts before any build.
 */
export const DATA_MODE = process.env.DATA_MODE === 'demo' ? 'demo' : 'production';
export const isDemo = DATA_MODE === 'demo';

const SITE_DIR = isDemo ? 'tests/fixtures/generated/site' : 'data/generated/site';
const GEN_DIR = isDemo ? 'tests/fixtures/generated' : 'data/generated';

export type ArtifactName =
  | 'politicians.index'
  | 'kpis'
  | 'coverage'
  | 'corruption.stats'
  | 'corruption.disclosures'
  | 'sources';

export function loadArtifact<T = unknown>(name: ArtifactName): T {
  return JSON.parse(readFileSync(`${SITE_DIR}/${name}.json`, 'utf8')) as T;
}

export function loadFullProfiles<T = unknown>(): T {
  return JSON.parse(readFileSync(`${GEN_DIR}/politicians.full.json`, 'utf8')) as T;
}

export function loadBuildInfo<T = unknown>(): T {
  return JSON.parse(readFileSync(`${GEN_DIR}/build-info.json`, 'utf8')) as T;
}

export function loadDataQuality<T = unknown>(): T | null {
  const p = `${GEN_DIR}/data-quality-report.json`;
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
}

export function loadCurated<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(`data/curated/${name}.json`, 'utf8')) as T;
}
