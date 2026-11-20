import { chromium } from 'playwright';
const EXE = '/home/surf/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:3000/');
await p.locator('textarea').first().fill(process.argv[2]);
await p.getByRole('button', { name: 'Check this home' }).click();
const state = await Promise.race([
  p.getByText('Good news').first().waitFor({ timeout: 120000 }).then(() => 'report'),
  p.getByText(/No San Francisco parcel/).first().waitFor({ timeout: 120000 }).then(() => 'not_found'),
  p.getByText(/couldn't load/i).first().waitFor({ timeout: 120000 }).then(() => 'CRASH'),
]).catch(() => 'TIMEOUT');
const bad = state === 'CRASH' || state === 'TIMEOUT' || errs.length;
console.log(bad ? 'SMOKE FAIL' : 'smoke ok', state, process.argv[2].slice(0, 40), JSON.stringify(errs).slice(0, 300));
await p.screenshot({ path: '../uncached.png' }); await b.close();
