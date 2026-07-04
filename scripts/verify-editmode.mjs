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
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === txt || x.textContent.includes(txt));
    if (b) b.click();
    return !!b;
  }, t);

// select Floor, enter edit mode, go top view
await page.evaluate(() => {
  [...document.querySelectorAll('.outliner-row')].find((r) => r.textContent.includes('Floor'))?.click();
});
await new Promise((r) => setTimeout(r, 200));
await clickText('Edit Mesh');
await new Promise((r) => setTimeout(r, 500));
await clickText('Top');
await new Promise((r) => setTimeout(r, 600));

// activate box select and drag a rectangle across the middle of the viewport
await clickText('Box');
await new Promise((r) => setTimeout(r, 200));
const boxActive = await page.evaluate(() =>
  [...document.querySelectorAll('.edit-toolbar button')].some((b) => b.textContent.includes('Box') && b.classList.contains('active')),
);
console.log('box select active:', boxActive);

await page.mouse.move(560, 300);
await page.mouse.down();
await page.mouse.move(760, 620, { steps: 12 });
await new Promise((r) => setTimeout(r, 150));
await page.screenshot({ path: `${outDir}/edit-boxdrag.png` });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 300));

const faceHighlight = await page.evaluate(() => {
  // face-highlight mesh present means faces got selected
  return document.querySelectorAll('canvas').length;
});
await page.screenshot({ path: `${outDir}/edit-boxresult.png` });

// switch to Rotate mode to confirm gizmo mode buttons
await clickText('Rot');
await new Promise((r) => setTimeout(r, 300));
const rotActive = await page.evaluate(() =>
  [...document.querySelectorAll('.edit-toolbar button')].some((b) => b.textContent.trim() === 'Rot' && b.classList.contains('active')),
);
console.log('rotate mode active:', rotActive, '| canvases:', faceHighlight);
await page.screenshot({ path: `${outDir}/edit-rotate.png` });
console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
