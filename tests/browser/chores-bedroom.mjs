// The bedroom tidy round with real key presses (disposable headless Edge, 390x844 @3x):
// prompts, walk-ups, pick up / put away through the carry socket, the crayon tap, the vacuum
// hold (released early it resets), the $1-per-task + $2 bonus, one-time payment, and replay.
// Adapted from PlayCanvas scripts/cleanup-browser-test.mjs and house-chore-browser-test.mjs
// (their replay-at-home check predates round scattering and no longer holds in PlayCanvas either).
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
let url = process.env.THREE_URL, server;
if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5224, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 await page.goto(url);
 await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.cleanup, undefined, {timeout: 120000});
 const snap = () => page.evaluate(() => window.__player.snapshot());
 const cleanup = async () => (await snap()).cleanup;
 // Stand free near a target, then wait until the button offers it.
 const standBy = async (id, dx = 0, dz = .55) => page.evaluate(([id, dx, dz]) => {
  const s = window.__player.session(), t = s.chores.props.interactions.find(t => t.id === id), m = s.movement;
  for (const r of [0, .1, .2, .3, .4, .5]) for (let a = 0; a < 16; a++) {
   const x = t.anchor.x + dx + Math.sin(a * Math.PI / 8) * r, z = t.anchor.z + dz + Math.cos(a * Math.PI / 8) * r;
   if (!m.blocked(x, z) && Math.hypot(x - t.anchor.x, z - t.anchor.z) < t.range - .05) { m.place(x, z); return [x, z]; }
  }
  throw Error('no free spot by ' + id);
 }, [id, dx, dz]);
 const focus = id => page.waitForFunction(id => document.querySelector('#action-button')?.dataset.target === id, id, {timeout: 5000});
 const idle = () => page.waitForFunction(() => { const c = window.__player.snapshot().cleanup; return !c.aligning && !c.working && !window.__player.session().animator.busy; }, undefined, {timeout: 8000});
 const tap = async () => { await page.keyboard.press('Space'); await page.waitForTimeout(80); await idle(); };

 // Choose the bedroom round from the menu.
 await page.click('#adventure-menu-open'); await page.click('.adventure-activities summary'); await page.click('#mission-bedroom');
 let c = await cleanup();
 assert.deepEqual([c.mode, c.state, c.timed, c.tasks], ['bedroom', 'ready', true, ['teddy', 'shirt', 'book', 'crayons', 'dirt']]);
 assert.equal(await page.locator('.adventure-timer').isVisible(), true, 'round timer shown');
 assert.equal(await page.locator('#action-button').isDisabled(), true);
 const balance0 = (await snap()).day.balance;

 // Teddy → toy chest.
 await standBy('pickup-teddy'); await focus('pickup-teddy');
 assert.equal(await page.locator('#action-title').textContent(), 'Pick up');
 await page.keyboard.press('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.aligning || window.__player.session().animator.busy, undefined, {timeout: 3000});
 await idle();
 c = await cleanup();
 assert.equal(c.carrying, 'teddy'); assert.equal(c.carriedParent, 'Carry socket'); assert.equal(c.state, 'running');
 const p = (await snap()).position;
 assert.ok(Math.hypot(c.carriedPosition[0] - p[0], c.carriedPosition[2] - p[2]) < .6, 'teddy is in her hands');
 assert.equal((await snap()).animation.state, 'CarryIdle');
 await page.screenshot({path: resolve(out, 'chores-00-carrying.png')});
 // A pickup nearby is not offered while her hands are full.
 await standBy('pickup-shirt');
 await page.waitForTimeout(150);
 assert.equal(await page.locator('#action-button').isDisabled(), true, 'hands full');
 await standBy('toy-chest'); await focus('toy-chest');
 assert.equal(await page.locator('#action-title').textContent(), 'Put away');
 await tap();
 c = await cleanup();
 assert.equal(c.carrying, null); assert.deepEqual(c.completed, ['teddy']); assert.equal(c.allowance, 1);
 const teddy = c.items.find(i => i.id === 'teddy'), chest = await page.evaluate(() => window.__player.session().chores.props.interactions.find(t => t.id === 'toy-chest').placement);
 assert.ok(Math.hypot(teddy.position[0] - chest[0], teddy.position[2] - chest[2]) < .01, 'teddy set in the chest');
 await page.keyboard.press('Space'); await page.waitForTimeout(300);
 assert.equal((await cleanup()).allowance, 1, 'pressing again adds nothing');

 // Shirt → hamper, book → bookshelf.
 for (const [pick, place, task] of [['pickup-shirt', 'hamper', 'shirt'], ['pickup-book', 'bookshelf', 'book']]) {
  await standBy(pick); await focus(pick); await tap();
  assert.equal((await cleanup()).carrying, task);
  await standBy(place); await focus(place); await tap();
  assert.ok((await cleanup()).completed.includes(task), `${task} put away`);
 }
 // Crayons: one tap tidies them into their cup.
 await standBy('crayons', 0, .3); await focus('crayons');
 assert.equal(await page.locator('#action-title').textContent(), 'Tidy up');
 await page.keyboard.press('Space'); await page.waitForTimeout(700); await idle();
 c = await cleanup(); assert.ok(c.completed.includes('crayons')); assert.equal(c.allowance, 4);
 assert.deepEqual(await page.evaluate(() => { const p = window.__player.session().chores.props; return [p.crayonMess.visible, p.tidyCrayons.visible]; }), [false, true]);

 // Vacuum: fetch it, then hold at the dirt. Releasing early resets the progress.
 await standBy('pickup-vacuum', 0, -.5); await focus('pickup-vacuum'); await tap();
 c = await cleanup(); assert.equal(c.carrying, 'vacuum');
 assert.equal(await page.evaluate(() => window.__player.session().movement.speed), 1.65 * 1.5, 'steady carry pace');
 await standBy('dirt'); await focus('dirt');
 assert.equal(await page.locator('#action-title').textContent(), 'Hold to clean');
 await page.keyboard.down('Space'); await page.waitForTimeout(600); await page.keyboard.up('Space'); await page.waitForTimeout(100);
 c = await cleanup(); assert.equal(c.progress, 0, 'released early'); assert.ok(!c.completed.includes('dirt'));
 await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'dirt', undefined, {timeout: 5000});
 await page.keyboard.down('Space');
 await page.waitForFunction(() => window.__player.snapshot().cleanup.progress > .3, undefined, {timeout: 4000});
 await page.screenshot({path: resolve(out, 'chores-01-vacuum.png')});
 await page.waitForFunction(() => window.__player.snapshot().cleanup.completed.includes('dirt'), undefined, {timeout: 4000});
 await page.keyboard.up('Space');

 // All clean: $5 + $2 bonus, celebration, results, paid once to the wallet.
 await page.waitForSelector('#results[open]', {timeout: 8000});
 c = await cleanup();
 assert.deepEqual([c.state, c.allowance, c.bonus], ['finished', 7, 2]);
 assert.equal(await page.locator('#results-money').textContent(), '$7');
 const day = (await snap()).day;
 assert.equal(day.balance, balance0 + 7, 'paid to the wallet');
 await page.screenshot({path: resolve(out, 'chores-02-results.png')});
 const receipts = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.progress.v1')).creditedRounds);
 assert.ok(receipts.includes(c.roundId), 'round receipt saved');
 await page.evaluate(id => window.__player.session().day.credit(id, 7), c.roundId);
 assert.equal((await snap()).day.balance, balance0 + 7, 'the receipt never pays twice');

 // Replay: items home, fresh round.
 await page.click('#replay');
 c = await cleanup();
 assert.deepEqual([c.state, c.allowance, c.completed], ['ready', 0, []]);
 // Each round re-scatters the room (RoundMesses): items are loose on the floor again, matched by their prompts.
 const loose = await page.evaluate(() => window.__player.session().chores.props.items.map(i => ({id: i.id, parent: i.object.parent.name, visible: i.object.visible})));
 assert.ok(loose.every(i => i.parent === 'Cleanup props' && i.visible), 'nothing left in the socket or hidden');
 for (const it of c.items) {
  const t = c.targets.find(t => t.id === 'pickup-' + it.id);
  assert.ok(Math.hypot(it.position[0] - t.position[0], it.position[2] - t.position[2]) < .001, `${it.id} prompt follows it`);
 }
 assert.equal(c.items.find(i => i.id === 'vacuum').position.map(v => +v.toFixed(3)).join(), [4.65, .1, 12.15].join(), 'the vacuum waits in the utility room');
 // Back to everyday life: the round props leave, the day's chores return.
 await page.evaluate(() => window.__player.session().chores.configure('day'));
 c = await cleanup(); assert.equal(c.mode, 'day'); assert.equal(c.timed, false);
 assert.ok(c.items.every(i => !i.visible), 'round props hidden in daily life');
 assert.deepEqual(errors, []);
 console.log('PASS chores-bedroom:', JSON.stringify({allowance: 7, balance: day.balance, receipt: c.roundId !== undefined}));
} finally { await browser.close(); await server?.close(); }
