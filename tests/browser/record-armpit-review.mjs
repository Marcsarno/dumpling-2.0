// Side-by-side review video of Arianna's armpit fix: the archived original (left) against the
// shipped fix or a candidate (right), playing the same game clips in real time from the same camera.
// Headless Edge in a disposable context, recorded in-page (canvas + MediaRecorder).
//   node tests/browser/record-armpit-review.mjs [original.glb] [candidate.glb]   -> artifacts/armpit/armpit-review.webm
// Defaults: artifacts/armpit/original/arianna.glb (35cfde9d…) against the shipped public/ model.
import {chromium} from 'playwright-core';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const rel = p => relative(ROOT, resolve(p)).replaceAll('\\', '/');
const original = rel(process.argv[2] ?? resolve(ROOT, 'artifacts/armpit/original/arianna.glb'));
const candidate = process.argv[3] ? rel(process.argv[3]) : null;
const SHOTS = [
 ['Celebrate', 'front', 'Celebrate (fist pump)', 3],
 ['Celebrate', 'three-quarter', 'Celebrate, three-quarter', 2],
 ['MealBite', 'front', 'Meal bite', 2],
 ['MealBite', 'three-quarter', 'Meal bite, three-quarter', 2],
 ['MealDrink', 'right', 'Drink, side', 2],
 ['PickUp', 'three-quarter', 'Pick up', 3],
 ['PutDown', 'front', 'Put down', 2],
 ['CarryIdle', 'three-quarter', 'Carrying', 1],
 ['Run', 'front', 'Run', 3],
 ['Walk', 'three-quarter', 'Walk', 2],
 ['Idle', 'front', 'Idle', 1],
];
const out = resolve(ROOT, 'artifacts', 'armpit'); await mkdir(out, {recursive: true});
const W = 540, H = 760;
await writeFile(resolve(out, 'compare.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff}iframe{border:0;width:${W}px;height:${H}px}</style>
<iframe id="a" src="/lab.html?capture=1&glb=${encodeURIComponent(original)}"></iframe><iframe id="b" src="/lab.html?capture=1${candidate ? '&glb=' + encodeURIComponent(candidate) : ''}"></iframe>`);
const {createServer} = await import('vite');
const server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 5215, strictPort: false}}); await server.listen();
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
 const page = await browser.newPage({viewport: {width: W * 2, height: H}, deviceScaleFactor: 1.5});
 await page.goto(server.resolvedUrls.local[0] + 'artifacts/armpit/compare.html');
 for (const id of ['a', 'b']) await page.waitForFunction(i => document.getElementById(i).contentDocument?.body?.dataset.ready === 'true', id, {timeout: 120000});
 const clips = await page.evaluate(() => document.getElementById('a').contentWindow.__lab.clips().map(c => c.name));
 const shots = SHOTS.filter(s => clips.includes(s[0]));
 console.log('clips available:', clips.join(', '));
 const webm = await page.evaluate(async shots => {
  const labs = ['a', 'b'].map(id => document.getElementById(id).contentWindow);
  const gls = ['a', 'b'].map(id => document.getElementById(id).contentDocument.querySelector('#game-canvas'));
  const out = document.createElement('canvas'); out.width = gls[0].width * 2; out.height = gls[0].height;
  const x = out.getContext('2d'), rec = new MediaRecorder(out.captureStream(30), {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12e6}), chunks = [];
  rec.ondataavailable = e => chunks.push(e.data); rec.start(250);
  const w = gls[0].width, s = w / 540;
  const frame = caption => {
   x.drawImage(gls[0], 0, 0); x.drawImage(gls[1], w, 0);
   x.fillStyle = '#fffaf2ee'; x.fillRect(0, 0, out.width, 120 * s);
   x.fillStyle = '#3d3350'; x.textAlign = 'center';
   x.font = `600 ${30 * s}px system-ui`; x.fillText(caption, out.width / 2, 44 * s);
   x.font = `600 ${26 * s}px system-ui`; x.fillStyle = '#9a4b5c'; x.fillText('Before (original)', w / 2, 96 * s);
   x.fillStyle = '#2f7a55'; x.fillText('After (armpit fix)', w * 1.5, 96 * s);
   x.fillStyle = '#b9a7cd'; x.fillRect(w - 2, 0, 4, out.height);
  };
  for (const [clip, view, caption, loops] of shots) {
   const d = labs[0].__lab.clips().find(c => c.name === clip).duration, total = d * loops * 1000 + 400, t0 = performance.now();
   await new Promise(r => { const f = now => { const e = now - t0, t = Math.min(e / 1000, d * loops) % d;
    labs[0].__lab.pose(clip, t, view); labs[1].__lab.pose(clip, t, view); frame(caption);
    if (e < total) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  }
  rec.stop(); await new Promise(r => rec.onstop = r);
  const bytes = new Uint8Array(await new Blob(chunks, {type: 'video/webm'}).arrayBuffer()); let str = '';
  for (let i = 0; i < bytes.length; i += 65536) str += String.fromCharCode(...bytes.subarray(i, i + 65536)); return btoa(str);
 }, shots);
 await writeFile(resolve(out, 'armpit-review.webm'), Buffer.from(webm, 'base64'));
 console.log('Video:', resolve(out, 'armpit-review.webm'));
 // Full-resolution stills at the most demanding moments, for close inspection.
 await mkdir(resolve(out, 'stills'), {recursive: true});
 for (const [clip, t, view] of [['Celebrate', .32, 'front'], ['Celebrate', .32, 'three-quarter'], ['Celebrate', .66, 'left'], ['MealBite', .65, 'front'],
  ['MealBite', .65, 'three-quarter'], ['PickUp', .4, 'three-quarter'], ['PickUp', .4, 'front'], ['CarryIdle', 0, 'front'], ['Run', .15, 'front'], ['Idle', 0, 'front']]) {
  if (!clips.includes(clip)) continue;
  await page.evaluate(([c, t, v]) => { for (const id of ['a', 'b']) document.getElementById(id).contentWindow.__lab.pose(c, t, v); }, [clip, t, view]);
  await page.screenshot({path: resolve(out, 'stills', `${clip}-${t}-${view}.png`)});
 }
} finally { await browser.close(); await server.close(); }
