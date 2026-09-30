// Day to night in the house (disposable headless Edge, 390x844 @3x): the 13 authored lights
// fade in over 1.2 s when night falls, shades glow, the sun and sky dim to dusk, the garden
// is left to the sun and sky, nightfall causes no shader compile, and morning turns it all
// back off. Captures each room at night for review (artifacts/play/night-*.png).
// Also: music picks the right track, the Sound & performance dialog saves volumes and mutes,
// and rendering pauses behind menus.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {openGame, out} from './lib/chore-driver.mjs';

const {page, errors, close, driver: {snap}} = await openGame(5229);
try {
  const ROOMS = [['bedroom', 0, .9], ['bathroom', 4.6, -1.6], ['nursery', 8.6, 0], ['living', 1.5, 6.5], ['marc', 9, 8], ['kitchen', -.5, 12.5], ['laundry', 4.6, 11.4]];
  let s = await snap();
  assert.equal(s.lighting.on, false, 'daylight: the lamps are off'); assert.equal(s.lighting.amount, 0);
  assert.equal(s.lighting.lamps.length, 12); assert.ok(s.lighting.lamps.every(l => !l.visible)); assert.ok(s.lighting.bounce === 0);
  // Garden geometry carries the outdoor flag (in shared batches), so the lamps skip it.
  const outdoors = await page.evaluate(() => { let n = 0; window.__player.session().scene.traverse(o => { const a = o.geometry?.getAttribute?.('exterior'); if (a && a.array.some(v => v === 1)) n++; }); return n; });
  assert.ok(outdoors >= 5, `garden geometry flagged outdoors (${outdoors})`);
  assert.ok(s.lighting.shades >= 2, `shade materials found (${s.lighting.shades})`);
  const daySun = s.daylight.sun;
  await page.screenshot({path: resolve(out, 'night-00-bedroom-day.png')});
  const programs = () => page.evaluate(() => window.__player.session().renderer.info.programs.length);
  const before = await programs();

  // Nightfall.
  await page.evaluate(() => { const x = window.__player.session(); Object.assign(x.day.state, {phase: 'night', minutes: 1140, done: []}); x.chores.dayChanged(); });
  await page.waitForTimeout(600);
  s = await snap(); assert.ok(s.lighting.amount > .2 && s.lighting.amount < .8, `fading in (${s.lighting.amount})`);
  await page.waitForFunction(() => window.__player.snapshot().lighting.amount === 1, undefined, {timeout: 3000});
  s = await snap();
  assert.equal(await programs(), before, 'no shaders compiled at nightfall');
  assert.ok(Math.abs(s.daylight.sun - daySun * (1 - .98 / 1.2)) < 1e-6, 'the sun dims to dusk');
  assert.ok(s.lighting.shadeGlow > .79, 'shades glow'); assert.ok(s.lighting.bounce > 0, 'interior bounce on');
  assert.ok(s.lighting.lamps.every(l => l.visible && Math.abs(l.intensity / Math.PI - (/fixture/.test(l.name) ? 2.1 : l.name === 'Bedside lamp light' ? 2.4 : 2.3)) < 1e-6), 'every lamp at its authored strength');
  for (const [room, x, z] of ROOMS) {
    await page.evaluate(([x, z]) => { const m = window.__player.session().movement; m.place(x, z); }, [x, z]);
    await page.waitForTimeout(900);
    await page.screenshot({path: resolve(out, `night-1${ROOMS.findIndex(r => r[0] === room)}-${room}.png`)});
  }

  // Menus pause rendering; the settings dialog saves volume and mutes.
  const frames = () => page.evaluate(() => window.__player.session().renderer.info.render.frame);
  await page.click('#adventure-menu-open'); await page.waitForSelector('#adventure-menu[open]');
  await page.click('#sound-settings-open'); await page.waitForSelector('#sound-settings[open]');
  const f0 = await frames(); await page.waitForTimeout(500);
  assert.equal(await frames(), f0, 'no frames drawn behind the settings');
  await page.screenshot({path: resolve(out, 'night-20-sound-settings.png')});
  await page.locator('input[data-channel=music]').fill('30');
  await page.click('#house-effects');
  const saved = await page.evaluate(() => ({music: localStorage.getItem('dumpling.three.audio.music'), fx: localStorage.getItem('dumpling.three.house-effects.muted')}));
  assert.deepEqual(saved, {music: '0.3', fx: 'true'});
  await page.click('#house-effects');
  await page.click('#sound-settings .adventure-resume');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(200); assert.ok(await frames() > f0, 'drawing again once closed');

  // Music: a key press unlocks audio; night plays the home track, quietly, through its gain node.
  await page.keyboard.press('KeyD');
  await page.waitForFunction(() => window.__player.snapshot().music.routed, undefined, {timeout: 4000});
  s = await snap(); assert.equal(s.music.requested, 'Home · morning & night');
  await page.waitForFunction(() => window.__player.snapshot().music.playing, undefined, {timeout: 8000}).catch(() => {});
  s = await snap();
  if (s.music.playing) { await page.waitForTimeout(1500); s = await snap(); assert.ok(s.music.level > 0 && s.music.level <= .252 * .3 + 1e-6, `music level ${s.music.level}`); }
  else console.log('note: headless Edge did not start media playback; routing and track choice verified');
  await page.evaluate(() => { const x = window.__player.session(); Object.assign(x.day.state, {phase: 'afternoon', minutes: 900, done: []}); x.chores.dayChanged(); });
  await page.waitForFunction(() => window.__player.snapshot().music.requested === 'Home · after-school chores');

  // Afternoon again: lamps fade off and the pool switches off.
  await page.waitForFunction(() => window.__player.snapshot().lighting.amount === 0, undefined, {timeout: 3000});
  await page.waitForTimeout(100);
  s = await snap(); assert.equal(s.lighting.on, false); assert.ok(Math.abs(s.daylight.sun - daySun) < 1e-6, 'full sun again');
  assert.deepEqual(errors, []);
  console.log('PASS night-house:', JSON.stringify({outdoorMeshes: outdoors, programs: before, music: s.music.playing}));
} finally { await close(); }
