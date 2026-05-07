import {expect, test, Page, Browser} from '@playwright/test';
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

const repSelStart = async (page: Page): Promise<[number, number] | null> => {
  return await page.evaluate(() => {
    try {
      const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
      const inner = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
      const innerDoc = inner.contentDocument!;
      const sel = innerDoc.getSelection();
      if (!sel || !sel.anchorNode) return null;
      // Walk up from the anchor to the line div (id starts with "magicdomid").
      let lineEl: Node | null = sel.anchorNode;
      while (lineEl && (!(lineEl as Element).id || !((lineEl as Element).id || '').startsWith('magicdomid'))) {
        lineEl = lineEl.parentNode;
      }
      if (!lineEl) return null;
      // Line index = position of this div among all magicdomid siblings.
      const allLines = innerDoc.querySelectorAll('div[id^="magicdomid"]');
      let lineIdx = -1;
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i] === lineEl) { lineIdx = i; break; }
      }
      if (lineIdx < 0) return null;
      // Column = text-content offset within the line up to the anchor.
      const treeWalker = innerDoc.createTreeWalker(lineEl as Node, NodeFilter.SHOW_TEXT);
      let col = 0;
      let cur: Node | null;
      while ((cur = treeWalker.nextNode())) {
        if (cur === sel.anchorNode) { return [lineIdx, col + sel.anchorOffset]; }
        col += (cur.nodeValue || '').length;
      }
      return [lineIdx, col];
    } catch { return null; }
  });
};

test('caret on line 0 stays put when another user edits the same line', async ({browser}) => {
  // User A
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await setupPad(pageA);
  await pageA.keyboard.type('let foo = "bar";');
  await pageA.waitForTimeout(2000);

  const padUrl = pageA.url();

  // User B on same pad
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(padUrl);
  await pageB.waitForTimeout(1500);

  // User A: move caret to line 0, col 1.
  await pageA.keyboard.press('Home');
  await pageA.keyboard.press('ArrowRight');
  await pageA.waitForTimeout(500);
  const beforeA = await repSelStart(pageA);
  console.log('A caret before B edits:', beforeA);
  expect(beforeA).toEqual([0, 1]);

  // User B: change "bar" to "baz". Click at end of line, then arrow-left to
  // position before the closing quote, select "bar" with shift+arrow-left*3,
  // type "baz".
  await inner(pageB).locator('body').click();
  await pageB.keyboard.press('Control+End');
  // Position: end of line 0. Go left past `;`, `"`.
  await pageB.keyboard.press('ArrowLeft'); // before `;`
  await pageB.keyboard.press('ArrowLeft'); // before `"`
  // Select "bar" backwards
  await pageB.keyboard.down('Shift');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.up('Shift');
  await pageB.keyboard.type('baz');
  await pageB.waitForTimeout(2500);

  // User A's caret should still be at [0, 1].
  const afterA = await repSelStart(pageA);
  console.log('A caret after B edits:', afterA);
  expect(afterA).toEqual([0, 1]);

  await ctxA.close();
  await ctxB.close();
});
