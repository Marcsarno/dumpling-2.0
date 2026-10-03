// Family life (slice 6) with real key presses (disposable headless Edge, 390x844 @3x):
// playing with Lilah (and its cooldown), her 6:15 PM walk to the crib, the tuck-in (she climbs
// in; $1 once by receipt day-{d}-lilah-bed; asleep through a reload; awake next morning),
// Dad's dinner service (every stage, saved, platter on the table after a reload, menu by
// day), Baxter emptying and returning to his bowl, his half of fetch, and the slice-4 fix
// for a cancelled bowl fill. Adapted from PlayCanvas qol-browser, family-browser and
// family-boundaries tests.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {openGame, out} from './lib/chore-driver.mjs';

const {page, errors, ready, close, driver: {snap, doIt, standBy, offered, idle}} = await openGame(5234);
try {
  // Settle the day change now (DayLoop would otherwise fire it next frame and move Arianna home).
  const set = state => page.evaluate(state => { const s = window.__player.session(); Object.assign(s.day.state, state); s.day.update(0, false); s.day.save(); s.chores.dayChanged(); }, state);
  const lilah = async () => (await snap()).lilah;
  const wait = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, {timeout});
  await wait(() => window.__player.session().marc?.dinner.ready && window.__player.session().pup?.bowl);
  const money = (await snap()).day.balance;

  // --- Play with Lilah: both cheer, no money, a short cooldown.
  await page.evaluate(() => { const s = window.__player.session(); s.movement.place(.5, .9); s.lilah.place(1.1, 1.1); });
  await page.waitForTimeout(300);
  await offered('play-lilah');
  await page.keyboard.press('Space');
  await wait(() => window.__player.snapshot().lilah.state === 'playing', undefined, 5000);
  let s = await snap();
  assert.equal(s.cleanup.workClip, 'Celebrate', 'Arianna cheers with her');
  assert.ok(['Again! Again!', 'Hehe! More, Ari!', 'You’re silly, Ari!', 'Spin me! Spin me!'].includes(s.lilah.speech), s.lilah.speech);
  await page.screenshot({path: resolve(out, 'family-10-play.png')});
  await idle();
  s = await snap(); assert.equal(s.day.balance, money, 'playing pays nothing');
  assert.equal(s.lilah.canPlay, false, 'a short cooldown before playing again');
  await wait(() => window.__player.snapshot().lilah.canPlay, undefined, 9000);

  // --- 6:15 PM: Lilah gets sleepy and toddles to her crib.
  await set({phase: 'afternoon', minutes: 1094.6, done: [], dinnerServed: true});
  await page.evaluate(() => window.__player.session().lilah.place(8.1, 1.2));
  await wait(() => window.__player.snapshot().lilah.state === 'sleepy', undefined, 8000);
  assert.equal((await lilah()).speech, 'Sleepy…');
  await wait(() => window.__player.snapshot().lilah.atCrib, undefined, 30000);
  s = await snap();
  assert.equal(s.lilah.speech, 'Tuck me in, Ari?');
  assert.equal(s.lilah.canPlay, false, 'no playing at bedtime');
  assert.match(await page.locator('#adventure-journal [data-hint]').textContent(), /Lilah is sleepy/);

  // --- Tuck-in: she climbs in under a soft dim; $1 once.
  await doIt('lilah-bed', {during: async () => {
    await page.waitForTimeout(1500); const m = await snap();
    assert.equal(m.lilah.state, 'climbing'); assert.ok(m.lilah.height > .3, `climbing over the rail (${m.lilah.height})`);
    assert.equal(m.cleanup.workClip, 'Tuck');
    assert.equal(await page.locator('#bedtime-fade.on').count(), 1, 'soft dim while tucking');
    await page.screenshot({path: resolve(out, 'family-11-tuck.png')});
  }});
  await wait(() => window.__player.snapshot().lilah.state === 'sleeping', undefined, 4000);
  s = await snap();
  assert.equal(s.day.lilahAsleep, true); assert.equal(s.day.balance, money + 1, 'tuck-in pays $1');
  assert.ok(Math.abs(s.lilah.height - .65) < 1e-6 && Math.abs(s.lilah.position[0] - 9.8) < .01, 'lying in the crib');
  assert.equal(s.lilah.speech, 'Night night, Ari…');
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#bedtime-fade.on').count(), 0, 'the dim lifts');
  await page.screenshot({path: resolve(out, 'family-12-asleep.png')});
  let receipts = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.progress.v1')).creditedRounds);
  assert.ok(receipts.includes('day-1-lilah-bed'));

  // Reload: still asleep, quietly; nothing paid twice; the tuck-in is not offered again.
  await page.reload(); await ready();
  await wait(() => window.__player.snapshot().lilah?.state === 'sleeping', undefined, 10000);
  s = await snap();
  assert.equal(s.day.balance, money + 1); assert.notEqual(s.lilah.speech, 'Night night, Ari…', 'no goodnight on every reload');
  await standBy('lilah-bed'); await page.waitForTimeout(300);
  assert.notEqual((await snap()).cleanup.focus, 'lilah-bed');

  // --- A new day: she wakes at her crib.
  await page.evaluate(() => { const s = window.__player.session(); Object.assign(s.day.state, {phase: 'night', minutes: 1260}); s.day.sleep(); });
  await wait(() => window.__player.snapshot().day.day === 2 && window.__player.snapshot().lilah.state !== 'sleeping', undefined, 5000);
  s = await snap();
  assert.equal(s.lilah.speech, 'Morning, Ari!'); assert.ok(Math.abs(s.lilah.position[0] - 8.55) < .05, 'standing at the crib front');
  assert.equal(s.day.lilahAsleep, undefined);

  // --- Dad's dinner (day 2: taco). Arianna stays out of his way in the bedroom.
  await page.evaluate(() => window.__player.session().movement.place(0, .9));
  await set({phase: 'afternoon', minutes: 1004, done: []});
  await wait(() => window.__player.snapshot().marc.dinner.stage === 'fetch', undefined, 25000);
  assert.equal((await snap()).marc.speech, 'Taco night! I’ll set the table.');
  await wait(() => window.__player.snapshot().marc.dinner.stage === 'carry', undefined, 40000);
  await page.evaluate(() => { const s = window.__player.session(), d = s.marc.dinner.tray.getWorldPosition(s.marc.root.position.clone()); s.movement.place(d.x - 1.4, d.z); });
  await page.waitForTimeout(600); await page.screenshot({path: resolve(out, 'family-13-dinner-carry.png')});
  await wait(() => window.__player.snapshot().day.dinnerServed === true, undefined, 30000);
  s = await snap();
  assert.equal(s.marc.speech, 'Dinner is ready whenever you are, sweetie.');
  assert.match(await page.locator('#save-message').textContent(), /dinner is on the table/i, 'a HUD note even when Dad is off screen');
  assert.deepEqual(s.marc.dinner.position.map(v => +v.toFixed(2)), [.55, .99, 14.35], 'platter on the table');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dumpling.three.daily.v1'))).dinnerServed, true, 'saved at once');
  await wait(() => window.__player.snapshot().marc.dinner.stage === 'idle', undefined, 30000);
  assert.deepEqual([...new Set(s.marc.dinner.stages.concat((await snap()).marc.dinner.stages))].filter(x => x !== 'idle'),
    ['fetch', 'pickup', 'carry', 'place', 'sitting', 'seated', 'standing'], 'every stage, in order');
  await page.screenshot({path: resolve(out, 'family-14-dinner-served.png')});
  await page.reload(); await ready();
  await wait(() => window.__player.session().marc?.dinner.ready);
  await page.waitForTimeout(500);
  s = await snap();
  assert.deepEqual([s.marc.dinner.stage, s.marc.dinner.food, s.marc.dinner.visible], ['idle', 'taco', true], 'platter restored, no second dinner');
  assert.equal(s.day.balance, money + 1, 'dinner pays nothing');

  // --- Baxter's bowl: he empties it, the empty bowl is saved; refilled, he eats again.
  await page.evaluate(() => { const s = window.__player.session(); Object.assign(s.day.state, {phase: 'morning', minutes: 430, dogFoodEmpty: false}); s.chores.dayChanged(); s.pup.bowlWait = 0; s.movement.place(0, .9); });
  await wait(() => window.__player.snapshot().pup.state === 'to-bowl' || window.__player.snapshot().pup.state === 'eating', undefined, 20000);
  await wait(() => window.__player.snapshot().pup.state === 'eating', undefined, 40000);
  await page.evaluate(() => { const s = window.__player.session(), p = s.pup.position; s.movement.place(p.x - 1.2, p.z + .6); });
  await page.waitForTimeout(500); await page.screenshot({path: resolve(out, 'family-15-baxter-eats.png')});
  await wait(() => window.__player.snapshot().pup.meals === 1, undefined, 10000);
  s = await snap();
  assert.equal(s.pup.food, false); assert.equal(s.cleanup.dogFood, false, 'the kibble is gone');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('dumpling.three.daily.v1'))).dogFoodEmpty, true);
  // A feed-dog afternoon: a fill cut short leaves the bowl empty (slice-4 fix), a full fill refills it.
  await set({phase: 'afternoon', minutes: 900, done: [], petTask: 'feed-dog', afternoonTasks: ['dust-0', 'spill', 'book', 'hall-shoes', 'feed-dog'], dogFoodEmpty: false});
  await standBy('feed-dog'); await offered('feed-dog'); await page.keyboard.press('Space');
  await wait(() => window.__player.snapshot().cleanup.working === 'feed-dog' && window.__player.snapshot().cleanup.dogFood, undefined, 5000);
  await page.evaluate(() => window.__player.session().chores.cancelActivity());
  assert.equal((await snap()).cleanup.dogFood, false, 'cancelled fill: no half-risen kibble');
  await idle();
  await doIt('feed-dog');
  s = await snap(); assert.equal(s.cleanup.dogFood, true); assert.equal(s.pup.food, true);
  await page.evaluate(() => { const s = window.__player.session(); s.pup.bowlWait = 0; s.movement.place(0, .9); });
  await wait(() => window.__player.snapshot().pup.meals === 2, undefined, 60000);

  // --- Fetch (Baxter's half): he brings a toy back beside Arianna and drops it on the floor.
  const fetched = await page.evaluate(async () => {
    const s = window.__player.session(), THREE = await import('/node_modules/.vite/deps/three.js');
    s.movement.place(1.1, 5.2);
    const toy = new THREE.Mesh(new THREE.SphereGeometry(.14), new THREE.MeshStandardMaterial({color: '#a3cbd2'}));
    toy.position.set(3.2, .14, 7.2); s.scene.add(toy); window.__toy = toy; window.__drops = [];
    return s.pup.fetchToy(toy, () => s.movement.position, at => { window.__drops.push(at.toArray()); toy.position.copy(at).setY(at.y + .14); });
  });
  assert.equal(fetched, true, 'fetch accepted');
  await wait(() => window.__player.snapshot().pup.carrying, undefined, 15000);
  await page.screenshot({path: resolve(out, 'family-16-fetch.png')});
  await wait(() => window.__player.snapshot().pup.fetches === 1, undefined, 15000);
  const drop = await page.evaluate(() => window.__drops[0]);
  s = await snap();
  assert.ok(Math.hypot(drop[0] - s.position[0], drop[2] - s.position[2]) < 1.3, `dropped beside Arianna (${drop})`);
  assert.ok(drop[1] < .1, 'on the floor, not hovering');
  assert.equal(s.pup.meals, 2, 'fetch never feeds him');
  assert.deepEqual(errors, []);
  console.log('PASS family-life:', JSON.stringify({paid: s.day.balance - money, meals: s.pup.meals, fetches: s.pup.fetches, dinner: s.marc.dinner.food}));
} finally { await close(); }
