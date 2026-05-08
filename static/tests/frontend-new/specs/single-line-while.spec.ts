import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {expectHighlightWithin, highlightTexts} from '../helper/highlights';

test.setTimeout(20_000);

const inner = (page: Page) => page
    .frameLocator('iframe[name="ace_outer"]')
    .frameLocator('iframe[name="ace_inner"]');

const setupPad = async (page: Page) => {
  await goToNewPad(page);
  await page.waitForTimeout(1500);
  await inner(page).locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
};

const pickLanguage = async (page: Page, value: string) => {
  const niceWrapper = page.locator('#ep_hljs_li .nice-select');
  if (await niceWrapper.count() > 0) {
    await niceWrapper.click();
    await page.locator(`#ep_hljs_li .nice-select .option[data-value="${value}"]`).click();
  } else {
    await page.locator('#ep_hljs_select').selectOption(value);
  }
};

test('single line "while" with JS gets ::highlight(hljs-keyword)', async ({page}) => {
  await setupPad(page);
  await pickLanguage(page, 'javascript');
  await inner(page).locator('body').click();
  await page.keyboard.type('while');
  await page.waitForTimeout(2000);
  await expectHighlightWithin(page, 'hljs-keyword', 5_000);
  const texts = await highlightTexts(page, 'hljs-keyword');
  expect(texts).toContain('while');
});

test('single line "while" caret stays after typing', async ({page}) => {
  await setupPad(page);
  await pickLanguage(page, 'javascript');
  await inner(page).locator('body').click();
  await page.keyboard.type('while');
  await page.waitForTimeout(2000);
  await page.keyboard.type('X');
  const lineText = await inner(page).locator('div[id^="magicdomid"]').first().innerText();
  expect(lineText).toBe('whileX');
});
