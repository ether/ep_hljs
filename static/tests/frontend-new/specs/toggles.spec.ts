import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test.setTimeout(45_000);

const inner = (page: Page) => page
    .frameLocator('iframe[name="ace_outer"]')
    .frameLocator('iframe[name="ace_inner"]');

const setupPad = async (page: Page) => {
  await goToNewPad(page);
  await page.waitForTimeout(1000);
  await inner(page).locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
};

const pickLanguage = async (page: Page, value: string) => {
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  if (await niceWrapper.count() > 0) {
    await niceWrapper.click();
    await page.locator(`#ep_syntax_highlighting_li .nice-select .option[data-value="${value}"]`).click();
  } else {
    await page.locator('#ep_syntax_highlighting_select').selectOption(value);
  }
};

test('selecting "Off" clears all syntax highlighting on the pad', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('var x = 1;');
  await page.keyboard.press('Enter'); // make line 0 inactive
  await page.waitForTimeout(2000);

  const beforeCount = await inner(page).locator('span.hljs-keyword').count();
  expect(beforeCount).toBeGreaterThan(0);

  await pickLanguage(page, 'off');
  await page.waitForTimeout(2500);

  const afterCount = await inner(page).locator('span.hljs-keyword').count();
  expect(afterCount).toBe(0);
});

test('per-user disable clears highlighting locally', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('var x = 1;');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  const beforeCount = await inner(page).locator('span.hljs-keyword').count();
  expect(beforeCount).toBeGreaterThan(0);

  // Open the user-settings panel and uncheck the "Highlight syntax" box.
  // The settings panel is opened via the cog/gear button in the toolbar
  // (data-l10n-id="pad.toolbar.settings.title"). Just toggle localStorage
  // directly and dispatch a synthetic change event — the test framework's
  // settings-panel toggling differs across skins.
  await page.evaluate(() => {
    window.localStorage.setItem('ep_syntax_highlighting.user_enabled', 'false');
    const cb = document.getElementById('ep_syntax_highlighting_user_enabled') as HTMLInputElement;
    if (cb) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change', {bubbles: true}));
    }
  });
  await page.waitForTimeout(2000);

  const afterCount = await inner(page).locator('span.hljs-keyword').count();
  expect(afterCount).toBe(0);
});
