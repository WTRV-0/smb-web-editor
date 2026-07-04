import puppeteer from 'puppeteer-core';
const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = process.argv[3] ?? '/tmp';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3000));

const clickText = (t) =>
  page.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === txt);
    if (b) b.click();
    return !!b;
  }, t);

// Top orthographic view
await clickText('Top');
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${outDir}/cam-top.png` });
const proj = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.view-controls button')].pop();
  return b?.textContent;
});
console.log('projection button label after Top:', proj);

// Select the floor mesh in the outliner, then open numeric transform via Enter
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.outliner-row')].find((r) => r.textContent.includes('Floor'));
  row?.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 300));
const numericOpen = await page.evaluate(() => !!document.querySelector('.numeric-transform'));
console.log('numeric transform open:', numericOpen);
await clickText('3D');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${outDir}/cam-numeric.png` });

console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
