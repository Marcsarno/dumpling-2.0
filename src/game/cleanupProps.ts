import {Group, Vector3, type Object3D} from 'three';
import type {TaskId} from '../systems/MissionSystem';
import type {RegionSemantics} from '../world/format';
import {shapes, type Triple} from '../world/primitives';

export type {Triple};
export type ItemId = string;
/** Something Arianna can carry (PlayCanvas CleanupItem). `home` is its position under the props root. */
export interface CleanupItem {
  id: ItemId; name: string; icon: string; object: Object3D; home: Triple;
  /** 'walk' makes carrying it a steady walk (the vacuum). */
  carryPace?: 'walk' | 'run';
  /** Item-local point held in the hands; default is the centre of its bounds. */
  carryGrip?: Triple;
  carriedScale?: number;
}
/** Something Arianna can do (PlayCanvas Interaction, read by the vendored InteractionSystem). */
export interface Interaction {
  id: string; name: string; icon: string;
  kind: 'pickup' | 'place' | 'crayons' | 'vacuum' | 'pet' | 'daily';
  /** Work time in ms for timed work; 0 plays an instant PickUp/PutDown. */
  duration?: number;
  /** Work stops when the button is released. */
  hold?: boolean;
  /** Shrinks while the work progresses. */
  mess?: Object3D;
  actionLabel?: string;
  available?: (carried: ItemId | null) => boolean;
  /** Floor point for range checks and the glowing ring (y ignored). */
  anchor: Vector3;
  /** Where the icon label and reward popup float. */
  marker: Vector3;
  range: number;
  item?: ItemId;
  task?: TaskId;
  /** Where a carried item is set down; also the approach and facing point. */
  placement?: Triple;
  placedStyle?: 'hide' | 'hang';
}

export interface CleanupProps {
  root: Group; items: CleanupItem[]; interactions: Interaction[];
  crayonMess: Object3D; tidyCrayons: Object3D; dirt: Object3D;
  reset(): void;
}

const M = {
  bear: '#ba865e', muzzle: '#f5d4a3', pink: '#e486ad', blue: '#739fcf', purple: '#9c7ac3',
  cream: '#fff0dc', dark: '#65506e', yellow: '#f1cd75', mint: '#89b99f', dirt: '#a9949d',
};
const DEG = Math.PI / 180;

/**
 * The bedroom tidy set (PlayCanvas cleanupProps.ts): teddy, shirt, book and the vacuum,
 * the scattered crayons with their tidy cup, and a dust pile, built from primitives exactly
 * as PlayCanvas builds them. The drop-off spots (toy chest, hamper, bookshelf) come from
 * the Editor scene when it has them, so owner layout edits carry over; the hamper itself
 * is already part of the converted house.
 */
