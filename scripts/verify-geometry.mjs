/**
 * Drives the built app in headless Chromium to verify the geometry features:
 * places new primitives, enters edit mode, selects all faces, extrudes.
 * Usage: node scripts/verify-geometry.mjs <url> <outDir>
 */
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = process.argv[3] ?? '/tmp';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3000));

const clickButton = async (label) => {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(text));
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }, label);
  if (!clicked) throw new Error(`button not clickable: ${label}`);
  await new Promise((r) => setTimeout(r, 400));
};

// 1. place new primitives
await clickButton('Arc Ramp');
await clickButton('Stairs');
await clickButton('Half-pipe');
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${outDir}/geo1-primitives.png` });

// 2. enter edit mode on the last-added mesh (half-pipe is selected)
await clickButton('Edit Mesh');
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${outDir}/geo2-editmode.png` });

// 3. select all faces + subdivide + extrude
await clickButton('All');
await page.screenshot({ path: `${outDir}/geo3-selected.png` });
await clickButton('Extrude');
await new Promise((r) => setTimeout(r, 500));
await clickButton('Done');
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${outDir}/geo4-done.png` });

// report state
const state = await page.evaluate(() => {
  const counter = [...document.querySelectorAll('.save-state')].map((e) => e.textContent).join(' | ');
  return { counter, buttons: [...document.querySelectorAll('.edit-toolbar button')].length };
});
console.log('state:', JSON.stringify(state));
console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
