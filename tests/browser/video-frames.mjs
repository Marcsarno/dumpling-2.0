// Pull still frames out of a recorded review video (headless Edge decodes the webm; no ffmpeg).
//   node tests/browser/video-frames.mjs artifacts/play/family-life.webm 2 6 10 ...   (seconds)
// Writes <video>-<t>s.png next to the video. Use 'auto' instead of times for 12 evenly spaced frames.
import {chromium} from 'playwright-core';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const [file, ...times] = process.argv.slice(2);
const path = resolve(ROOT, file), data = (await readFile(path)).toString('base64');
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage();
  await page.setContent('<video muted playsinline></video><canvas></canvas>');
  const duration = await page.evaluate(async data => {
    const v = document.querySelector('video'), bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    v.src = URL.createObjectURL(new Blob([bytes], {type: 'video/webm'}));
    await new Promise(r => v.onloadedmetadata = r);
    // MediaRecorder webm has no duration header; seek far to make the browser find it.
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e6; await new Promise(r => v.ontimeupdate = r); v.ontimeupdate = null; }
    return v.duration;
  }, data);
  const list = times[0] === 'auto' || !times.length ? Array.from({length: 12}, (_, i) => +(duration * (i + .5) / 12).toFixed(1)) : times.map(Number);
  for (const t of list) {
    const png = await page.evaluate(async t => {
      const v = document.querySelector('video'), c = document.querySelector('canvas');
      v.currentTime = t; await new Promise(r => v.onseeked = r);
      c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, t);
    const out = path.replace(/\.webm$/, `-${t}s.png`); await writeFile(out, Buffer.from(png, 'base64')); console.log(out);
  }
  console.log('duration', duration.toFixed(1));
} finally { await browser.close(); }
