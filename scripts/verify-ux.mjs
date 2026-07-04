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

const click = async (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

// add a banana bunch
await click('Bunch');
await new Promise((r) => setTimeout(r, 500));
// verify it exists with variant bunch via the inspector select
const bunchInfo = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.textContent.includes('Bunch')),
  );
  return sel ? sel.value : 'no-banana-select';
});
console.log('banana select value after adding Bunch:', bunchInfo);
await page.screenshot({ path: `${outDir}/ux1-bunch.png` });

// open shortcuts with '?'
await page.keyboard.press('Escape');
await page.keyboard.down('Shift');
await page.keyboard.press('Slash');
await page.keyboard.up('Shift');
await new Promise((r) => setTimeout(r, 400));
const modalOpen = await page.evaluate(() => !!document.querySelector('.shortcuts-modal'));
console.log('shortcuts modal open:', modalOpen);
await page.screenshot({ path: `${outDir}/ux2-shortcuts.png` });

console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
