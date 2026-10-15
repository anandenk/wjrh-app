// Prints [x, y, width, height] (in points) of elements in the HTML design, after opening a tab and, optionally,
// clicking into a page. Use it to read exact sizes from the design instead of guessing from a screenshot.
//
//   node measure.mjs <TAB or ""> <css selector> [<css selector> ...]
//   CLICKS='.station-row-link:has-text("History")' node measure.mjs STATION .info-list-item .info-list-title
//
// Same environment as design-shots.mjs (VW, VH, TOP, DESIGN_URL, CHROME). Phone insets are always applied.
import { chromium } from 'playwright-core';

const [tab, ...selectors] = process.argv.slice(2);
const TOP = Number(process.env.TOP ?? 62);
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await (
  await browser.newContext({
    viewport: { width: Number(process.env.VW ?? 402), height: Number(process.env.VH ?? 874) },
    deviceScaleFactor: 3,
  })
).newPage();
await page.goto(process.env.DESIGN_URL ?? 'http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
await page.waitForSelector('.now-live-canvas');
await page.addStyleTag({
  content: `:root{--sab:34px}.app-header,.now-live-content,.schedule-masthead{padding-top:calc(24px + ${TOP}px)!important}.archive-detail-header{padding-top:calc(8px + ${TOP}px)!important}`,
});
await page.waitForTimeout(800);
if (tab) {
  await page.click(`.tab-dock button:text-is("${tab}")`);
  await page.waitForTimeout(700);
}
for (const click of (process.env.CLICKS ?? '').split('|').filter(Boolean)) {
  await page.click(click);
  await page.waitForTimeout(600);
}
await page.evaluate(() => { document.querySelector('.app-scroll').scrollTop = 0; });
await page.waitForTimeout(300);
const out = await page.evaluate((sels) => {
  const r = {};
  for (const sel of sels) {
    const all = document.querySelectorAll(sel);
    if (!all.length) { r[sel] = null; continue; }
    const b = all[0].getBoundingClientRect();
    const cs = getComputedStyle(all[0]);
    r[sel] = `${[b.x, b.y, b.width, b.height].map((n) => Math.round(n * 10) / 10).join(', ')}  (${all.length} found) line-height ${cs.lineHeight}, font ${cs.fontSize}`;
  }
  return r;
}, selectors);
console.log(JSON.stringify(out, null, 1));
await browser.close();
