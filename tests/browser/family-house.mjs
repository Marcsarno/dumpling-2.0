// Marc and Sunny Pup in the house, in a disposable headless Edge context (390x844 @3x):
// their untouched textures and rigs at native resolution, Marc walking to his reading chair
// and sitting, the pup strolling at 0.3 m/s on its Walk clip, everyone keeping their
// distance, and both staying home during a shop visit. Screenshots go to artifacts/play/.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
let url = process.env.THREE_URL, server;
if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5220, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
const browser = await chromium.launch({channel: 'msedge', headless: true});
const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
try {
 const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 await page.goto(url);
 await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.pup, undefined, {timeout: 120000});
 const snap = () => page.evaluate(() => window.__player.snapshot());
 const start = await snap(), m = start.marc.quality, d = start.pup.quality;
 assert.deepEqual([m.problems, m.colorMap, m.roughnessMap, m.triangles, m.joints, m.pixelRatio], [[], [1024, 1024], [512, 512], 10428, 28, 3], 'Marc as shipped');
 assert.ok(!m.clips.some(c => c.name === 'Run_Alternative'), 'the rejected run is absent');
 assert.deepEqual([d.problems, d.colorMap, d.normalMap, d.roughnessMap, d.triangles, d.joints], [[], [1024, 1024], [1024, 1024], [512, 512], 10455, 49], 'Sunny Pup as shipped');
 const sizes = await page.evaluate(() => { const s = window.__player.session(), h = o => { o.updateMatrixWorld(true); const b = new (o.position.constructor)(); const box = {min: Infinity, max: -Infinity};
  o.traverse(c => { if (c.isSkinnedMesh) { c.computeBoundingBox(); const bb = c.boundingBox.clone().applyMatrix4(c.matrixWorld); box.min = Math.min(box.min, bb.min.y); box.max = Math.max(box.max, bb.max.y); } }); return box.max - box.min; };
  return {marc: h(s.marc.character.model), pup: h(s.pup.character.model), arianna: h(s.character.model)}; });
 assert.ok(Math.abs(sizes.pup - .48) < .03, `pup is 0.48 m tall (${sizes.pup.toFixed(3)})`);
 assert.ok(Math.abs(sizes.marc / sizes.arianna - 1.3) < .08, `Marc is 1.3x Arianna (${(sizes.marc / sizes.arianna).toFixed(2)})`);

 // ~12 s of the house living on its own.
 const samples = [];
 for (let i = 0; i < 24; i++) { await page.waitForTimeout(500); samples.push(await snap()); }
 const seated = samples.find(s => s.marc.state === 'seated');
 assert.ok(seated, `Marc sat in his chair (states ${[...new Set(samples.map(s => s.marc.state))]})`);
 assert.ok(gap(seated.marc.position, [4.339, 0, 7.579]) < .05, `on the seat (${seated.marc.position.map(v => v.toFixed(2))})`);
 assert.equal(seated.marc.animation.state, 'SitIdle');
 await page.screenshot({path: resolve(out, 'family-00-marc-seated.png')});
 for (const s of samples) {
  if (s.marc.state === 'walking') assert.ok(gap(s.marc.position, s.position) > .58 && gap(s.marc.position, s.lilah.position) > .46, 'Marc gives the girls room');
  if (s.pup.clip === 'Walk') for (const p of [s.position, s.lilah.position, s.marc.position]) assert.ok(gap(s.pup.position, p) > .46, `the pup keeps clear (${gap(s.pup.position, p).toFixed(2)})`);
 }
 const pupSpeeds = samples.map((s, i) => i ? gap(s.pup.position, samples[i - 1].pup.position) / .5 : 0);
 assert.ok(samples.some(s => s.pup.clip === 'Walk'), 'the pup strolled');
 assert.ok(Math.max(...pupSpeeds) < .3 * 1.4, `stroll pace (${Math.max(...pupSpeeds).toFixed(2)} m/s)`);
 for (const s of samples) {
  const free = await page.evaluate(p => window.__player.session().pup['planner'].free(p[0], p[2]), s.pup.position);
  assert.ok(free, `pup on free floor at ${s.pup.position.map(v => v.toFixed(2))}`);
 }
 await page.screenshot({path: resolve(out, 'family-01-house.png')});

 // Shop visit: both stay home, hidden.
 await page.evaluate(() => window.__roomTest.show('store-corner')); await page.waitForTimeout(500);
 const shop = await snap();
 assert.equal(shop.marc.visible, false); assert.equal(shop.pup.visible, false);
 await page.evaluate(() => window.__roomTest.show('house')); await page.waitForTimeout(500);
 const back = await snap(); assert.equal(back.marc.visible, true); assert.equal(back.pup.visible, true);
 assert.deepEqual(errors, []);
 console.log('PASS family:', JSON.stringify({sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, +v.toFixed(3)])), marcStates: [...new Set(samples.map(s => s.marc.state))], pupMax: +Math.max(...pupSpeeds).toFixed(2), speech: seated.marc.speech}));
} finally { await browser.close(); await server?.close(); }
