import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// The Next dev overlay portal sits above the page and swallows clicks.
await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
await page.addInitScript(() => {
  const hide = () => {
    const el = document.querySelector('nextjs-portal');
    if (el) el.style.display = 'none';
  };
  new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
});
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// 1. Unauthenticated /admin must redirect to login.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
console.log('1. /admin while signed out ->', new URL(page.url()).pathname + new URL(page.url()).search);

// 2. Sign in.
await page.fill('input[name="email"]', process.env.ADMIN_EMAIL);
await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
console.log('2. after sign-in ->', new URL(page.url()).pathname);

// 3. Dashboard content.
await page.waitForLoadState('networkidle');
const heading = await page.locator('h1').first().textContent();
const metrics = await page.locator('main p.num-stat-xl').allTextContents();
console.log('3. heading:', heading?.trim(), '| metrics:', metrics.map(m => m.trim()).join(' / '));

await page.screenshot({ path: '/tmp/admin-dash.png' });

// 4. Sign out returns to login and re-protects /admin.
// Submit the sign-out form directly; the dev overlay portal blocks real clicks.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Sign out'));
  btn?.closest('form')?.requestSubmit(btn);
});
await page.waitForURL('**/login**', { timeout: 30000 });
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
console.log('4. after sign-out, /admin ->', new URL(page.url()).pathname);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
