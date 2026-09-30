// Lilah in the house, in a disposable headless Edge context (390x844 @3x, touch):
// protected quality at native resolution, her own clips, a toddler walk that stays on free
// floor and out of Arianna's personal space, her carry point between her hands, and she
// stays home when Arianna visits a shop. Screenshots go to artifacts/play/.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
let url = process.env.THREE_URL, server;
if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5218, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 await page.goto(url);
 await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.lilah, undefined, {timeout: 120000});
 const snap = () => page.evaluate(() => window.__player.snapshot());
 const start = await snap(), q = start.lilah.quality;
 assert.deepEqual(q.problems, [], 'Lilah quality probe');
 assert.deepEqual([q.colorMap, q.roughnessMap, q.triangles, q.joints, q.pixelRatio], [[2048, 2048], [1024, 1024], 11271, 25, 3]);
 assert.deepEqual(q.clips.map(c => c.name).sort(), ['CarryIdle', 'CarryWalk', 'Celebrate', 'Idle', 'PickUp', 'PutDown', 'SitCar', 'Walk']);
 assert.equal(start.lilah.visible, true); assert.equal(start.lilah.animation.state, 'Idle');
 await page.screenshot({path: resolve(out, 'lilah-00-start.png')});

 // Over ~16 s she makes decisions and walks at a toddler's pace, never into walls or Arianna.
 const samples = [];
 for (let i = 0; i < 32; i++) { await page.waitForTimeout(500); samples.push(await snap()); }
 const moves = samples.map((s, i) => i ? Math.hypot(s.lilah.position[0] - samples[i - 1].lilah.position[0], s.lilah.position[2] - samples[i - 1].lilah.position[2]) : 0);
 const travelled = moves.reduce((a, b) => a + b, 0), fastest = Math.max(...moves) / .5;
 assert.ok(samples.some(s => s.lilah.state === 'following' || s.lilah.state === 'exploring'), 'she decided something');
 assert.ok(travelled > .5, `she walked (${travelled.toFixed(2)} m)`);
 assert.ok(fastest < .7 * 1.35, `toddler pace (${fastest.toFixed(2)} m/s)`);
 assert.ok(samples.some(s => s.lilah.animation.state === 'Walk'), 'walk clip while moving');
 assert.ok(samples.every(s => s.lilah.animation.state !== 'Run'), 'she never runs');
 for (const s of samples) {
  const free = await page.evaluate(p => window.__player.session().lilah['planner'].free(p[0], p[2]), s.lilah.position);
  assert.ok(free, `on free floor at ${s.lilah.position.map(v => v.toFixed(2))}`);
  const gap = Math.hypot(s.lilah.position[0] - s.position[0], s.lilah.position[2] - s.position[2]);
  assert.ok(gap > .38, `keeps her distance from Arianna (${gap.toFixed(2)} m)`);
 }
 await page.screenshot({path: resolve(out, 'lilah-01-wandering.png')});

 // Carry point: between her hands, and her block rides there with the carry pose.
 await page.evaluate(() => window.__player.session().lilah.carry(true));
 await page.waitForTimeout(400);
 const carrying = await snap();
 const hands = await page.evaluate(() => { const l = window.__player.session().lilah, b = n => l.character.bones.get(n).getWorldPosition(l.socket.position.clone()).toArray(); return [b('handL'), b('handR')]; });
 const mid = hands[0].map((v, i) => (v + hands[1][i]) / 2);
 assert.ok(Math.hypot(...carrying.lilah.socket.map((v, i) => v - mid[i])) < .05, 'socket sits between her hands');
 assert.ok(['CarryIdle', 'CarryWalk'].includes(carrying.lilah.animation.state), `carry pose (${carrying.lilah.animation.state})`);
 await page.screenshot({path: resolve(out, 'lilah-02-carrying.png')});
 await page.evaluate(() => window.__player.session().lilah.carry(false));

 // PickUp plays at 3x: 0.8 s, take-toy on the clip clock at 1.1 s (≈ 0.37 s real).
 const pick = await page.evaluate(() => new Promise(resolve => { const t0 = performance.now(), events = [];
  window.__player.session().lilah.animator.playAction('PickUp', {onEvent: e => events.push([e, Math.round(performance.now() - t0)]), done: () => resolve({events, ms: Math.round(performance.now() - t0)})}); }));
 assert.deepEqual(pick.events.map(e => e[0]), ['take-toy']);
 assert.ok(Math.abs(pick.events[0][1] - 367) < 120, `take-toy at ${pick.events[0][1]} ms`);
 assert.ok(Math.abs(pick.ms - 800) < 150, `PickUp finished at ${pick.ms} ms`);

 // A shop visit leaves her at home, hidden and paused; she is back on return.
 await page.evaluate(() => window.__roomTest.show('store-toys'));
 await page.waitForTimeout(600);
 const shop = await snap();
 assert.equal(shop.lilah.visible, false, 'not in the shop');
 const paused = shop.lilah.time; await page.waitForTimeout(500);
 assert.equal((await snap()).lilah.time, paused, 'her clock pauses away from home');
 await page.evaluate(() => window.__roomTest.show('house'));
 await page.waitForTimeout(600);
 assert.equal((await snap()).lilah.visible, true, 'home again');
 assert.deepEqual(errors, []);
 console.log('PASS lilah:', JSON.stringify({travelled: +travelled.toFixed(2), fastest: +fastest.toFixed(2), states: [...new Set(samples.map(s => s.lilah.state))], pick}));
} finally { await browser.close(); await server?.close(); }
