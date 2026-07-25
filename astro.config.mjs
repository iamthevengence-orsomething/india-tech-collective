import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Profiles carrying adverse machine-checked records are noindexed until
// human-verified; keep them out of the sitemap with the same predicate the
// profile page uses.
const isDemo = process.env.DATA_MODE === 'demo';
const fullPath = isDemo ? 'tests/fixtures/generated/politicians.full.json' : 'data/generated/politicians.full.json';
const noindexSlugs = new Set(
  JSON.parse(readFileSync(fullPath, 'utf8'))
    .profiles.filter((p) => (p.declaredCases ?? 0) > 0 && p.reviewStatus !== 'human_verified')
    .map((p) => `/politicians/${p.slug}/`)
);

// https://astro.build/config
export default defineConfig({
  site: 'https://www.indiatechcollective.org',
  trailingSlash: 'ignore',
  redirects: {
    '/tools': '/toolkit/',
    '/record': '/politicians/',
    '/record/find': '/politicians/',
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !noindexSlugs.has(path) && path !== '/404/';
      },
    }),
  ],
});
