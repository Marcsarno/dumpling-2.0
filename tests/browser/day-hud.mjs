// The household day and HUD in play (disposable headless Edge, 390x844 @3x): the card shows
// day, time, room and today's count; the clock runs at home and pauses in dialogs and shops;
// a chore pays $1 once and ticks the journal; a reload resumes the same day from daily.v1.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
let url = process.env.THREE_URL, server;
if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5223, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 const ready = () => page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.pup, undefined, {timeout: 120000});
 await page.goto(url); await ready();
 const day = () => page.evaluate(() => window.__player.snapshot().day);
 const text = sel => page.locator(sel).textContent();
 assert.equal(await text('#adventure-place'), 'Bedroom');
 assert.match(await text('#adventure-time'), /^Day 1 · 7:0\d AM$/);
 assert.equal(await text('#adventure-count'), '0/3'); assert.equal(await text('#adventure-balance'), '$0');
 assert.equal(await page.locator('.adventure-timer').isVisible(), false, 'no round timer in daily life');

 // The clock runs at home: about 2 game minutes in 4 s.
 const t0 = (await day()).minutes; await page.waitForTimeout(4000); const t1 = (await day()).minutes;
 assert.ok(t1 - t0 > 1.6 && t1 - t0 < 2.6, `clock ran ${(t1 - t0).toFixed(2)} min`);
 // …and pauses while the journal is open.
 await page.click('#adventure-today'); await page.waitForTimeout(200);
 const j0 = (await day()).minutes; await page.waitForTimeout(2000); const j1 = (await day()).minutes;
 assert.equal(j1, j0, 'paused in the journal');
 await page.screenshot({path: resolve(out, 'day-00-journal.png')});
 await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
 assert.ok((await day()).minutes > j1, 'resumes after closing');
 // …and in shops.
 await page.evaluate(() => window.__roomTest.show('store-corner')); await page.waitForTimeout(300);
 assert.equal(await text('#adventure-place'), 'Clover Corner');
 const s0 = (await day()).minutes; await page.waitForTimeout(1500);
 assert.equal((await day()).minutes, s0, 'paused in a shop');
 await page.evaluate(() => window.__roomTest.show('house')); await page.waitForTimeout(300);

 // A chore pays $1 once and ticks the journal.
 const paid = await page.evaluate(() => { const d = window.__player.session().day; return [d.complete('teeth'), d.complete('teeth')]; });
 assert.deepEqual(paid, [true, false]);
 await page.waitForTimeout(200);
 assert.equal(await text('#adventure-balance'), '$1'); assert.equal(await text('#adventure-count'), '1/3');
 await page.screenshot({path: resolve(out, 'day-01-chore.png')});

 // Reload: the same day, time and chore come back from dumpling.three.daily.v1.
 const before = await day();
 const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.daily.v1')));
 assert.deepEqual(stored.done, ['teeth']);
 await page.reload(); await ready();
 const after = await day();
 assert.equal(after.day, 1); assert.deepEqual(after.done, ['teeth']); assert.equal(after.balance, 1);
 assert.ok(Math.abs(after.minutes - before.minutes) < 1.5, `resumed at ${after.minutes.toFixed(1)} (was ${before.minutes.toFixed(1)})`);
 assert.ok(!(await page.evaluate(() => Object.keys(localStorage))).some(k => k.startsWith('arianna.')), 'no arianna.* keys');
 assert.deepEqual(errors, []);
 console.log('PASS day-hud:', JSON.stringify({ran: +(t1 - t0).toFixed(2), resumed: +after.minutes.toFixed(1), clock: after.clock, balance: after.balance}));
} finally { await browser.close(); await server?.close(); }
