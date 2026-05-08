import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {highlightCount} from '../helper/highlights';

test.setTimeout(45_000);

test('reload of pad with persisted JS language tokenizes lines without edit', async ({browser}) => {
  // Session 1: pick JavaScript and type code; persists language to pad store.
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await goToNewPad(p1);
  await p1.waitForTimeout(1500);

  const inner1 = p1.frameLocator('iframe[name="ace_outer"]')
      .frameLocator('iframe[name="ace_inner"]');
  await inner1.locator('body').click();
  await p1.keyboard.press('Control+A');
  await p1.keyboard.press('Delete');
  await p1.waitForTimeout(300);

  const niceWrapper = p1.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await p1.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="javascript"]').click();
  await inner1.locator('body').click();
  await p1.keyboard.type('const foo = "bar"; // note');
  await p1.waitForTimeout(2000);

  const padUrl = p1.url();
  await ctx1.close();

  // Session 2: open the same URL fresh in a new context — must tokenize on
  // initial paint (without the user editing anything).
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(padUrl);
  await p2.waitForTimeout(3500);
  expect(await highlightCount(p2, 'hljs-keyword')).toBeGreaterThan(0);
  await ctx2.close();
});

test('toggle init: highlight checkbox is checked by default', async ({page}) => {
  await goToNewPad(page);
  await page.waitForTimeout(2500);
  const checked = await page.evaluate(() => {
    const el = document.getElementById('options-syntax-highlighting') as HTMLInputElement | null;
    return el ? el.checked : null;
  });
  expect(checked).toBe(true);
});
