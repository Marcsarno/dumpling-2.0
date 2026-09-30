// Records the family at home (default: Lilah following Arianna in the bedroom; 'family':
// Arianna walks down to the living room where Marc reads and Sunny Pup strolls), from the real
// play mode (disposable headless Edge, phone viewport). Speech bubbles are drawn into the
// video from the live DOM labels. Output: artifacts/play/lilah-play.webm
//   node tests/browser/record-home-play.mjs [family]
import {chromium} from 'playwright-core';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const family = process.argv[2] === 'family';
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
   for (const label of document.querySelectorAll('.speech-label:not([hidden])')) {
    const r = label.getBoundingClientRect(), g = gl.getBoundingClientRect();
    x.fillStyle = '#fff2ceef'; x.beginPath(); x.roundRect((r.left - g.left) * s, (r.top - g.top) * s, r.width * s, r.height * s, 15 * s); x.fill();
    x.fillStyle = '#735978'; x.font = `700 ${12 * s}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label.textContent, (r.left - g.left + r.width / 2) * s, (r.top - g.top + r.height / 2) * s);
   }
   if (window.__rec) requestAnimationFrame(draw);
  };
  window.__rec = {rec, chunks}; requestAnimationFrame(draw);
 });
 // Arianna idles, strolls around the bedroom and living room, and pauses so Lilah can catch up.
 const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
 if (family) {
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
 await page.screenshot({path: resolve(out, family ? 'family-play-end.png' : 'lilah-play-end.png')});
 const webm = await page.evaluate(async () => {
  const {rec, chunks} = window.__rec; window.__rec = null; rec.stop(); await new Promise(r => rec.onstop = r);
  const bytes = new Uint8Array(await new Blob(chunks, {type: 'video/webm'}).arrayBuffer()); let str = '';
  for (let i = 0; i < bytes.length; i += 65536) str += String.fromCharCode(...bytes.subarray(i, i + 65536)); return btoa(str);
 });
 await writeFile(resolve(out, family ? 'family-play.webm' : 'lilah-play.webm'), Buffer.from(webm, 'base64'));
 console.log('Video:', resolve(out, family ? 'family-play.webm' : 'lilah-play.webm'));
} finally { await browser.close(); await server.close(); }
