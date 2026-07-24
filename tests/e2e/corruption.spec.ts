import { test, expect } from '@playwright/test';

test.describe('/corruption three lenses', () => {
  test('caveat banner precedes every ranking; lenses are separated', async ({ page }) => {
    await page.goto('/corruption/');
    await expect(page.locator('h1')).toContainText('without a fake score');
    // DOM order: the enforcement caveat sits ABOVE the enforcement bar list
    const enforcement = page.locator('#enforcement');
    const banner = enforcement.locator('.banner-caveat');
    await expect(banner).toContainText('not a corruption level');
    const bars = enforcement.locator('.bar-list');
    await expect(bars).toBeVisible({ timeout: 15000 });
    const bannerBox = await banner.boundingBox();
    const barsBox = await bars.boundingBox();
    expect(bannerBox!.y).toBeLessThan(barsBox!.y);
    // sub-navigation exists
    await expect(page.locator('.subnav a[href="#disclosures"]')).toBeVisible();
  });

  test('enforcement lens: real NCRB values, measure switch, compare, table twin', async ({ page }) => {
    await page.goto('/corruption/');
    const enforcement = page.locator('#enforcement');
    await expect(enforcement.getByText('All-India:')).toContainText('4,069', { timeout: 15000 });
    // switch measure to an NCRB-published rate
    await enforcement.locator('#enf-metric').selectOption('crt_conviction_rate');
    await expect(enforcement.locator('.result-note')).toContainText(/Conviction Rate/i);
    expect(page.url()).toContain('metric=crt_conviction_rate');
    // 'not published' rendered for NA states, never zero
    await expect(enforcement.getByText('not published').first()).toBeVisible();
    // full table twin
    await enforcement.getByRole('button', { name: /Show full table/ }).click();
    await expect(enforcement.locator('table.data').first()).toBeVisible();
    // compare two states
    await enforcement.getByLabel('Comparison state 1').selectOption('MH');
    await enforcement.getByLabel('Comparison state 2').selectOption('KL');
    await expect(enforcement.locator('table.data', { hasText: 'Measure (2023)' })).toBeVisible();
  });

  test('disclosures lens: suppression works and cohort is explicit', async ({ page }) => {
    await page.goto('/corruption/');
    const lens = page.locator('#disclosures');
    await expect(lens.getByText('18th Lok Sabha — winners of the 2024 general election').first()).toBeVisible({ timeout: 15000 });
    await expect(lens.locator('.chip', { hasText: 'small sample' }).first()).toBeVisible();
    await expect(lens.getByText('Declared a PC Act case')).toBeVisible();
    await expect(lens.getByText(/never auto-classified/).first()).toBeVisible();
  });

  test('audit lens shows pipeline-in-review with real report metadata and zero findings', async ({ page }) => {
    await page.goto('/corruption/');
    const audit = page.locator('#audit');
    await expect(audit.getByText('Data pipeline in review')).toBeVisible();
    await expect(audit.getByText('not a criminal adjudication')).toBeVisible();
    expect(await audit.locator('a[href*="cag.gov.in"]').count()).toBeGreaterThanOrEqual(5);
    await expect(audit.locator('.case-card')).toHaveCount(0);
  });

  test('no composite corruption score anywhere', async ({ page }) => {
    await page.goto('/corruption/');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/corruption (index|score): ?\d/i);
    expect(body).toContain('never combines them into a score');
  });
});
