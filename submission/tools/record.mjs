// Records the House Checker demo against the real app (http://localhost:3000, real mode).
// Usage: node record.mjs <outDir> desktop|mobile
import { chromium } from 'playwright';
import fs from 'node:fs';

const [outDir, mode] = process.argv.slice(2);
const BASE = 'http://localhost:3000';
const EXE = '/home/surf/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const size = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
fs.mkdirSync(`${outDir}/${mode}`, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({
  viewport: size, deviceScaleFactor: 1, colorScheme: mode === 'mobile' ? 'light' : 'dark',
  recordVideo: { dir: `${outDir}/${mode}`, size },
  hasTouch: mode === 'mobile', isMobile: mode === 'mobile',
});
// Caption overlay for the video only (not part of the app).
await ctx.addInitScript(() => {
  window.__cap = (text) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div'); el.id = '__cap';
      Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 2147483647,
        maxWidth: 'min(92vw, 760px)', padding: '12px 18px', borderRadius: '14px', background: 'rgba(17,17,20,0.92)', color: '#fff',
        font: '600 17px/1.4 Inter, system-ui, sans-serif', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', pointerEvents: 'none', transition: 'opacity 200ms' });
      document.documentElement.appendChild(el);
    }
    el.textContent = text; el.style.opacity = text ? '1' : '0';
  };
});
// Theme: the app defaults to dark on first visit; force the scheme we want per mode.
await ctx.addInitScript((t) => { try { localStorage.setItem('hc-theme', t); } catch {} }, mode === 'mobile' ? 'light' : 'dark');

