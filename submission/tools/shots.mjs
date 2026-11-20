import { chromium } from 'playwright';
const out = process.argv[2];
const EXE = '/home/surf/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE });
async function run(ex, size, theme, fn) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('hc-theme', t); } catch {} }, theme);
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/'); await p.getByRole('button', { name: ex }).click();
  await p.getByRole('button', { name: 'Check this home' }).click();
  await p.getByText('Good news').first().waitFor({ timeout: 120000 }); await p.waitForTimeout(1200);
  await fn(p); await ctx.close();
}
const D = { width: 1440, height: 900 };
await run('Try 57 Carmelita St', D, 'dark', async (p) => {
  await p.mouse.wheel(0, 150); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/1-verdict-and-tiles.png` });
  const lv = p.getByText('Listing vs city records').first(); await lv.scrollIntoViewIfNeeded(); await p.mouse.wheel(0, 300); await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/2-listing-vs-city.png` });
  await p.getByRole('button', { name: 'Request a visit' }).first().click(); await p.waitForTimeout(800);
  await p.locator('button.slot').first().click(); await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/3-specialist-request-confirm.png` });
});
await run('Try 2055 42nd Ave', { width: 390, height: 844 }, 'light', async (p) => {
  await p.screenshot({ path: `${out}/4-phone-2055.png` });
});
await b.close(); console.log('ok');
