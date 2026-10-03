// Records the family at home (default: Lilah following Arianna in the bedroom; 'family':
// Arianna walks down to the living room where Marc reads and Baxter strolls; 'life': playing
// with Lilah, her bedtime walk and tuck-in, then Dad serving dinner), from the real play mode
// (disposable headless Edge, phone viewport). Speech bubbles and the bedtime dim are drawn
// into the video from the live DOM. Output: artifacts/play/{lilah-play|family-play|family-life}.webm
//   node tests/browser/record-home-play.mjs [family|life]
import {chromium} from 'playwright-core';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const family = process.argv[2] === 'family', life = process.argv[2] === 'life';
const name = life ? 'family-life' : family ? 'family-play' : 'lilah-play';
const out = resolve(ROOT, 'artifacts', 'play'); await mkdir(out, {recursive: true});
const {createServer} = await import('vite');
const server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5219, strictPort: false}}); await server.listen();
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
 await page.goto(server.resolvedUrls.local[0]);
 await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.lilah, undefined, {timeout: 120000});
 await page.evaluate(() => {
  const gl = document.querySelector('#game-canvas'), c = document.createElement('canvas'); c.width = gl.width; c.height = gl.height;
  const x = c.getContext('2d'), s = gl.width / gl.clientWidth, chunks = [];
  const rec = new MediaRecorder(c.captureStream(30), {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8e6});
  rec.ondataavailable = e => chunks.push(e.data); rec.start(250);
  const draw = () => {
   x.drawImage(gl, 0, 0);
   const dim = document.querySelector('#bedtime-fade'), o = dim ? Number(getComputedStyle(dim).opacity) : 0;
   if (o > 0) { x.fillStyle = `rgba(22,19,37,${o})`; x.fillRect(0, 0, c.width, c.height); }
   for (const label of document.querySelectorAll('.speech-label:not([hidden])')) {
    const r = label.getBoundingClientRect(), g = gl.getBoundingClientRect();
    x.fillStyle = label.classList.contains('marc') ? '#e7f0e4ef' : '#fff2ceef'; x.beginPath(); x.roundRect((r.left - g.left) * s, (r.top - g.top) * s, r.width * s, r.height * s, 15 * s); x.fill();
    x.fillStyle = '#735978'; x.font = `700 ${12 * s}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label.textContent, (r.left - g.left + r.width / 2) * s, (r.top - g.top + r.height / 2) * s);
   }
   if (window.__rec) requestAnimationFrame(draw);
  };
  window.__rec = {rec, chunks}; requestAnimationFrame(draw);
 });
 // Arianna idles, strolls around the bedroom and living room, and pauses so Lilah can catch up.
 const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
 if (life) {
  const s = (fn, arg) => page.evaluate(fn, arg);
  const set = state => s(state => { const p = window.__player.session(); Object.assign(p.day.state, state); p.day.update(0, false); p.day.save(); p.chores.dayChanged(); }, state);
  await page.waitForFunction(() => window.__player.session().marc?.dinner.ready);
  // Play with Lilah in the bedroom.
  await s(() => { const p = window.__player.session(); p.movement.place(.4, .9); p.lilah.place(1.3, 1.4); });
  await page.waitForTimeout(1200); await page.keyboard.press('Space'); await page.waitForTimeout(3500);
  // 6:14 PM: she gets sleepy and toddles to her crib; Arianna follows.
  await set({phase: 'afternoon', minutes: 1094.4, done: [], dinnerServed: true});
  await s(() => { const p = window.__player.session(); p.movement.place(7.6, .6); p.lilah.place(8.2, 1.4); });
  await page.waitForFunction(() => window.__player.snapshot().lilah.tuckable, undefined, {timeout: 30000});
  await page.waitForTimeout(1500);
  // Arianna steps up beside the crib (a free spot within reach of the tuck-in).
  await s(() => {
    const p = window.__player.session(), t = p.chores.props.interactions.find(t => t.id === 'lilah-bed'), m = p.movement;
    for (const r of [.6, .75, .45, .9]) for (let a = 0; a < 24; a++) {
      const x = t.anchor.x + Math.sin(a * Math.PI / 12) * r, z = t.anchor.z + Math.cos(a * Math.PI / 12) * r;
      if (!m.blocked(x, z) && Math.hypot(x - p.lilah.position.x, z - p.lilah.position.z) > .5) { m.place(x, z); return; }
    }
  });
  await page.waitForFunction(() => document.querySelector('#action-button')?.dataset.target === 'lilah-bed', undefined, {timeout: 5000});
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__player.snapshot().lilah.state === 'sleeping', undefined, {timeout: 12000});
  await page.waitForTimeout(3500);
  // Next day, mid-afternoon: Dad serves dinner (watched from the kitchen).
  await s(() => { const p = window.__player.session(); Object.assign(p.day.state, {phase: 'night', minutes: 1260}); p.day.sleep(); });
  await page.waitForTimeout(800);
  await set({phase: 'afternoon', minutes: 1004, done: []});
  await s(() => window.__player.session().movement.place(1.6, 12.2));
  await page.waitForFunction(() => window.__player.snapshot().day.dinnerServed === true, undefined, {timeout: 60000});
  await page.waitForTimeout(6000);
 } else if (family) {
  await page.waitForTimeout(3000);
  await hold(['ArrowDown'], 1500); await page.waitForTimeout(3000);
  await hold(['ArrowDown', 'ArrowRight'], 500); await page.waitForTimeout(8000);
  await page.screenshot({path: resolve(out, 'family-play-mid.png')});
  await hold(['ArrowLeft'], 600); await page.waitForTimeout(8000);
 } else {
 await page.waitForTimeout(5000);
 await hold(['ArrowDown'], 900); await page.waitForTimeout(4000);
 await hold(['ArrowRight'], 700); await page.waitForTimeout(5000);
 await hold(['ArrowUp'], 800); await page.waitForTimeout(6000);
 await hold(['ArrowLeft', 'ArrowDown'], 700); await page.waitForTimeout(6000);
 }
 await page.screenshot({path: resolve(out, name + '-end.png')});
 const webm = await page.evaluate(async () => {
  const {rec, chunks} = window.__rec; window.__rec = null; rec.stop(); await new Promise(r => rec.onstop = r);
  const bytes = new Uint8Array(await new Blob(chunks, {type: 'video/webm'}).arrayBuffer()); let str = '';
  for (let i = 0; i < bytes.length; i += 65536) str += String.fromCharCode(...bytes.subarray(i, i + 65536)); return btoa(str);
 });
 await writeFile(resolve(out, name + '.webm'), Buffer.from(webm, 'base64'));
 console.log('Video:', resolve(out, name + '.webm'));
} finally { await browser.close(); await server.close(); }
