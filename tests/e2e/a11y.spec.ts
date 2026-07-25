import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/',
  '/about/',
  '/contribute/',
  '/corrections/',
  '/corruption/',
  '/coverage/',
  '/frontier/',
  '/methodology/',
  '/mirrors/',
  '/toolkit/',
  '/tools/signal/',
  '/politicians/',
  '/politicians/adv-dean-kuriakose-idukki/',
  '/right-of-reply/',
  '/signals/',
  '/sources/',
  '/404.html',
];

for (const route of routes) {
  test(`axe (WCAG 2.2 AA): ${route}`, async ({ page }) => {
    await page.goto(route);
    // let islands hydrate before scanning
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(
      serious.map((v) => `${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target}`),
    ).toEqual([]);
  });
}

for (const route of routes) {
  test(`one clear page heading and working skip link: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await skip.focus();
    await skip.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });
}

test('reduced motion disables transitions site-wide', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const transition = await page.evaluate(
    () => getComputedStyle(document.querySelector('.theme-toggle')!).transitionDuration,
  );
  expect(['0s', '']).toContain(transition);
  await ctx.close();
});

test('mobile nav works at 360px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/politicians/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('#navLinks a[href="/politicians/"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await ctx.close();
});
