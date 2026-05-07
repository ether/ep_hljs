import {expect, test} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test('HTML export contains hljs spans + theme CSS', async ({page, request}) => {
  await goToNewPad(page);
  // Allow postAceInit (which connects the socket) to complete before interacting.
  await page.waitForTimeout(1000);
  const padUrl = page.url();
  const padId = padUrl.split('/p/')[1].split('?')[0];

  // Select JavaScript via the nice-select widget.
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await page.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="javascript"]').click();

  const inner = page.frameLocator('iframe[name="ace_outer"]').frameLocator('iframe[name="ace_inner"]');
  // Clear boilerplate so only our snippet is exported.
  await inner.locator('body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);

  await page.keyboard.type('function f(){return 1;}');
  // Give the socket time to store the language on the server.
  await page.waitForTimeout(1200);

  const res = await request.get(`http://localhost:9001/p/${padId}/export/html`);
  const body = await res.text();
  expect(body).toContain('<span class="hljs-keyword">function</span>');
  expect(body).toContain('.hljs-keyword');
});
