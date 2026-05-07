import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

test.setTimeout(60_000);

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

const pickLanguage = async (page: Page, value: string) => {
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  if (await niceWrapper.count() > 0) {
    await niceWrapper.click();
    await page.locator(`#ep_syntax_highlighting_li .nice-select .option[data-value="${value}"]`).click();
  } else {
    await page.locator('#ep_syntax_highlighting_select').selectOption(value);
  }
};

const repSelStart = async (page: Page): Promise<[number, number] | null> => {
  return await page.evaluate(() => {
    try {
      const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
      const inner = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
      const innerDoc = inner.contentDocument!;
      const sel = innerDoc.getSelection();
      if (!sel || !sel.anchorNode) return null;
      let lineEl: Node | null = sel.anchorNode;
      while (lineEl && (!(lineEl as Element).id || !((lineEl as Element).id || '').startsWith('magicdomid'))) {
        lineEl = lineEl.parentNode;
      }
      if (!lineEl) return null;
      const allLines = innerDoc.querySelectorAll('div[id^="magicdomid"]');
      let lineIdx = -1;
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i] === lineEl) { lineIdx = i; break; }
      }
      if (lineIdx < 0) return null;
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

test('user-reported repro: const foo = "bar"; with JS, B edits "bar" while A is on line 0', async ({browser}) => {
  // ---- USER A ----
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await setupPad(pageA);
  await pickLanguage(pageA, 'javascript');
  await page_typeOnA(pageA);
  await pageA.waitForTimeout(2000);

  const padUrl = pageA.url();

  // Move A's caret to line 0 col 1.
  await pageA.keyboard.press('Home');
  await pageA.waitForTimeout(300);
  await pageA.keyboard.press('ArrowRight');
  await pageA.waitForTimeout(300);
  const beforeA = await repSelStart(pageA);
  console.log('A caret before B edits:', beforeA);
  expect(beforeA).toEqual([0, 1]);

  // ---- USER B ----
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(padUrl);
  await pageB.waitForTimeout(2000);

  // B edits "bar" → "baz".
  await inner(pageB).locator('body').click();
  await pageB.keyboard.press('Control+End');
  // Position past `;`, `"` to land on `r` of "bar".
  await pageB.keyboard.press('ArrowLeft'); // before `;`
  await pageB.keyboard.press('ArrowLeft'); // before `"`
  // Select "bar" backwards (3 chars).
  await pageB.keyboard.down('Shift');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.press('ArrowLeft');
  await pageB.keyboard.up('Shift');
  await pageB.keyboard.type('baz');
  await pageB.waitForTimeout(2500);

  const afterA = await repSelStart(pageA);
  console.log('A caret after B edits:', afterA);
  expect(afterA).toEqual([0, 1]);

  await ctxA.close();
  await ctxB.close();
});

const page_typeOnA = async (pageA: Page) => {
  // Use evaluate-based dispatch of literal characters? No — keyboard.type
  // is fine; just need to wrap because the quotes in the string require
  // shift handling that Playwright handles for us when using `type`.
  await pageA.keyboard.type('const foo = "bar";');
};
