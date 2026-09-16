import { chromium } from 'playwright';
const [,, url, out, widthArg, mode, scrollArg] = process.argv;
const width = Number(widthArg ?? 1440);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width, height: width < 700 ? 880 : 1000 },
  deviceScaleFactor: width < 700 ? 2 : 1.5,
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
if (scrollArg) {
  await page.evaluate((y) => window.scrollTo(0, Number(y)), scrollArg);
  await page.waitForTimeout(900);
}
await page.waitForTimeout(900);
await page.screenshot({ path: out, fullPage: mode === 'full' });
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.slice(0,8).join('\n') : 'no console errors');
console.log('doc height:', await page.evaluate(() => document.body.scrollHeight));
await browser.close();
