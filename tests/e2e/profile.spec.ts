import { test, expect } from '@playwright/test';

test.describe('representative profile', () => {
  test('case-heavy profile shows sourced case cards and disclaimers', async ({ page }) => {
    await page.goto('/politicians/adv-dean-kuriakose-idukki/');
    await expect(page.locator('h1')).toContainText('Dean Kuriakose');
    await expect(page.getByText('party at the 2024 election')).toBeVisible();
    await expect(page.getByText('winner at election, as of 4 Jun 2024')).toBeVisible();
    // machine-checked chips and case cards
    await expect(page.locator('.case-card').first()).toBeVisible();
    expect(await page.locator('.case-card').count()).toBe(88);
    await expect(page.locator('.case-card').first().getByText('Machine-checked, not human-verified')).toBeVisible();
    // the standing disclaimer
    await expect(page.getByText('The case may have changed since then.').first()).toBeVisible();
    await expect(page.getByText('Only a court decides guilt').first()).toBeVisible();
    // correction link and source link
    await expect(page.locator('a[href="/corrections/"]').first()).toBeVisible();
    await expect(page.locator('a[href*="adrindia.org"]').first()).toBeVisible();
    // adverse machine-checked profile is noindexed until human review
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    // every profile exposes its generated standalone image card
    const card = page.locator('img[src="/og/profiles/adv-dean-kuriakose-idukki.png"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('alt', /Share card:.*Dean Kuriakose/);
    await expect(page.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('download', /dean-kuriakose/);
  });

  test('profile share image responds as a PNG', async ({ request }) => {
    const response = await request.get('/og/profiles/adv-dean-kuriakose-idukki.png');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });

  test('zero-case profile states the sourced zero', async ({ page }) => {
    await page.goto('/politicians/');
    await expect(page.getByText('Showing 543 of 543')).toBeVisible({ timeout: 15000 });
    await page.goto('/politicians/?cases=without');
    const link = page.locator('table.data tbody a').first();
    await link.click();
    await expect(page.getByText('No criminal cases declared.')).toBeVisible();
    await expect(page.getByText('records zero declared cases')).toBeVisible();
    // clean profiles are indexable
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});
