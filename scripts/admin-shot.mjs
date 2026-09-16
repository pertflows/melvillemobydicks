import { chromium } from 'playwright';
const [,, path, out, widthArg] = process.argv;
const width = Number(widthArg ?? 1280);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width, height: width < 700 ? 900 : 950 }, deviceScaleFactor: width < 700 ? 2 : 1.5 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('input[name="email"]', process.env.ADMIN_EMAIL);
await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await page.click('button[type="submit"]', { force: true });
// A server-action redirect updates the route without firing a load event,
// so wait for the destination's chrome rather than for navigation.
try {
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 });
} catch {
  const alert = await page.locator('[role="alert"]').allTextContents();
  console.log('LOGIN DID NOT NAVIGATE. url=', page.url(), 'alert=', JSON.stringify(alert));
  await page.screenshot({ path: '/tmp/login-debug.png' });
  process.exit(1);
}
await page.waitForLoadState('networkidle');
await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
await page.evaluate(() => { const el = document.querySelector('nextjs-portal'); if (el) el.remove(); });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0,6).join('\n') : 'no console errors');
await browser.close();
