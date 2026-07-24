import { test, expect } from '@playwright/test';

test.describe('trust pages', () => {
  test('/coverage shows the full matrix, gaps and fallbacks', async ({ page }) => {
    await page.goto('/coverage/');
    await expect(page.getByRole('row', { name: /Lok Sabha — 18th/ })).toContainText('543');
    expect(await page.locator('table.data').nth(1).locator('tbody tr').count()).toBe(31); // all assemblies
    await expect(page.getByText('Active fallbacks')).toBeVisible();
    await expect(page.getByText(/affidavit\.eci\.gov\.in returns HTTP 403/)).toBeVisible();
    await expect(page.getByText('All gates passed')).toBeVisible();
  });

  test('/methodology defines metrics from the code registry', async ({ page }) => {
    await page.goto('/methodology/');
    await expect(page.getByText('reps_with_declared_cases_pct')).toBeVisible();
    await expect(page.getByText('Why there is no corruption score')).toBeVisible();
    await expect(page.getByText(/never auto-classified/).first()).toBeVisible();
    await expect(page.getByText(/presumed innocent|Presumption of innocence/).first()).toBeVisible();
  });

  test('/sources lists the registry with licences; machine copy exists', async ({ page, request }) => {
    await page.goto('/sources/');
    expect(await page.locator('table.data tbody tr').count()).toBeGreaterThanOrEqual(15);
    await expect(page.getByText('Government Open Data License', { exact: false }).first()).toBeVisible();
    const machine = await request.get('/data/sources.json');
    expect(machine.status()).toBe(200);
    expect((await machine.json()).sources.length).toBeGreaterThanOrEqual(15);
  });

  test('/corrections has the flow, warning and empty log', async ({ page }) => {
    await page.goto('/corrections/');
    await expect(page.getByText('Do not post private personal data')).toBeVisible();
    await expect(page.locator('a[href*="correction-request.yml"]')).toBeVisible();
    await expect(page.getByText('No corrections yet.')).toBeVisible();
  });

  test('unknown URLs get the 404 page', async ({ page }) => {
    const resp = await page.goto('/politicians/not-a-real-person-xyz/');
    expect(resp!.status()).toBe(404);
    await expect(page.getByText('This page isn’t on the record.')).toBeVisible();
  });

  test('robots and sitemap exist; sitemap omits noindexed adverse profiles', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Sitemap:');
    const sitemap = await request.get('/sitemap-0.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('/politicians/');
    expect(xml).not.toContain('adv-dean-kuriakose-idukki'); // adverse machine-checked → excluded
  });
});
