import { test, expect } from '@playwright/test';

test.describe('/politicians dashboard', () => {
  test('loads with real cohort KPIs and coverage banner', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.locator('h1')).toContainText('Cases declared by elected representatives');
    await expect(page.getByText('Coverage: 543 of 543 expected seats')).toBeVisible();
    await expect(page.locator('.kpi').first()).toContainText('543');
    // island loads data
    await expect(page.getByText(/Showing 543 of 543 representatives/)).toBeVisible({ timeout: 15000 });
  });

  test('search, filters, URL sync and refresh restore', async ({ page }) => {
    await page.goto('/politicians/');
    const search = page.getByRole('searchbox');
    await search.fill('modi');
    await expect(page.getByText(/Showing \d+ of 543 representatives matching/)).toBeVisible();
    expect(page.url()).toContain('q=modi');
    // refresh keeps state
    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue('modi');
    // deep link with filters
    await page.goto('/politicians/?state=KL&cases=with');
    await expect(page.getByText(/Showing \d+ of 543/)).toBeVisible();
    const note = await page.locator('.result-note').first().textContent();
    const match = /Showing (\d+) of 543/.exec(note ?? '');
    expect(Number(match?.[1])).toBeGreaterThan(0);
    expect(Number(match?.[1])).toBeLessThan(543);
    // clear all
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page.getByText('Showing 543 of 543 representatives')).toBeVisible();
    expect(page.url()).not.toContain('state=KL');
  });

  test('table sorts, paginates, links to profiles', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.getByText('Showing 543 of 543 representatives')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Declared cases/ }).first().click();
    const firstCount = await page.locator('table.data tbody tr').first().locator('td').nth(3).textContent();
    expect(Number(firstCount)).toBeGreaterThanOrEqual(80); // max declared cases sorts first
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    const profileLink = page.locator('table.data tbody a').first();
    const href = await profileLink.getAttribute('href');
    expect(href).toMatch(/^\/politicians\/.+\/$/);
  });

  test('state tiles are keyboard-operable and filter the view', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.getByText('Showing 543 of 543')).toBeVisible({ timeout: 15000 });
    const klTile = page.getByRole('button', { name: /^Kerala:/ });
    await klTile.focus();
    await page.keyboard.press('Enter');
    await expect(klTile).toHaveAttribute('aria-pressed', 'true');
    expect(page.url()).toContain('state=KL');
    await expect(page.getByText(/Showing 20 of 543/)).toBeVisible();
    // data table twin exists
    await page.getByRole('button', { name: /Show data table/ }).click();
    await expect(page.locator('table.data caption').first()).toContainText('same data as the tile view');
  });

  test('downloads respond with sanitized CSV and provenance JSON', async ({ page, request }) => {
    const csv = await request.get('/downloads/representatives-ls2024.csv');
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text.split('\n')[0]).toContain('declared_criminal_cases');
    expect(text).not.toMatch(/\n=[A-Z]/); // no raw formula-leading cells
    const json = await request.get('/downloads/representatives-ls2024.json');
    expect(json.status()).toBe(200);
    expect((await json.json()).licenceNote).toContain('GODL');
  });

  test('party bars show denominators and small-sample suppression', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.getByText('Showing 543 of 543')).toBeVisible({ timeout: 15000 });
    const partySection = page.locator('section', { has: page.locator('#party-h') });
    await expect(partySection.getByText(/\d+ of 240 covered/)).toBeVisible(); // BJP denominator visible
    await expect(partySection.locator('.chip', { hasText: 'small sample' }).first()).toBeVisible();
  });
});
