import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test('toggling color-scheme swaps the theme href', async ({page}) => {
  await goToNewPad(page);
  await page.evaluate(() => document.documentElement.classList.add('darkMode'));
  await expect.poll(() => page.evaluate(() => {
    const links = [
      ...document.querySelectorAll('link[href*="/static/plugins/ep_syntax_highlighting/static/css/themes/"]'),
    ];
    // Also peek into the inner ace iframe.
    try {
      const inner = document.querySelector('iframe[name="ace_outer"]')
          ?.contentDocument?.querySelector('iframe[name="ace_inner"]')?.contentDocument;
      if (inner) {
        links.push(...inner.querySelectorAll('link[href*="/static/plugins/ep_syntax_highlighting/static/css/themes/"]'));
      }
    } catch {/* cross-origin or not loaded yet */}
    return links.some((l) => (l as HTMLLinkElement).href.includes('github-dark.css'));
  }), {timeout: 5_000}).toBeTruthy();
});
