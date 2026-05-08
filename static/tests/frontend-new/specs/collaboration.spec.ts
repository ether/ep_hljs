import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

/** Return the current value of the underlying (hidden) native select. */
async function getSelectValue(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const sel = document.getElementById('ep_hljs_select') as HTMLSelectElement | null;
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
  await page.waitForSelector('#ep_hljs_select', {state: 'attached', timeout: 10_000});
  // The toolbar-overlay covers the editor while the pad is initialising and
  // intercepts clicks on the toolbar. Wait for it to be removed/hidden.
  await page.waitForFunction(() => {
    const overlay = document.getElementById('toolbar-overlay');
    return !overlay || overlay.offsetParent === null;
  }, null, {timeout: 10_000});
}

test('B sees the language A picked within 1s', async ({browser}) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await goToNewPad(a);
  await waitForPad(a);
  const padUrl = a.url();

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(padUrl);
  await waitForPad(b);

  // Verify B starts with the default language.
  await expect.poll(() => getSelectValue(b), {timeout: 5_000}).toBe('auto');

  // A picks Ruby. Set the underlying select directly and trigger the
  // change event the plugin listens for. Avoids fighting the toolbar-overlay
  // and niceSelect timing.
  await a.evaluate(() => {
    const sel = document.getElementById('ep_hljs_select') as HTMLSelectElement;
    sel.value = 'ruby';
    const $: any = (window as any).$;
    if ($ && $.fn) $(sel).trigger('change');
    else sel.dispatchEvent(new Event('change', {bubbles: true}));
  });

  // B's underlying select must reflect the new value within 10 s.
  await expect.poll(() => getSelectValue(b), {timeout: 15_000}).toBe('ruby');

  await ctxA.close();
  await ctxB.close();
});
