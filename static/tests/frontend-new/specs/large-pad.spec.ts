import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test('5000-line JS pad still highlights and stays responsive', async ({page, context}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await goToNewPad(page);

  // Select JavaScript explicitly so all lines are highlighted as JS.
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await page.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="javascript"]').click();

  const inner = page.frameLocator('iframe[name="ace_outer"]').frameLocator('iframe[name="ace_inner"]');
  // Clear existing boilerplate content.
  await inner.locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);

  const blob =Array.from({length: 5000}, (_, i) => `function f${i}(){return ${i};}`).join('\n');
  await page.evaluate((text) => navigator.clipboard.writeText(text), blob);
  await page.keyboard.press('Control+V');

  await expect(inner.locator('span.ep_syntax_highlighting_token.hljs-keyword').first()).toBeVisible({timeout: 60_000});

  // Typing should still feel responsive.
  const t0 = Date.now();
  await page.keyboard.type('// extra');
  expect(Date.now() - t0).toBeLessThan(5_000);
});
