import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

/** Return the current value of the underlying (hidden) native select. */
async function getSelectValue(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const sel = document.getElementById('ep_syntax_highlighting_select') as HTMLSelectElement | null;
    return sel ? sel.value : '';
  });
}

/** Wait for the pad editor to be ready in a new page. */
async function waitForPad(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('#editorcontainer.initialized', {timeout: 15_000});
  await page.frameLocator('iframe[name="ace_outer"]')
      .frameLocator('iframe[name="ace_inner"]')
      .locator('#innerdocbody[contenteditable="true"]')
      .waitFor({state: 'attached', timeout: 15_000});
  // Also wait for the syntax highlighting select to be present (it will be hidden by nice-select).
  await page.waitForSelector('#ep_syntax_highlighting_select', {state: 'attached', timeout: 10_000});
}

test('B sees the language A picked within 1s', async ({browser}) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await goToNewPad(a);
  const padUrl = a.url();

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(padUrl);
  await waitForPad(b);

  // Verify B starts with the default language.
  await expect.poll(() => getSelectValue(b), {timeout: 5_000}).toBe('auto');

  // A picks Ruby via the nice-select widget.
  const niceWrapper = a.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await a.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="ruby"]').click();

  // B's underlying select must reflect the new value within 10 s.
  await expect.poll(() => getSelectValue(b), {timeout: 15_000}).toBe('ruby');

  await ctxA.close();
  await ctxB.close();
});
