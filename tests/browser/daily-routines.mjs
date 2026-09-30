// A scripted household day with real key presses (disposable headless Edge, 390x844 @3x):
// morning teeth, clothes and the whole breakfast chain (the dropped-egg path, with the paper
// towel), a reload mid-breakfast that restores the props, school, then night teeth, clothes,
// the bedtime book and bed — waking on day 2. Each routine pays $1 once.
// Adapted from PlayCanvas scripts/daily-browser-test.mjs.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
let url = process.env.THREE_URL, server;
if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5226, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 const ready = () => page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.cleanup, undefined, {timeout: 120000});
 await page.goto(url); await ready();
 const snap = () => page.evaluate(() => window.__player.snapshot());
 const standBy = id => page.evaluate(id => {
  const s = window.__player.session(), t = s.chores.props.interactions.find(t => t.id === id), m = s.movement;
  for (const r of [.3, .45, .6, .75, .2, .9]) for (let a = 0; a < 24; a++) {
   const x = t.anchor.x + Math.sin(a * Math.PI / 12) * r, z = t.anchor.z + Math.cos(a * Math.PI / 12) * r;
   if (!m.blocked(x, z) && Math.hypot(x - t.anchor.x, z - t.anchor.z) < t.range - .05) { m.place(x, z); return; }
  }
  throw Error('no free spot by ' + id);
 }, id);
 const idle = () => page.waitForFunction(() => { const c = window.__player.snapshot().cleanup; return !c.aligning && !c.working && !window.__player.session().animator.busy; }, undefined, {timeout: 12000});
 const doIt = async (id, {hold = false} = {}) => {
  await standBy(id);
  await page.waitForFunction(id => document.querySelector('#action-button')?.dataset.target === id, id, {timeout: 5000})
   .catch(async () => { throw Error(`${id} not offered (focus ${(await snap()).cleanup.focus})`); });
  if (hold) { await page.keyboard.down('Space'); await page.waitForFunction(() => window.__player.snapshot().cleanup.working, undefined, {timeout: 4000}); await page.waitForFunction(() => !window.__player.snapshot().cleanup.working, undefined, {timeout: 6000}); await page.keyboard.up('Space'); }
  else { await page.keyboard.press('Space'); await page.waitForTimeout(80); }
  await idle();
 };
 const day = async () => (await snap()).day;
 let d = await day();
 assert.deepEqual([d.day, d.phase, d.tasks], [1, 'morning', ['teeth', 'outfit', 'breakfast']]);
 const money = d.balance;

 // Teeth: the brushing motion plays while it counts.
 await standBy('daily-teeth'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'daily-teeth');
 await page.keyboard.press('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.workClip === 'BrushTeeth', undefined, {timeout: 4000});
 await page.waitForTimeout(700); await page.screenshot({path: resolve(out, 'day-10-teeth.png')});
 await idle();
 d = await day(); assert.ok(d.done.includes('teeth')); assert.equal(d.balance, money + 1);
 // Clothes: pick from the drawers, get dressed by the bed.
 await doIt('choose-clothes'); assert.equal((await snap()).cleanup.carrying, 'daily-outfit');
 await doIt('get-dressed'); d = await day(); assert.ok(d.done.includes('outfit')); assert.equal((await snap()).cleanup.carrying, null);
 // Breakfast, the dropped-egg path.
 await page.evaluate(() => { window.__player.session().day.state.eggDrop = true; });
 await doIt('take-egg'); assert.equal((await snap()).cleanup.carrying, 'breakfast-egg');
 await doIt('crack-egg'); await page.waitForTimeout(600);
 d = await day(); assert.equal(d.breakfast, 'spill');
 assert.equal(await page.evaluate(() => window.__player.session().chores.routines.eggSpill.visible), true, 'the egg dropped');
 await doIt('take-towel'); assert.equal((await snap()).cleanup.carrying, 'paper-towel');
 await standBy('wipe-egg'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'wipe-egg');
 await page.keyboard.down('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.workClip === 'Wipe', undefined, {timeout: 4000});
 await page.waitForTimeout(500); await page.screenshot({path: resolve(out, 'day-11-wipe.png')});
 await page.waitForFunction(() => window.__player.snapshot().day.breakfast === 'cook', undefined, {timeout: 4000});
 await page.keyboard.up('Space'); await idle();
 assert.equal((await snap()).cleanup.carrying, null, 'the towel is used up');
 await doIt('cook-egg');
 d = await day(); assert.deepEqual([d.breakfast, d.breakfastAtTable, (await snap()).cleanup.carrying], ['serve', false, 'breakfast-plate']);
 assert.equal((await snap()).animation.state.startsWith('Carry'), true);

 // Reload while carrying the plate: breakfast waits on the stove to be carried again.
 await page.reload(); await ready();
 d = await day(); assert.deepEqual([d.breakfast, d.breakfastAtTable], ['serve', false]);
 await doIt('take-breakfast'); assert.equal((await snap()).cleanup.carrying, 'breakfast-plate');
 assert.equal(await page.evaluate(() => window.__player.session().movement.speed), 1.65, 'a full plate is carried at a walk');
 await doIt('serve-breakfast'); d = await day(); assert.equal(d.breakfastAtTable, true);
 await standBy('eat-breakfast'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'eat-breakfast');
 await page.keyboard.press('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.seated, undefined, {timeout: 4000});
 await page.waitForTimeout(1500); const eating = await snap(); await page.screenshot({path: resolve(out, 'day-12-breakfast.png')});
 assert.equal(eating.cleanup.workClip, 'EatSit'); assert.equal(eating.cleanup.heightOverride, .07);
 await idle();
 d = await day(); assert.ok(d.done.includes('breakfast')); assert.equal(d.balance, money + 3, 'three morning routines paid');
 assert.equal((await snap()).cleanup.seated, false, 'up from the table');

 // School: the front door, a short interlude, home in the afternoon.
 assert.equal(d.ready, true);
 await doIt('school-door');
 d = await day(); assert.equal(d.phase, 'school');
 assert.equal(await page.locator('#school-transition').isVisible(), true);
 await page.screenshot({path: resolve(out, 'day-13-school.png')});
 await page.waitForFunction(() => window.__player.snapshot().day.phase === 'afternoon', undefined, {timeout: 8000});
 d = await day(); assert.ok(d.minutes >= 900 && d.minutes < 901, `afternoon starts at 3:00 (${d.minutes})`); assert.deepEqual(d.done, []);
 assert.equal(await page.locator('#school-transition').isVisible(), false);

 // Night (afternoon chores land in slice 4): teeth, clothes away, a book, then bed.
 await page.evaluate(() => { const s = window.__player.session(); Object.assign(s.day.state, {phase: 'night', minutes: 1140, done: []}); s.chores.dayChanged(); });
 await doIt('daily-teeth');
 await doIt('night-clothes'); assert.equal((await snap()).cleanup.carrying, 'daily-outfit');
 await doIt('clothes-drawer');
 await standBy('bedtime-book'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'bedtime-book');
 await page.keyboard.press('Space');
 await page.waitForFunction(() => window.__player.session().chores.routines.book.visible, undefined, {timeout: 4000});
 await page.screenshot({path: resolve(out, 'day-14-reading.png')});
 await idle();
 d = await day(); assert.deepEqual(d.done.sort(), ['outfit', 'read', 'teeth']); assert.equal(d.balance, money + 6);
 assert.match(d.hint, /Walk to your bed/);
 await standBy('sleep'); await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'sleep');
 await page.keyboard.press('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.workClip === 'Sleep', undefined, {timeout: 6000});
 const asleep = await snap(); await page.screenshot({path: resolve(out, 'day-15-asleep.png')});
 assert.ok(asleep.cleanup.heightOverride > .8, `on the mattress (${asleep.cleanup.heightOverride})`);
 await page.waitForFunction(() => window.__player.snapshot().day.day === 2, undefined, {timeout: 8000});
 d = await day();
 assert.deepEqual([d.day, d.phase, d.done], [2, 'morning', []]); assert.ok(d.minutes < 421, `a fresh 7:00 morning (${d.minutes})`);
 assert.equal(d.balance, money + 6, 'nothing paid twice');
 const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.daily.v1')));
 assert.equal(stored.day, 2);
 await page.waitForTimeout(400); await idle();
 assert.equal((await snap()).cleanup.seated, false, 'awake and up');
 assert.deepEqual(errors, []);
 console.log('PASS daily-routines:', JSON.stringify({paid: d.balance - money, day: d.day}));
} finally { await browser.close(); await server?.close(); }