export function createCleanupProps(semantics: RegionSemantics): CleanupProps {
  const root = new Group(); root.name = 'Cleanup props';
  const item = (id: ItemId, name: string, icon: string, home: Triple): CleanupItem => {
    const object = new Group(); object.name = name; object.position.set(...home); root.add(object);
    return {id, name, icon, object, home};
  };
  const items = [
    item('teddy', 'Teddy', '🧸', [-.7, .11, 1.55]),
    item('shirt', 'Shirt', '👕', [-1.7, .12, .55]),
    item('book', 'Book', '📘', [.25, .12, -.8]),
    item('vacuum', 'Vacuum', '✦', [4.65, .1, 12.15]),
  ];
  const teddy = shapes(items[0].object);
  teddy('Teddy body', 'sphere', [0, .16, 0], [.3, .34, .25], M.bear);
  teddy('Teddy head', 'sphere', [0, .4, 0], [.33, .3, .28], M.bear);
  for (const x of [-.13, .13]) {
    teddy('Teddy ear', 'sphere', [x, .52, 0], [.13, .13, .09], M.bear);
    teddy('Teddy foot', 'sphere', [x, .045, .07], [.15, .12, .18], M.bear);
    teddy('Teddy paw', 'sphere', [x * 1.4, .2, 0], [.12, .2, .13], M.bear);
    teddy('Teddy eye', 'sphere', [x * .5, .43, .135], [.035, .04, .02], M.dark, false);
  }
  teddy('Teddy muzzle', 'sphere', [0, .36, .13], [.15, .1, .075], M.muzzle);
  const shirt = shapes(items[1].object);
  shirt('Shirt body', 'box', [0, .035, 0], [.4, .055, .46], M.pink);
  for (const x of [-.26, .26]) shirt('Sleeve', 'box', [x, .035, -.14], [.22, .06, .18], M.pink).rotation.y = (x < 0 ? -25 : 25) * DEG;
  shirt('Shirt flower', 'sphere', [0, .065, -.04], [.13, .012, .13], M.cream, false);
  const book = shapes(items[2].object);
  book('Book pages', 'box', [0, .055, 0], [.36, .09, .46], M.cream);
  for (const y of [.005, .11]) book('Book cover', 'box', [0, y, 0], [.4, .02, .5], M.blue);
  book('Book spine', 'box', [-.19, .055, 0], [.025, .12, .5], M.blue);
  book('Cover star', 'sphere', [0, .125, 0], [.12, .012, .12], M.yellow, false);
  Object.assign(items[3], {carryPace: 'walk', carryGrip: [0, .92, 0], carriedScale: .75});
  const vacuum = shapes(items[3].object);
  vacuum('Vacuum head', 'box', [0, .06, .12], [.45, .13, .3], M.purple);
  vacuum('Vacuum tank', 'capsule', [0, .36, 0], [.24, .49, .21], M.purple);
  vacuum('Vacuum handle', 'cylinder', [0, .72, 0], [.055, .44, .055], M.dark);
  vacuum('Vacuum grip', 'box', [0, .92, 0], [.23, .06, .07], M.dark);

  const crayonMess = new Group(); crayonMess.name = 'Scattered crayons'; crayonMess.position.set(2.23, 1.2, .97); root.add(crayonMess);
  const crayons = shapes(crayonMess);
  [M.pink, M.blue, M.yellow, M.mint].forEach((hex, i) =>
    crayons('Scattered crayon', 'cylinder', [-.33 + i * .2, .015, i % 2 * .17], [.065, .31, .065], hex).rotation.set(90 * DEG, i * 43 * DEG, 0));
  const tidyCrayons = new Group(); tidyCrayons.name = 'Tidy crayon cup'; tidyCrayons.position.set(1.86, 1.14, 1.05); root.add(tidyCrayons);
  const tidy = shapes(tidyCrayons);
  tidy('Pencil cup', 'cylinder', [0, .1, 0], [.2, .2, .2], M.purple);
  [M.pink, M.blue, M.yellow, M.mint].forEach((hex, i) => tidy('Tidy crayon', 'cylinder', [(i % 2 - .5) * .07, .22, (Math.floor(i / 2) - .5) * .07], [.045, .25, .045], hex));
  tidyCrayons.visible = false;
  const dirt = new Group(); dirt.name = 'Dirt pile'; dirt.position.set(-1.4, .085, 2.65); root.add(dirt);
  const dust = shapes(dirt);
  for (let i = 0; i < 7; i++) { const a = i * 2.4; dust('Dust clump', 'sphere', [Math.sin(a) * .24, .012, Math.cos(a) * .24], [.25 + i % 2 * .12, .05, .23], M.dirt, false); }

  const v = (t: Triple) => new Vector3(...t);
  const interactions: Interaction[] = items.map(it => ({
    id: `pickup-${it.id}`, name: it.name, icon: it.icon, kind: 'pickup', item: it.id,
    anchor: v(it.home), marker: new Vector3(it.home[0], it.home[1] + (it.id === 'vacuum' ? .82 : .62), it.home[2]), range: .85,
  }));
  interactions.push(
    {id: 'toy-chest', name: 'Toy chest', icon: '🧸', kind: 'place', item: 'teddy', task: 'teddy', anchor: v([2.48, 0, -.79]), marker: v([2.48, 1.45, -1.55]), range: 1.1, placement: [2.48, .85, -1.55]},
    {id: 'hamper', name: 'Laundry hamper', icon: '👕', kind: 'place', item: 'shirt', task: 'shirt', anchor: v([-2.55, 0, 1]), marker: v([-2.55, 1.04, 1]), range: 1.05, placement: [-2.55, .69, 1]},
    {id: 'bookshelf', name: 'Bookshelf', icon: '📘', kind: 'place', item: 'book', task: 'book', anchor: v([1.12, 0, -2.55]), marker: v([1.12, 2.35, -3.05]), range: 1.05, placement: [1.51, .79, -2.99]},
    {id: 'crayons', name: 'Crayons', icon: '🖍', kind: 'crayons', task: 'crayons', anchor: v([1.6, 0, 1.05]), marker: v([2.15, 1.68, 1.04]), range: .88},
    {id: 'dirt', name: 'Dirt pile', icon: '✦', kind: 'vacuum', item: 'vacuum', task: 'dirt', anchor: v([-1.4, 0, 2.65]), marker: v([-1.4, .55, 2.65]), range: 1},
  );
  // Editor overrides (PlayCanvas LayoutBridge anchor:/marker:/placement: tags), e.g. the moved bookshelf.
  for (const edit of semantics.interactions ?? []) {
    const target = interactions.find(t => t.id === edit.id);
    if (!target) continue;
    if (edit.anchor) target.anchor.set(edit.anchor[0], 0, edit.anchor[2]);
    if (edit.marker) target.marker.set(...edit.marker);
    if (edit.placement) target.placement = [...edit.placement];
  }
  // Reset touches only this set; other systems (daily routines) add their own items and targets later.
  const homes = new Map(interactions.map(t => [t, {anchor: t.anchor.clone(), marker: t.marker.clone()}]));
  const own = [...items];
  const reset = () => {
    for (const it of own) { root.add(it.object); it.object.position.set(...it.home); it.object.rotation.set(0, 0, 0); it.object.scale.setScalar(1); it.object.visible = true; }
    crayonMess.visible = true; crayonMess.scale.setScalar(1); dirt.visible = true; dirt.scale.setScalar(1); tidyCrayons.visible = false;
    for (const [t, h] of homes) { t.anchor.copy(h.anchor); t.marker.copy(h.marker); }
  };
  return {root, items, interactions, crayonMess, tidyCrayons, dirt, reset};
}
