import type {ActionSpec, PoseKey} from './actions';

/**
 * Arianna's everyday actions. Durations and event times match the PlayCanvas game so the
 * ported gameplay lines up (e.g. MealBite contact at 0.65 s of 1.25 s, PickUp attach at
 * 0.4 s of 0.8 s). The motion itself is new: arcs, eased timing, head and torso follow-through.
 */
/** Food held just in front of the mouth, a hand's width apart. */
const MOUTH = {mouth: [.045, -.045, .045] as [number, number, number]};
/** Forearms resting on the table edge in front of her (seated chest height is about 0.6 m). */
const TABLE: [number, number, number] = [.13, .6, .29];
type V3 = [number, number, number];
type Goal = V3 | {mouth: V3};
const flip = (p: V3): V3 => [-p[0], p[1], p[2]];
const sym = (p: Goal, roll = 0, pole?: V3) => ({
  left: {at: p, roll, pole},
  right: {at: Array.isArray(p) ? flip(p) : {mouth: flip(p.mouth)}, roll, pole: pole && flip(pole)},
});
const seated = (extra: Partial<PoseKey> & {t: number}): PoseKey => ({seat: 1, hips: [0, -.2, 0], lean: 6, ...sym(TABLE, 10), ...extra});
const standing = (t: number, ease: PoseKey['ease'] = 'inOut'): PoseKey => ({t, ease});

/** Two-handed bite: lift on an arc, meet the food with the head, a small chew, settle back. */
const bite = (start: number, head = 14, roll = 25, at: {mouth: V3} = MOUTH, tilt = 10): PoseKey[] => [
  seated({t: start + .35, ...sym({mouth: [.1, -.16, .12]}, 15), lean: 8, head: [4, 0]}),
  seated({t: start + .65, ease: 'out', ...sym(at, roll, [.3, -1, .25]), lean: tilt, head: [head, 0]}),
  seated({t: start + .8, ...sym({mouth: [at.mouth[0], at.mouth[1] - .012, at.mouth[2] + .01]}, roll, [.3, -1, .25]), lean: tilt, head: [head - 4, 0]}),
];

