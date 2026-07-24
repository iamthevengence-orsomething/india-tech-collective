import { test, expect } from '@playwright/test';

/**
 * Runs against the DATA_MODE=demo build (dist-demo). Proves the fixture rig:
 * demo banner + meta marker present, fixture records render rich UI states.
 * The prod project asserts the inverse (no demo markers) in politicians.spec.
 */
test.describe('demo build (fixtures)', () => {
  test('demo banner and meta marker are present', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.locator('[data-demo-banner]')).toContainText('DEMO DATA');
    await expect(page.locator('meta[name="itc-data-mode"]')).toHaveAttribute('content', 'demo');
  });

  test('fixture cohort renders with suppression and case cards', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.getByText(/Showing 8 of 8 representatives/)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table.data').getByText('DPA').first()).toBeVisible();
    // Devanagari fixture name renders
    await expect(page.getByText('अजय डेमो कुमार')).toBeVisible();
    // suppressed small party
    await expect(page.locator('.chip', { hasText: 'small sample' }).first()).toBeVisible();
    // profile with conviction + PC Act chip
    await page.goto('/politicians/demo-1/');
    await expect(page.locator('.case-card').first()).toBeVisible();
    await expect(page.getByText('Declared conviction').first()).toBeVisible();
    await expect(page.locator('.case-card .chip', { hasText: 'PC Act' }).first()).toBeVisible();
  });

  test('missing-affidavit fixture shows null coverage, not zero', async ({ page }) => {
    await page.goto('/politicians/?cases=without');
    const note = await page.locator('.result-note').first().textContent();
    // 3 fixtures declared 0 cases; the missing-affidavit fixture must NOT appear here
    expect(note).toContain('Showing 3 of 8');
  });
});
