import { test, expect } from '@playwright/test';

test.describe('manifesto landing', () => {
  test('masthead, manifesto and contents render', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/India Tech Collective/);
    await expect(page.getByText('हम भारत के लोग')).toBeVisible();
    await expect(page.locator('h1')).toContainText('The India Tech Collective');
    await expect(page.getByText('Tools for when the network goes dark. Evidence for when public memory does.')).toBeVisible();
    await expect(page.getByText('We, citizens of India,')).toBeVisible();
    await expect(page.getByText('an accusation is not guilt, and guilt is for courts alone')).toBeVisible();
    await expect(page.getByText('Without party or favour')).toBeVisible();
  });

  test('the landing page has a clear first action and share fallback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Explore the public record/ })).toHaveAttribute('href', '#contents');
    await page.getByRole('button', { name: 'Share the Collective' }).click();
    await expect(page.locator('#shareStatus')).toContainText('copied');
  });

  test('the three Parts navigate to their sections', async ({ page }) => {
    await page.goto('/');
    const parts = page.locator('.part');
    await expect(parts).toHaveCount(3);
    await expect(parts.nth(0)).toContainText('The Toolkit');
    await expect(parts.nth(1)).toContainText('Politician Cases');
    await expect(parts.nth(2)).toContainText('Corruption Data');
    await parts.nth(1).click();
    await expect(page).toHaveURL(/\/politicians\/$/);
    await expect(page.locator('h1')).toContainText('Cases declared by elected representatives');
  });

  test('primary nav shows Toolkit, Politicians, Corruption', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.site-nav');
    await expect(nav.locator('a[href="/toolkit/"]')).toHaveText(/Toolkit/i);
    await expect(nav.locator('a[href="/politicians/"]')).toHaveText(/Politicians/i);
    await expect(nav.locator('a[href="/corruption/"]')).toHaveText(/Corruption/i);
    await expect(page.locator('.procedure-links a[href="/corrections/"]')).toBeVisible();
  });

  test('production build carries no demo markers', async ({ page }) => {
    for (const route of ['/', '/politicians/', '/corruption/']) {
      await page.goto(route);
      await expect(page.locator('[data-demo-banner]')).toHaveCount(0);
      await expect(page.locator('meta[name="itc-data-mode"]')).toHaveCount(0);
    }
  });
});

test.describe('/toolkit (Part I)', () => {
  test('renders all 27 tools with official links and caveats', async ({ page }) => {
    await page.goto('/toolkit/');
    await expect(page.locator('h1')).toContainText('Instruments, open to inspection');
    await expect(page.locator('.tool-row .tool-name')).toHaveCount(27 + 7); // 27 tools + learn/eco rows
    await expect(page.locator('.cat-section .tool-row')).toHaveCount(27);
    const briar = page.locator('.tool-row', { hasText: 'Briar' }).first();
    await expect(briar.locator('a.tool-name')).toHaveAttribute('href', 'https://briarproject.org');
    await expect(page.getByText('prefer Briar for sensitive comms').first()).toBeVisible();
  });

  test('category filter chips work with aria-pressed state', async ({ page }) => {
    await page.goto('/toolkit/');
    const mesh = page.locator('#catFilters .fchip', { hasText: /Offline \/ Mesh/ });
    await mesh.click();
    await expect(mesh).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cat-section[data-cat="mesh"]')).toBeVisible();
    await expect(page.locator('.cat-section[data-cat="messaging"]')).toBeHidden();
    await page.locator('#catFilters .fchip', { hasText: /^All/ }).click();
    await expect(page.locator('.cat-section[data-cat="messaging"]')).toBeVisible();
  });
});