export const ACTIONS: ActionSpec[] = [
  {name: 'CarryIdle', duration: 2, loop: true, keys: [{t: 0, left: {at: 'carry'}, right: {at: 'carry'}}, {t: 2, left: {at: 'carry'}, right: {at: 'carry'}}]},
  {name: 'PickUp', duration: .8, events: [{time: .4, event: 'attach'}], keys: [
    standing(0),
    {t: .4, ease: 'inOut', hips: [0, -.28, -.05], lean: 40, head: [16, 0], ...sym([.09, .2, .3], 20, [.5, -.3, -1])},
    {t: .8, ease: 'inOut', left: {at: 'carry'}, right: {at: 'carry'}},
  ]},
  {name: 'PutDown', duration: .8, events: [{time: .4, event: 'release'}], keys: [
    {t: 0, left: {at: 'carry'}, right: {at: 'carry'}},
    {t: .4, ease: 'inOut', hips: [0, -.28, -.05], lean: 40, head: [16, 0], ...sym([.09, .2, .3], 20, [.5, -.3, -1])},
    standing(.8),
  ]},
  // A child's "yay!": dip, hop with a two-fist pump at chin height, a happy head tilt, a smaller second pump.
  // Arms stay in front of the body, so the jacket never lifts into the rejected bat-wing shape.
  {name: 'Celebrate', duration: 1, keys: [
    standing(0),
    {t: .13, ease: 'out', hips: [0, -.05, 0], lean: 10, head: [6, 0], ...sym([.13, .6, .16], 0)},
    {t: .32, ease: 'out', hips: [0, .045, 0], lean: -5, head: [-10, 8], ...sym([.11, .99, .24], 35, [.3, -1, .2])},
    {t: .5, ease: 'inOut', hips: [0, -.015, 0], lean: 2, head: [-4, 6], ...sym([.12, .86, .22], 30, [.3, -1, .2])},
    {t: .66, ease: 'out', hips: [0, .02, 0], lean: -3, head: [-8, -5], ...sym([.11, .96, .23], 35, [.3, -1, .2])},
    standing(1),
  ]},
  {name: 'MealSit', duration: .65, keys: [standing(0), seated({t: .65})]},
  {name: 'MealIdle', duration: 2, loop: true, keys: [seated({t: 0, head: [4, 0]}), seated({t: 1, head: [6, 4]}), seated({t: 2, head: [4, 0]})]},
  {name: 'MealBite', duration: 1.25, events: [{time: .65, event: 'mouth-contact'}], keys: [seated({t: 0}), ...bite(0), seated({t: 1.25})]},
  // Drinking tips the head back to meet the cup instead of copying the bite.
  {name: 'MealDrink', duration: 1.25, events: [{time: .65, event: 'mouth-contact'}], keys: [seated({t: 0}), ...bite(0, -14, 40, {mouth: [.05, -.055, .05]}, -4), seated({t: 1.25})]},
  {name: 'MealStand', duration: .65, keys: [seated({t: 0}), standing(.65)]},
  {name: 'EatSit', duration: 4.2, keys: [standing(0), seated({t: .55}), seated({t: .9}), ...bite(.75), seated({t: 2.05}), ...bite(1.9), seated({t: 3.2}), seated({t: 3.6}), standing(4.2)]},
  // Chore work (played as the work clip while the task progresses).
  // Wiping: a low squat, leaning in, the right hand circling a paper towel on the floor.
  {name: 'Wipe', duration: 1.2, loop: true, breathe: .3, keys: [0, .3, .6, .9, 1.2].map((t, i) => ({t, ease: 'linear' as const,
    hips: [0, -.36, -.06] as V3, crouch: 1, lean: 58, head: [18, 0] as [number, number],
    right: {at: [-.08 + Math.cos(i * Math.PI / 2) * .09, .16, .4 + Math.sin(i * Math.PI / 2) * .06] as V3, roll: 70},
    left: {at: [.15, .34, .24] as V3, roll: 20}}))},
  // Vacuuming: both hands on the handle, pushing the head forward and drawing it back.
  {name: 'Vacuum', duration: 1.1, loop: true, keys: [
    {t: 0, lean: 8, head: [14, 0], ...sym([.06, .62, .28], 10)},
    {t: .55, lean: 14, head: [16, 0], hips: [0, -.02, .03], ...sym([.06, .6, .42], 10)},
    {t: 1.1, lean: 8, head: [14, 0], ...sym([.06, .62, .28], 10)}]},
  // Brushing teeth: the right hand at her mouth, brushing side to side; a little head tilt.
  {name: 'BrushTeeth', duration: .8, loop: true, breathe: .4, keys: [0, .2, .4, .6, .8].map((t, i) => ({t, ease: 'inOut' as const,
    head: [6, i % 2 ? 4 : -2] as [number, number], right: {at: {mouth: [i % 2 ? .015 : -.045, -.025, .06] as V3}, roll: 60, pole: [-.3, -1, .1] as V3}}))},
  // Reading: the book held open at chest height, head bowed to the page.
  {name: 'Read', duration: 2.4, loop: true, keys: [
    {t: 0, head: [24, 2], ...sym([.09, .74, .27], 25)},
    {t: 1.2, head: [26, -4], ...sym([.095, .745, .27], 25)},
    {t: 2.4, head: [24, 2], ...sym([.09, .74, .27], 25)}]},
  // Getting into bed (3.2 s, matched to the bed-entry path): sit back onto the mattress, swing
  // the legs up, lie back. Ends exactly on Sleep's first frame.
  {name: 'SleepEnter', duration: 3.2, keys: [
    {t: 0},
    {t: .64, hips: [0, -.12, 0], lean: 12, head: [8, 0], ...sym([.2, .42, -.1], 0)},
    {t: 1.38, hips: [0, -.44, 0], legsForward: .75, knees: 70, lean: 8, ...sym([.2, .3, -.05], 0)},
    {t: 2.08, hips: [0, -.45, 0], legsForward: 1, knees: 35, recline: .2, head: [-4, 0]},
    {t: 3.2, ease: 'out', hips: [0, -.46, 0], recline: 1, knees: 25, head: [-6, 0]}]},
  // Asleep: lying on her back, knees a little bent, slow breathing, a sleepy head turn.
  {name: 'Sleep', duration: 4, loop: true, breathe: 1.6, keys: [
    {t: 0, hips: [0, -.46, 0], recline: 1, knees: 25, head: [-6, 0]},
    {t: 2, hips: [0, -.46, 0], recline: 1, knees: 24, head: [-6, 8]},
    {t: 4, hips: [0, -.46, 0], recline: 1, knees: 25, head: [-6, 0]}]},
  {name: 'SitCar', duration: 2, loop: true, keys: [
    {t: 0, seat: 1, hips: [0, -.2, 0], ...sym([.1, .52, .24], 5)}, {t: 2, seat: 1, hips: [0, -.2, 0], ...sym([.1, .52, .24], 5)}]},
];
