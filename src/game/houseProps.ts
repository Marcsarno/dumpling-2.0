import {Group, Vector3} from 'three';
import type {RegionSemantics} from '../world/format';
import {shapes, type Triple} from '../world/primitives';
import type {CleanupItem, CleanupProps} from './cleanupProps';

/** House palette (PlayCanvas bedroom.ts materials). */
const M = {trim: '#fff1df', pink: '#e99db9', pinkLight: '#f6c8d7', purple: '#b39ad7', yellow: '#f3d68f', mint: '#96baa1', blue: '#9cbed5', dark: '#76647e', sky: '#c4e4ea'};
type Visual = 'toy' | 'cloth' | 'plate' | 'trash' | 'bottle' | 'mail' | 'shoes';

/**
 * The house chores (PlayCanvas houseProps.ts): ten carry-and-put-away pairs around the
 * house, built from primitives exactly as PlayCanvas builds them. They serve the House round,
 * Explore, and the afternoon extras of everyday life. The drop-off spots (shoe bench, mail
 * tray, washer, towel rack…) are part of the converted house; Editor anchor/marker/placement
 * edits carry over.
 */
export function addHouseProps(props: CleanupProps, semantics: RegionSemantics): CleanupItem[] {
  const extras: CleanupItem[] = [];
  const pair = (id: string, name: string, icon: string, home: Triple, destination: string, anchor: Triple, placement: Triple, visual: Visual, range = .95) => {
    const object = new Group(); object.name = name; object.position.set(...home); props.root.add(object);
    const item: CleanupItem = {id, name, icon, object, home}; extras.push(item); props.items.push(item);
    const shape = shapes(object);
    if (visual === 'toy') {
      shape('Toy body', 'sphere', [0, .19, 0], [.34, .36, .28], M.yellow);
      shape('Toy head', 'sphere', [0, .44, 0], [.33, .29, .27], M.yellow);
      for (const x of [-.13, .13]) shape('Toy ear', 'sphere', [x, .56, 0], [.13, .13, .1], M.yellow);
      for (const x of [-.065, .065]) shape('Toy eye', 'sphere', [x, .46, .13], [.035, .04, .02], M.dark, false);
      shape('Toy nose', 'sphere', [0, .4, .14], [.05, .035, .025], M.dark, false);
    } else if (visual === 'cloth') {
      shape('Folded fabric', 'box', [0, .07, 0], [.44, .12, .33], id.includes('towel') ? M.blue : M.pink);
      shape('Fabric stripe', 'box', [0, .134, 0], [.32, .015, .07], M.trim, false);
    } else if (visual === 'plate') {
      shape('Dish rim', 'cylinder', [0, .035, 0], [.45, .05, .45], M.trim);
      shape('Dish center', 'cylinder', [0, .063, 0], [.3, .008, .3], M.sky, false);
    } else if (visual === 'bottle') {
      shape('Toiletry bottle', 'cylinder', [0, .17, 0], [.19, .31, .19], M.mint);
      shape('Bottle cap', 'cylinder', [0, .35, 0], [.12, .06, .12], M.trim);
    } else if (visual === 'mail') {
      shape('Envelope', 'box', [0, .04, 0], [.35, .045, .24], M.trim);
      shape('Envelope stamp', 'box', [.1, .067, .06], [.065, .012, .065], M.pink, false);
    } else if (visual === 'shoes') {
      for (const x of [-.11, .11]) shape('Little shoe', 'capsule', [x, .09, 0], [.16, .15, .32], M.purple);
    } else {
      for (let i = 0; i < 3; i++) shape('Crumpled paper', 'box', [(i - 1) * .09, .07 + i * .025, 0], [.16, .13, .16], i % 2 ? M.pinkLight : M.trim);
    }
    props.interactions.push(
      {id: `pickup-${id}`, name, icon, kind: 'pickup', item: id, task: id, anchor: new Vector3(...home), marker: new Vector3(home[0], home[1] + .6, home[2]), range: .85},
      {id: `place-${id}`, name: destination, icon, kind: 'place', item: id, task: id, anchor: new Vector3(...anchor), marker: new Vector3(placement[0], placement[1] + .65, placement[2]), range, placement,
        placedStyle: id === 'bath-towel' ? 'hang' : ['kitchen-trash', 'laundry-clothes'].includes(id) ? 'hide' : undefined},
    );
  };
  pair('hall-shoes', 'Shoes', '👟', [4.45, .09, 2.25], 'Shoe bench', [5.15, 0, 2.5], [5.85, .58, 2.5], 'shoes');
  pair('hall-mail', 'Mail', '✉', [4.05, .09, 1.55], 'Mail tray', [5.15, 0, 1.1], [5.55, .86, 1.1], 'mail');
  pair('living-toy', 'Living-room toy', '🧸', [1.0, .09, 5.25], 'Toy basket', [1.95, 0, 7.85], [1.8, .49, 8.55], 'toy');
  pair('living-cushion', 'Cushion', '♡', [1.0, .09, 6.8], 'Sofa', [-1.3, 0, 6.0], [-2.0, .72, 6.0], 'cloth', 1.05);
  pair('kitchen-dish', 'Dish', '🍽', [-.55, .09, 11.6], 'Kitchen sink', [-1.7, 0, 11.45], [-2.65, 1.04, 11.45], 'plate', 1.05);
  pair('kitchen-trash', 'Trash', '♻', [.4, .09, 10.5], 'Trash bin', [1.3, 0, 10.3], [1.95, .65, 10.3], 'trash');
  pair('laundry-clothes', 'Dirty laundry', '👕', [4.3, .09, 10.9], 'Washer', [3.35, 0, 11.15], [3.35, .53, 10.7], 'cloth');
  pair('laundry-clean', 'Clean laundry', '▤', [5.85, .48, 10.5], 'Folding counter', [5.8, 0, 11.75], [5.78, .97, 12.63], 'cloth');
  pair('bath-towel', 'Bath towel', '▤', [4.65, .09, -1.45], 'Towel rack', [4.05, 0, -.525], [3.62, .84, -.525], 'cloth');
  pair('bath-bottle', 'Toiletries', '♧', [4.7, .09, -2.15], 'Vanity', [4.12, 0, -2.35], [4.1, .96, -3.08], 'bottle');
  // Editor overrides (PlayCanvas LayoutBridge anchor:/marker:/placement: tags) for these pairs.
  const ids = new Set(extras.flatMap(it => [`pickup-${it.id}`, `place-${it.id}`]));
  for (const edit of semantics.interactions ?? []) {
    const target = props.interactions.find(t => t.id === edit.id && ids.has(t.id));
    if (!target) continue;
    if (edit.anchor) target.anchor.set(edit.anchor[0], 0, edit.anchor[2]);
    if (edit.marker) target.marker.set(...edit.marker);
    if (edit.placement) target.placement = [...edit.placement];
  }
  return extras;
}
