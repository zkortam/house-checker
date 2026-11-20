import { chromium } from 'playwright';
const out = process.argv[2];
const EXE = '/home/surf/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE });
async function run(ex, size, theme, fn) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('hc-theme', t); } catch {} }, theme);
  const p = await ctx.newPage();
  const L = { 'Try 57 Carmelita St': 'Example listing: 57 Carmelita St, San Francisco. Duboce Park Victorian, fully renovated 2026. 3 bed, 3 bath, about 2,700 sq ft, garden in-law. Offered at $3,295,000.',
    'Try 2055 42nd Ave': 'Example listing: 2055 42nd Ave, San Francisco. Fully remodeled Sunset home with a legal in-law. 2 units, 3 bed, 4 bath, about 2,000 sq ft. Offered at $1,595,000.' };
  await p.goto('http://localhost:3000/'); await p.locator('#listing').fill(L[ex]);
  await p.getByRole('button', { name: 'Check this home' }).click();
  await p.getByText('Good news').first().waitFor({ timeout: 120000 }); await p.waitForTimeout(1200);
  await fn(p); await ctx.close();
}
const D = { width: 1440, height: 900 };
await run('Try 57 Carmelita St', D, 'dark', async (p) => {
  await p.screenshot({ path: `${out}/1-verdict-and-tiles.png` });
  await p.mouse.wheel(0, 330); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/2-listing-vs-city.png` });
  await p.getByText('Ask before you offer').first().scrollIntoViewIfNeeded(); await p.mouse.wheel(0, -60); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Request a visit' }).first().click(); await p.waitForTimeout(800);
  await p.locator('button.slot').first().click(); await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/3-specialist-request-confirm.png` });
});
await run('Try 2055 42nd Ave', { width: 390, height: 844 }, 'light', async (p) => {
  await p.screenshot({ path: `${out}/4-phone-2055.png` });
});
await b.close(); console.log('ok');