const page = await ctx.newPage();
const cap = (t) => page.evaluate((x) => window.__cap?.(x), t).catch(() => {});
const wait = (ms) => page.waitForTimeout(ms);
async function scrollBy(px, steps = 12, pause = 60) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await wait(pause); } }
async function scrollTo(locator, offset = 90) {
  const box = await locator.boundingBox(); if (!box) return;
  await scrollBy(box.y - offset, 16, 45);
}
async function nudgeSlider() {
  const sl = (await page.locator('#hc-price').count()) ? page.locator('#hc-price') : page.locator('input[type=range]').first(); if (!(await sl.count())) return;
  await sl.focus(); for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowLeft'); await wait(220); }
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await wait(220); }
}
async function runCheck(exampleName, captionWhileRunning) {
  await page.goto(BASE + '/'); await wait(600);
  const L = { 'Try 57 Carmelita St': 'Example listing: 57 Carmelita St, San Francisco. Duboce Park Victorian, fully renovated 2026. 3 bed, 3 bath, about 2,700 sq ft, garden in-law. Offered at $3,295,000.',
    'Try 2055 42nd Ave': 'Example listing: 2055 42nd Ave, San Francisco. Fully remodeled Sunset home with a legal in-law. 2 units, 3 bed, 4 bath, about 2,000 sq ft. Offered at $1,595,000.' };
  const box = (await page.locator('#listing').count()) ? page.locator('#listing') : page.locator('textarea').first();
  await box.click(); await box.fill(''); await box.pressSequentially(L[exampleName] ?? exampleName, { delay: 6 }); await wait(700);
  await page.getByRole('button', { name: 'Check this home' }).click();
  await page.waitForURL(/\/check\//, { timeout: 30000 });
  await cap(captionWhileRunning);
  await page.getByText('Good news').first().waitFor({ timeout: 120000 });
  await wait(600);
}

if (mode === 'desktop') {
  const T = async (fn) => { try { await fn(); } catch (e) { console.log('skip:', String(e).split('\n')[0].slice(0, 120)); } };
  const click = (loc) => loc.first().click({ timeout: 4000 });
  await page.goto(BASE + '/'); await wait(400);
  await cap("House Checker: paste a San Francisco listing, get what the city's records say about it."); await wait(3500);
  await cap("23% of SF homes have had a complaint for unpermitted work. The listing won't tell you which."); await wait(3500);

  // 57 Carmelita St: the one with problems.
  await runCheck('Try 57 Carmelita St', 'Live steps: 15+ city datasets read in parallel, real counts, nothing invented.');
  await cap('Verdict in plain words: 0 of 5 listing claims match the city.'); await wait(4500);
  await scrollBy(420); await cap('Listing vs City side by side, and what it really costs to own each month.'); await wait(4000);
  await T(async () => { await click(page.locator('button.claim').nth(1)); await wait(900); await cap('Tap any row for the why, with links to the records.'); await wait(3500); await page.keyboard.press('Escape'); await wait(700); });
  await T(async () => { await cap('Move the price: taxes recompute.'); await nudgeSlider(); await wait(1200); });
  await scrollBy(380); await cap('At a glance: open cases, tenants, hazards, room to grow.'); await wait(3500);
  await T(async () => { await scrollTo(page.getByText('Ask before you offer').first(), 80); });
  await cap('For each unknown, the cheapest way to settle it: the agent, the city, or a specialist.'); await wait(3500);

  await T(async () => {
    await click(page.getByRole('button', { name: 'Request a visit' })); await wait(1200);
    await cap('Only a site visit can say whether the excavation is sound, so it proposes a structural engineer.');
    await click(page.locator('button.slot')); await wait(1200);
    await click(page.getByRole('button', { name: 'Continue' })); await wait(1500);
    await cap('Outward-facing, so it asks first: who, when, scope and price.'); await wait(2500);
    await click(page.getByRole('button', { name: 'Send request' })); await wait(2500);
    await cap('Request email with a calendar invite sent to the specialist (demo outbox).'); await wait(2500);
  });
  await T(async () => {
    await click(page.getByRole('button', { name: 'Email the listing agent' })); await wait(1200);
    await cap('Questions drafted from the findings: the complaints, the permits, the garden in-law.');
    const to = page.getByRole('dialog').getByLabel('To');
    await (await to.count() ? to : page.locator('dialog input[type=email]').first()).pressSequentially('listing.agent@example.com', { delay: 25 });
    await wait(2500);
    await click(page.getByRole('button', { name: 'Send', exact: true }));
    await cap('Held for 5 seconds with Undo, then sent once (idempotent).'); await wait(6500);
  });
  await scrollBy(600); await cap('Good news, what is worth a look, building systems and a timeline.'); await wait(4000);
  await scrollBy(700); await cap('Every action the agent took is logged with the report.'); await wait(3500);

  // 2055 42nd Ave: no false alarms.
  await runCheck('Try 2055 42nd Ave', 'No false alarms: the assessor says 1 unit and 1 bath. Permits say otherwise.');
  await cap('"Looks solid": the in-law was legalized in 2025 and the tax roll is simply behind.'); await wait(4500);
  await T(async () => {
    const cite = page.locator('button.cite');
    if (await cite.count()) { await cite.first().scrollIntoViewIfNeeded(); await click(cite); }
    else { const sb = page.getByRole('button', { name: /^\d+ sources$/ }); await sb.first().scrollIntoViewIfNeeded(); await click(sb); await wait(900); await page.getByRole('button', { name: /^Show \d+ sources$/ }).first().click({ timeout: 3000 }).catch(() => {}); }
    await wait(1200); await cap('Every number links to its record: open the exact city record.'); await wait(4000);
    await page.keyboard.press('Escape'); await wait(800);
  });
  await scrollBy(560); await cap('Also found: a 2020 tenant buyout, a short-term rental registration, a reservoir zone.'); await wait(4000);
  await scrollBy(700); await cap('Fair housing by design: no crime, school or demographic data.'); await wait(3500);
  await cap(''); await wait(500);
} else {
  await runCheck('Try 2055 42nd Ave', 'On a phone: the same report, built for a first-time buyer.');
  await cap('Verdict, then six tiles you can tap.'); await wait(3500);
  await scrollBy(520); await wait(2500);
  await page.getByText('Open city cases').first().click({ timeout: 3000 }).catch(() => {}); await wait(1500);
  await cap('Tap a tile for the details behind it.'); await wait(3000);
  await page.keyboard.press('Escape'); await wait(800);
  await cap('Price slider: taxes recompute as you move it.'); await nudgeSlider().catch(() => {}); await wait(2500);
  await cap('House Checker. City records, plain words, and the next step taken for you.'); await wait(4000);
}

await ctx.close(); await browser.close();
console.log('recorded', mode);
