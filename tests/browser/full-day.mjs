// A whole household day with real key presses (disposable headless Edge, 390x844 @3x):
// the morning routine, school, the five afternoon chores (vacuuming two dust piles, two house
// chores and pet care), the night routine, tucking Lilah in, and bed. The day pays the full
// $12 once (11 routines + the tuck-in). Also: a reload mid-afternoon keeps finished chores done
// and tidied; a second afternoon covers the spill, the puppy's bowl and the other place styles.
// Dad's dinner is marked served up front so he isn't walking through the scripted chores
// (family-life.mjs covers it).
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {openGame, out} from './lib/chore-driver.mjs';

const {page, errors, ready, close, driver: {snap, doIt, chore, idle}} = await openGame(5227);
try {
  const day = async () => (await snap()).day;
  const setAfternoon = tasks => page.evaluate(tasks => {
    const s = window.__player.session();
    Object.assign(s.day.state, {phase: 'afternoon', minutes: 900, done: [], afternoonTasks: tasks, petTask: tasks.includes('feed-dog') ? 'feed-dog' : 'pet-care', dogFoodEmpty: false, dinnerServed: true});
    s.day.update(0, false); s.day.save(); s.chores.dayChanged();
  }, tasks);
  let d = await day();
  assert.deepEqual([d.day, d.phase], [1, 'morning']);
  const money = d.balance;
  await page.waitForFunction(() => window.__player.session().chores.pet.loaded, undefined, {timeout: 30000});

  // Morning (the quick breakfast: the egg cracks cleanly).
  await page.evaluate(() => { window.__player.session().day.state.eggDrop = false; });
  await doIt('daily-teeth'); await doIt('choose-clothes'); await doIt('get-dressed');
  await doIt('take-egg'); await doIt('crack-egg'); await doIt('cook-egg'); await doIt('serve-breakfast'); await doIt('eat-breakfast');
  d = await day(); assert.equal(d.balance, money + 3, 'three morning routines'); assert.equal(d.ready, true);
  await doIt('school-door');
  await page.waitForFunction(() => window.__player.snapshot().day.phase === 'afternoon', undefined, {timeout: 8000});

  // Afternoon A: two dust piles, shoes, trash and pet care.
  await setAfternoon(['dust-0', 'dust-1', 'hall-shoes', 'kitchen-trash', 'pet-care']);
  d = await day(); assert.deepEqual(d.tasks, ['dust-0', 'dust-1', 'hall-shoes', 'kitchen-trash', 'pet-care']);
  let s = await snap();
  assert.deepEqual(s.cleanup.dust.map(x => x.visible), [true, true, false], 'two dust piles out');
  assert.equal(s.cleanup.items.find(i => i.id === 'vacuum').visible, true, 'the vacuum is out for the afternoon');
  assert.equal(s.cleanup.items.find(i => i.id === 'hall-shoes').visible, true);
  assert.equal(s.cleanup.items.find(i => i.id === 'living-toy').visible, false, 'chores not due today stay away');
  assert.equal(s.cleanup.pet.poopVisible, true);

  await chore('dust-0', {day: true, during: {'vacuum-0': async () => {
    await page.waitForTimeout(450); const w = await snap();
    assert.equal(w.cleanup.workClip, 'Vacuum'); assert.equal(w.cleanup.audio.kind, 'vacuum', 'vacuum sound');
    assert.match(await page.locator('#adventure-journal [data-hint]').textContent(), /vacuum/i, 'the nudge follows the vacuum');
    await page.screenshot({path: resolve(out, 'afternoon-10-vacuum.png')});
  }}});
  s = await snap(); assert.equal(s.cleanup.carrying, 'vacuum', 'still holding the vacuum for the next pile');
  await chore('dust-1', {day: true});
  s = await snap(); assert.equal(s.cleanup.carrying, null, 'vacuum put back');
  assert.deepEqual(s.cleanup.items.find(i => i.id === 'vacuum').position.map(v => +v.toFixed(2)), [4.65, .1, 12.15]);
  d = await day(); assert.ok(d.done.includes('dust-0') && d.done.includes('dust-1')); assert.equal(d.balance, money + 5);

  await chore('hall-shoes');
  d = await day(); assert.ok(d.done.includes('hall-shoes')); assert.equal(d.balance, money + 6);
  // Reload: the shoes stay on the bench and aren't offered again.
  await page.reload(); await ready();
  await page.waitForFunction(() => window.__player.session().chores.pet.loaded, undefined, {timeout: 30000});
  s = await snap(); d = s.day;
  assert.deepEqual([d.phase, d.balance], ['afternoon', money + 6]);
  const shoes = s.cleanup.items.find(i => i.id === 'hall-shoes');
  assert.deepEqual(shoes.position.map(v => +v.toFixed(2)), [5.85, .58, 2.5], 'shoes still on the bench after a reload');
  assert.deepEqual(s.cleanup.dust.map(x => x.visible), [false, false, false], 'vacuumed piles stay clean');

  await chore('kitchen-trash');
  s = await snap(); assert.equal(s.cleanup.items.find(i => i.id === 'kitchen-trash').visible, false, 'trash goes into the bin');

  // Pet care: scooper → scoop → flush → wash. Nothing else while her hands need washing.
  await chore('pet-care', {during: {'wash-hands': async () => {
    await page.waitForTimeout(500); const w = await snap();
    assert.equal(w.cleanup.workClip, 'WashHands'); assert.equal(w.cleanup.pet.washing, true); assert.equal(w.cleanup.audio.kind, 'water');
    await page.screenshot({path: resolve(out, 'afternoon-11-wash.png')});
  }}});
  s = await snap(); d = s.day;
  assert.equal(s.cleanup.pet.stage, 'done'); assert.equal(s.cleanup.pet.poopVisible, false);
  assert.equal(d.ready, true); assert.equal(d.balance, money + 8, 'five afternoon chores');

  // Evening comes at 7:00 PM once everything is done.
  await page.evaluate(() => { window.__player.session().day.state.minutes = 1139.6; });
  await page.waitForFunction(() => window.__player.snapshot().day.phase === 'night', undefined, {timeout: 6000});
  await doIt('daily-teeth'); await doIt('night-clothes'); await doIt('clothes-drawer'); await doIt('bedtime-book');
  d = await day(); assert.equal(d.balance, money + 11, 'eleven routines');
  // Lilah is sleepy and waiting at her crib (brought close to keep the test short).
  await page.evaluate(() => window.__player.session().lilah.place(8.4, -.9));
  await page.waitForFunction(() => window.__player.snapshot().lilah.tuckable, undefined, {timeout: 20000});
  await doIt('lilah-bed');
  await page.waitForFunction(() => window.__player.snapshot().lilah.state === 'sleeping', undefined, {timeout: 5000});
  d = await day(); assert.equal(d.balance, money + 12, 'the day routine pays $12');
  await doIt('sleep');
  await page.waitForFunction(() => window.__player.snapshot().day.day === 2, undefined, {timeout: 10000});
  d = await day(); assert.equal(d.balance, money + 12, 'nothing paid twice');
  const receipts = await page.evaluate(() => JSON.parse(localStorage.getItem('dumpling.three.progress.v1')).creditedRounds);
  assert.equal(receipts.filter(r => r.startsWith('day-1-')).length, 12, 'one receipt per routine and the tuck-in');
  await page.waitForTimeout(400); await idle();

  // Afternoon B (day 2): the spill, the book, laundry, the towel rack and the puppy's bowl.
  await setAfternoon(['dust-0', 'spill', 'book', 'bath-towel', 'feed-dog']);
  s = await snap(); assert.equal(s.cleanup.dogFood, false, 'the bowl is empty until she fills it');
  assert.equal(s.cleanup.pet.poopVisible, false, 'no pet care today');
  const before = (await day()).balance;
  await chore('spill', {during: {'wipe-spill': async () => {
    await page.waitForTimeout(400); assert.equal((await snap()).cleanup.audio.kind, 'wipe');
  }}});
  s = await snap(); assert.equal(s.cleanup.carrying, null, 'the towel is used up');
  await chore('book');
  await chore('bath-towel');
  s = await snap(); const towel = s.cleanup.items.find(i => i.id === 'bath-towel');
  assert.deepEqual(towel.position.map(v => +v.toFixed(2)), [3.62, .84, -.53], 'towel hung on the rack');
  await chore('feed-dog', {during: {'feed-dog': async () => {
    await page.waitForTimeout(700); const w = await snap();
    assert.equal(w.cleanup.workClip, 'FeedBowl'); assert.equal(w.cleanup.dogFood, true, 'kibble pours in');
    await page.screenshot({path: resolve(out, 'afternoon-12-feed.png')});
  }}});
  s = await snap(); assert.equal(s.cleanup.dogFood, true, 'the bowl is full');
  await chore('dust-0', {day: true});
  d = await day(); assert.equal(d.ready, true); assert.equal(d.balance, before + 5);
  await page.screenshot({path: resolve(out, 'afternoon-13-done.png')});
  assert.deepEqual(errors, []);
  console.log('PASS full-day:', JSON.stringify({routine: 12, afternoonB: d.balance - before, balance: d.balance}));
} finally { await close(); }
