import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test('highlights a JS keyword after debounce', async ({page}) => {
  await goToNewPad(page);
  // Allow postAceInit (which connects the socket) to complete before interacting.
  await page.waitForTimeout(1000);

  // Select JavaScript explicitly so auto-detect doesn't mis-classify the
  // pad's default "Welcome to Etherpad!" boilerplate.
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await page.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="javascript"]').click();

  const inner = page.frameLocator('iframe[name="ace_outer"]').frameLocator('iframe[name="ace_inner"]');
  // Clear the welcome-text boilerplate so the only content is our JS snippet.
  await inner.locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  // Give the editor a moment to settle before typing new content.
  await page.waitForTimeout(500);

  await page.keyboard.type('function add(a, b) { return a + b; }');
  await expect(inner.locator('span.ep_syntax_highlighting_token.hljs-keyword').first())
      .toHaveText('function', {timeout: 10_000});
});
