/**
 * screenshots — visual QA captures of the production build at the three
 * review viewports (360×800, 768×1024, 1440×900). Serves dist/ locally and
 * writes PNGs into screenshots/ (gitignored).
 *
 * Usage: npm run build && npm run screenshots [-- --only=politicians]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const OUT = 'screenshots';
const PORT = 4339;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

interface Shot { name: string; path: string; fullPage?: boolean; scrollTo?: number; readySelector?: string }
const SHOTS: Shot[] = [
  { name: 'landing', path: '/', fullPage: true },
  { name: 'toolkit', path: '/toolkit/', fullPage: true },
  { name: 'politicians', path: '/politicians/', fullPage: true, readySelector: '.bar-list' },
  { name: 'politicians-filtered', path: '/politicians/?state=KL&cases=with', readySelector: 'table.data tbody tr' },
  { name: 'profile-cases', path: '/politicians/adv-dean-kuriakose-idukki/', scrollTo: 0 },
  { name: 'profile-case-cards', path: '/politicians/adv-dean-kuriakose-idukki/', scrollTo: 1500 },
  { name: 'corruption', path: '/corruption/', fullPage: true, readySelector: '.bar-list' },
  { name: 'coverage', path: '/coverage/', fullPage: true },
  { name: 'methodology', path: '/methodology/', scrollTo: 0 },
  { name: 'sources', path: '/sources/', scrollTo: 0 },
  { name: 'corrections', path: '/corrections/', scrollTo: 0 },
  { name: '404', path: '/politicians/definitely-not-real/', scrollTo: 0 },
];
const VIEWPORTS = [
  { tag: 'mobile-360', width: 360, height: 800 },
  { tag: 'tablet-768', width: 768, height: 1024 },
  { tag: 'desktop-1440', width: 1440, height: 900 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = spawn('node', ['scripts/serve-dir.mjs', 'dist', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const staged = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(existsSync(staged) ? { executablePath: staged } : {});
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      for (const shot of SHOTS) {
        if (only && !shot.name.includes(only)) continue;
        // full-page captures only at desktop; viewport crops elsewhere
        const fullPage = Boolean(shot.fullPage) && vp.tag === 'desktop-1440';
        await page.goto(`http://127.0.0.1:${PORT}${shot.path}`, { waitUntil: 'networkidle', timeout: 45000 });
        if (shot.readySelector) await page.waitForSelector(shot.readySelector, { timeout: 20000 }).catch(() => {});
        if (shot.scrollTo) await page.evaluate((y) => window.scrollTo(0, y), shot.scrollTo);
        await page.waitForTimeout(650);
        await page.screenshot({ path: `${OUT}/${shot.name}--${vp.tag}.png`, fullPage });
        console.log(`[shot] ${shot.name} @ ${vp.tag}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGKILL');
  }
  console.log(`[shot] done → ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
