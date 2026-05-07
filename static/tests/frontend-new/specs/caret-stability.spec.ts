import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test.setTimeout(30_000);

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

test('caret stays put after typing a JS keyword on a fresh pad', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('Hello while');
  await page.waitForTimeout(2000);
  await page.keyboard.type('X');
  const lineText = await inner(page).locator('div[id^="magicdomid"]').first().innerText();
  expect(lineText).toBe('Hello whileX');
});

test('caret stays put after End-key navigation on a tokenized line', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('while');
  await page.waitForTimeout(2000);
  await page.keyboard.press('Home');
  await page.waitForTimeout(800);
  await page.keyboard.press('End');
  await page.waitForTimeout(800);
  await page.keyboard.type('Y');
  const lineText = await inner(page).locator('div[id^="magicdomid"]').first().innerText();
  expect(lineText).toBe('whileY');
});

test('caret stays put when clicking at end of a tokenized line', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('while');
  await page.waitForTimeout(2000);

  // Click at the rightmost end of the line.
  const lineLocator = inner(page).locator('div[id^="magicdomid"]').first();
  const box = await lineLocator.boundingBox();
  if (box) {
    await lineLocator.click({position: {x: box.width - 2, y: box.height / 2}});
  }
  await page.waitForTimeout(800);
  await page.keyboard.type('Z');
  const lineText = await lineLocator.innerText();
  expect(lineText).toBe('whileZ');
});

test('caret stays put on multi-line pad when re-typing on line 0', async ({page}) => {
  await setupPad(page);
  await page.keyboard.type('function f(){return 1;}');
  await page.keyboard.press('Enter');
  await page.keyboard.type('// note');
  await page.waitForTimeout(2000);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await page.waitForTimeout(800);
  await page.keyboard.type('W');
  const line0 = await inner(page).locator('div[id^="magicdomid"]').nth(0).innerText();
  expect(line0).toBe('function f(){return 1;}W');
});
