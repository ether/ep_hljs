import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test.setTimeout(45_000);

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

test('text typed on A appears on B (basic collab sync)', async ({browser}) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await setupPad(a);
  const padUrl = a.url();

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(padUrl);
  await b.waitForTimeout(1500);

  // Type on A, watch B.
  await a.keyboard.type('hello from A');
  // B should receive the text within a few seconds.
  await expect(inner(b).locator('div[id^="magicdomid"]').first())
      .toContainText('hello from A', {timeout: 10_000});

  // Now type on B, watch A.
  await inner(b).locator('body').click();
  await b.keyboard.press('Control+End');
  await b.keyboard.type(' and B');
  await expect(inner(a).locator('div[id^="magicdomid"]').first())
      .toContainText('and B', {timeout: 10_000});

  await ctxA.close();
  await ctxB.close();
});
