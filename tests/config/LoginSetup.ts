import { test as base, BrowserContext } from '@playwright/test';

export const test = base.extend<{
  cleanContext: BrowserContext;
}>({
  cleanContext: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('https://login.microsoftonline.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await context.clearCookies();

    await use(context);
    await context.close();
  },
});