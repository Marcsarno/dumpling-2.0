// Shared helpers for chore tests: stand Arianna near a target, then use it with real key
// presses (Space) exactly as a player would — the walk-up, the action and any hold.
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../../tools/paths.mjs';

export const out = resolve(ROOT, 'artifacts', 'play');

/** A disposable headless Edge at phone size (390x844 @3x) on the dev server. */
export async function openGame(port) {
  await mkdir(out, {recursive: true});
  let url = process.env.THREE_URL, server;
  if (!url) { const {createServer} = await import('vite'); server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port, strictPort: false}}); await server.listen(); url = server.resolvedUrls.local[0]; }
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = () => page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__player.snapshot()?.cleanup, undefined, {timeout: 120000});
  await page.goto(url); await ready();
  const close = async () => { await browser.close(); await server?.close(); };
  return {page, errors, ready, close, driver: driver(page)};
}

export function driver(page) {
  const snap = () => page.evaluate(() => window.__player.snapshot());
  const standBy = id => page.evaluate(id => {
    const s = window.__player.session(), t = s.chores.props.interactions.find(t => t.id === id), m = s.movement;
    if (!t) throw Error('no target ' + id);
    for (const r of [.3, .45, .6, .75, .2, .9]) for (let a = 0; a < 24; a++) {
      const x = t.anchor.x + Math.sin(a * Math.PI / 12) * r, z = t.anchor.z + Math.cos(a * Math.PI / 12) * r;
      if (!m.blocked(x, z) && Math.hypot(x - t.anchor.x, z - t.anchor.z) < t.range - .05) { m.place(x, z); return; }
    }
    throw Error('no free spot by ' + id);
  }, id);
  const idle = () => page.waitForFunction(() => { const c = window.__player.snapshot().cleanup; return !c.aligning && !c.working && !window.__player.session().animator.busy; }, undefined, {timeout: 12000});
  const offered = async id => {
    await page.waitForFunction(id => document.querySelector('#action-button')?.dataset.target === id, id, {timeout: 5000})
      .catch(async () => {
        const why = await page.evaluate(id => {
          const s = window.__player.session(), c = s.chores, t = c.props.interactions.find(t => t.id === id);
          return {focus: c.interactions.focus?.id ?? null, available: c.interactions.available(t, c.carried, c.mission), distance: +c.interactions.distance(t, s.movement.position).toFixed(2),
            range: t.range, carrying: c.carried, busy: s.animator.busy, working: c.working, aligning: c.aligning?.id ?? null, mission: c.mission.state, modal: s.hud.modalOpen};
        }, id);
        throw Error(`${id} not offered: ${JSON.stringify(why)}`);
      });
  };
  /** Use a target: `hold` keeps Space down until the work finishes; `during` runs mid-work (e.g. a screenshot). */
  const doIt = async (id, {hold = false, during} = {}) => {
    await standBy(id); await offered(id);
    if (hold) {
      await page.keyboard.down('Space');
      await page.waitForFunction(() => window.__player.snapshot().cleanup.working, undefined, {timeout: 4000});
      if (during) await during();
      await page.waitForFunction(() => !window.__player.snapshot().cleanup.working, undefined, {timeout: 6000});
      await page.keyboard.up('Space');
    } else {
      await page.keyboard.press('Space');
      if (during) { await page.waitForFunction(() => window.__player.snapshot().cleanup.working, undefined, {timeout: 4000}); await during(); }
      else await page.waitForTimeout(80);
    }
    await idle();
  };
  /** The steps for one chore, by task id (dust-N and spill are the everyday-life versions). */
  const steps = task => {
    if (/^dust-\d$/.test(task)) return [['daily-vacuum'], ['vacuum-' + task.slice(5), {hold: true}]];
    if (task === 'spill') return [['take-towel'], ['wipe-spill', {hold: true}]];
    if (task === 'feed-dog') return [['feed-dog']];
    if (task === 'pet-care') return [['pickup-scooper'], ['scoop-poop'], ['flush-poop'], ['wash-hands']];
    if (task === 'dirt') return [['pickup-vacuum'], ['dirt', {hold: true}]];
    if (task === 'crayons') return [['crayons']];
    const place = {teddy: 'toy-chest', shirt: 'hamper', book: 'bookshelf'}[task];
    return [['pickup-' + task], [place ?? 'place-' + task]];
  };
  /** Do a whole chore. In everyday life a vacuum still held afterwards goes back once all dust is done. */
  const chore = async (task, {day = false, during = {}} = {}) => {
    for (const [id, opts] of steps(task)) {
      // Already holding the vacuum from the last dust pile: go straight to the next one.
      if (id === 'daily-vacuum' && (await snap()).cleanup.carrying === 'vacuum') continue;
      await doIt(id, {...opts, during: during[id]});
    }
    if (day && /^dust-/.test(task)) {
      const s = await snap();
      if (s.cleanup.carrying === 'vacuum' && !s.cleanup.dust.some(d => d.visible)) await doIt('put-tool-away');
    }
  };
  const openMenu = async () => { await page.click('#adventure-menu-open'); await page.waitForSelector('#adventure-menu[open]'); };
  const pick = async mode => {
    await openMenu();
    await page.evaluate(() => { document.querySelector('.adventure-activities').open = true; });
    await page.click('#mission-' + mode);
    await page.waitForFunction(mode => window.__player.snapshot().cleanup.mode === mode && !document.querySelector('dialog[open]'), mode);
  };
  return {snap, standBy, idle, offered, doIt, steps, chore, openMenu, pick};
}
