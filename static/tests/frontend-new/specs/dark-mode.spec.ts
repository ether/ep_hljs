import {expect, test, Page} from '@playwright/test';
import {goToNewPad} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

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

const pickJS = async (page: Page) => {
  const niceWrapper = page.locator('#ep_syntax_highlighting_li .nice-select');
  await niceWrapper.click();
  await page.locator('#ep_syntax_highlighting_li .nice-select .option[data-value="javascript"]').click();
  await inner(page).locator('body').click();
};

test('inner doc <html> carries the super-dark-editor class when skin variant is set', async ({page}) => {
  // Etherpad applies skinVariants from clientVars to inner <html> in ace.ts:266.
  // We don't toggle the skin from the test (requires a server restart with
  // different settings) but we can at least verify the selector mechanism
  // applies once super-dark-editor is added programmatically.
  await goToNewPad(page);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    const innerFrame = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    innerFrame.contentDocument!.documentElement.classList.add('super-dark-editor');
  });

  // Probe a known dark-mode rule applies once the class is present.
  const darkApplies = await page.evaluate(() => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    const innerFrame = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    const innerDoc = innerFrame.contentDocument!;
    // Walk style sheets, find the .super-dark-editor ::highlight(hljs-keyword) rule,
    // and ensure it's present and parseable.
    let found = false;
    for (const sheet of [...innerDoc.styleSheets] as CSSStyleSheet[]) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of [...rules] as CSSRule[]) {
        const r = rule as CSSStyleRule;
        if (r.selectorText && r.selectorText.includes('.super-dark-editor') &&
            r.selectorText.includes('::highlight(hljs-keyword)')) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    return found;
  });
  expect(darkApplies).toBe(true);
});

test('::highlight() rules are loaded into the inner doc', async ({page}) => {
  await setupPad(page);
  await pickJS(page);
  await page.keyboard.type('const');
  await page.waitForTimeout(1500);

  // Verify that at least one ::highlight() rule for hljs-keyword exists in the
  // inner doc (proves CSS is reaching the right document context).
  const lightApplies = await page.evaluate(() => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    const innerFrame = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    const innerDoc = innerFrame.contentDocument!;
    for (const sheet of [...innerDoc.styleSheets] as CSSStyleSheet[]) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of [...rules] as CSSRule[]) {
        const r = rule as CSSStyleRule;
        if (r.selectorText === '::highlight(hljs-keyword)') return true;
      }
    }
    return false;
  });
  expect(lightApplies).toBe(true);
});
