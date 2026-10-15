// Screenshots every screen of the HTML design (frontend/index.html), phone-sized, at 3x.
//
//   node design-shots.mjs <out-dir> [ios]
//
// "ios" pretends the phone has a notch and a home indicator (the design's CSS reads them from the device), so
// the shots line up with the app's. Environment: VW, VH (viewport, default 402x874 = iPhone 17), TOP (top inset
// in points, default 62), BOTTOM (bottom inset, default 34), DPR (default 3), DESIGN_URL (default http://127.0.0.1:8765/), CHROME (path to a Chrome binary), and
// FORCE_NARROW=1 (apply the design's narrow-phone rules, which start below 400 pt, at any width).
//
// Serve the design first:  cd frontend && python3 -m http.server 8765 --bind 127.0.0.1
import fs from 'node:fs';

import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? './design';
const IOS = process.argv[3] === 'ios';
const TOP = Number(process.env.TOP ?? 62);
const BOTTOM = Number(process.env.BOTTOM ?? 34);
const URL = process.env.DESIGN_URL ?? 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.VW ?? 402), height: Number(process.env.VH ?? 874) },
  deviceScaleFactor: Number(process.env.DPR ?? 3),
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' }); // React loads from unpkg.com, so this needs internet
await page.waitForSelector('.now-live-canvas', { timeout: 30000 });
await page.waitForTimeout(1500);

if (IOS) {
  await page.addStyleTag({
    content: `
      :root { --sab: ${BOTTOM}px; }
      .app-header { padding-top: calc(24px + ${TOP}px) !important; }
      .now-live-content { padding-top: calc(24px + ${TOP}px) !important; }
      .schedule-masthead { padding-top: calc(24px + ${TOP}px) !important; }
      .archive-detail-header { padding-top: calc(8px + ${TOP}px) !important; }
    `,
  });
  await page.waitForTimeout(300);
}

if (process.env.FORCE_NARROW) {
  await page.evaluate(() => {
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = [...sheet.cssRules]; } catch { continue; } // cross-origin sheets (Google Fonts) cannot be read
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule && /max-width:\s*24\.99rem/.test(rule.conditionText)) {
          css.push(...[...rule.cssRules].map((r) => r.cssText));
        }
      }
    }
    css.push('.station-grid{grid-template-columns:minmax(0,1fr)}'); // the two-column tiles start at 400 pt
    const tag = document.createElement('style');
    tag.textContent = css.join('\n');
    document.head.appendChild(tag);
  });
  await page.waitForTimeout(300);
}

const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};
const scrollTo = (y) => page.evaluate((v) => { document.querySelector('.app-scroll').scrollTop = v; }, y);
const tab = async (label) => { await page.click(`.tab-dock button:text-is("${label}")`); await page.waitForTimeout(600); };

await shot('now-top');
await scrollTo(10000);
await shot('now-bottom');

await tab('SCHEDULE');
await shot('schedule-today');
await scrollTo(0);
await shot('schedule-top');
await scrollTo(10000);
await shot('schedule-bottom');
await scrollTo(0);
await page.click('.schedule-show-row >> nth=2');
await page.waitForTimeout(600);
await shot('show-top');
await scrollTo(10000);
await shot('show-bottom');

await tab('STATION');
await scrollTo(0);
await shot('station-hub-top');
await scrollTo(10000);
await shot('station-hub-bottom');
const pages = [
  ['about', '.station-row-link:has-text("About WJRH")'],
  ['history', '.station-row-link:has-text("History")'],
  ['team', '.station-row-link:has-text("Leadership team")'],
  ['contact', '.station-row-link:has-text("Contact & follow")'],
  ['events', '.station-tile.wide'],
  ['involved', '.station-tile:has-text("Get involved")'],
  ['support', '.station-tile:has-text("Support WJRH")'],
];
for (const [slug, selector] of pages) {
  await scrollTo(0);
  await page.click(selector);
  await page.waitForTimeout(500);
  await scrollTo(0);
  await shot(`station-${slug}-top`);
  await scrollTo(10000);
  await shot(`station-${slug}-bottom`);
  await page.click('.station-back');
  await page.waitForTimeout(400);
}
await browser.close();
