import {Page} from '@playwright/test';

const innerWindowHandle = (page: Page) => page.evaluate(() => {
  const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
  const inner = outer && outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
  return inner ? inner.contentWindow : null;
});

export const highlightCount = async (page: Page, cls: string): Promise<number> => {
  return page.evaluate((c) => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    if (!outer) return 0;
    const inner = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    if (!inner) return 0;
    const win = inner.contentWindow as any;
    if (!win || !win.CSS || !win.CSS.highlights) return 0;
    const h = win.CSS.highlights.get(c);
    return h ? (h.size || 0) : 0;
  }, cls);
};

export const highlightTexts = async (page: Page, cls: string): Promise<string[]> => {
  return page.evaluate((c) => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    if (!outer) return [];
    const inner = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    if (!inner) return [];
    const win = inner.contentWindow as any;
    if (!win || !win.CSS || !win.CSS.highlights) return [];
    const h = win.CSS.highlights.get(c);
    if (!h) return [];
    return Array.from(h).map((r: any) => r.toString());
  }, cls);
};

export const highlightCountInLine = async (
    page: Page, lineIdx: number, cls: string): Promise<number> => {
  return page.evaluate(({i, c}) => {
    const outer = document.querySelector('iframe[name="ace_outer"]') as HTMLIFrameElement;
    if (!outer) return 0;
    const inner = outer.contentDocument!.querySelector('iframe[name="ace_inner"]') as HTMLIFrameElement;
    if (!inner) return 0;
    const innerDoc = inner.contentDocument!;
    const lines = innerDoc.querySelectorAll('div[id^="magicdomid"]');
    const line = lines[i] as HTMLElement | undefined;
    if (!line) return 0;
    const win = inner.contentWindow as any;
    if (!win || !win.CSS || !win.CSS.highlights) return 0;
    const h = win.CSS.highlights.get(c);
    if (!h) return 0;
    let count = 0;
    for (const range of h) {
      const ancestor = (range as any).commonAncestorContainer;
      if (line.contains(ancestor)) count++;
    }
    return count;
  }, {i: lineIdx, c: cls});
};

export const expectHighlightWithin = async (
    page: Page, cls: string, timeoutMs = 10_000): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = await highlightCount(page, cls);
    if (n > 0) return;
    await page.waitForTimeout(200);
  }
  const got = await highlightCount(page, cls);
  throw new Error(`expected at least one ::highlight(${cls}) range within ${timeoutMs}ms; got ${got}`);
};
