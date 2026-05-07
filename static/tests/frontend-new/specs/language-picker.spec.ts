import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

/** Select a language via the nice-select widget that wraps the native <select>. */
async function pickLanguage(page: import('@playwright/test').Page, value: string) {
  // The colibris skin replaces <select> with a .nice-select div; click to open then pick the option.
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await page.locator(`#ep_syntax_highlighting_li .nice-select .option[data-value="${value}"]`).click();
}

/** Return the current value of the underlying (hidden) native select. */
async function getSelectValue(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const sel = document.getElementById('ep_syntax_highlighting_select') as HTMLSelectElement | null;
    return sel ? sel.value : '';
  });
}

test('picks Python and persists across reload', async ({page}) => {
  await goToNewPad(page);
  // Allow postAceInit (which connects the socket) to complete before interacting.
  await page.waitForTimeout(1000);

  // The underlying (hidden) <select> carries the aria-label; verify it is present.
  const sel = page.locator('#ep_syntax_highlighting_select');
  await expect(sel).toHaveAttribute('aria-label', 'Syntax language');

  // The nice-select renders the "auto" option as "Auto-detect".
  await expect(page.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="auto"]'))
      .toHaveText('Auto-detect');

  await pickLanguage(page, 'python');

  const inner = page.frameLocator('iframe[name="ace_outer"]').frameLocator('iframe[name="ace_inner"]');
  // Clear the welcome-text boilerplate so only our Python snippet is present.
  await inner.locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);

  await page.keyboard.type('def add(a, b): return a + b');
  await expect(inner.locator('span.ep_syntax_highlighting_token.hljs-keyword').first())
      .toHaveText('def', {timeout: 10_000});

  // Wait for the language change to be committed to the server before reloading.
  await page.waitForTimeout(1000);
  await page.reload();
  // After reload the underlying select must reflect the persisted language.
  await expect.poll(() => getSelectValue(page), {timeout: 10_000}).toBe('python');
});
