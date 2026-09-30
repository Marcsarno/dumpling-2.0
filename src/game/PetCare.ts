import {Group, Vector3, type Object3D} from 'three';
import {shapes} from '../world/primitives';
import type {CleanupItem, CleanupProps, Interaction} from './cleanupProps';
import {importProp} from './importProp';

export const PET_TASKS = [{id: 'pet-care', name: 'Scoop · flush · wash', icon: '🐾', room: 'Living room & bathroom'}];
type Stage = 'tool' | 'scoop' | 'flush' | 'wash' | 'done';
const POOP_HOME: [number, number, number] = [3.7, .04, 5.3];
const BOWL_WATER: [number, number, number] = [5.78, .5, -.36];

/**
 * Cleaning up after Sunny (PlayCanvas PetCleanup): one chore in four steps. Take the
 * scooper from the landing, scoop the poop in the living room, flush it down the bathroom
 * toilet (it swirls away), then wash hands at the sink. Only handwashing completes the task,
 * and once the poop is flushed nothing else can be started until her hands are clean.
 *
 * Sunny herself is the roaming SunnyPup; PlayCanvas kept a second, static copy here.
 */
export class PetCare {
  stage: Stage = 'tool';
  active = false;
  loaded = false;
  readonly errors: string[] = [];
  readonly tool: CleanupItem;
  readonly poop = new Group();
  readonly bubbles = new Group();
  readonly water: Object3D;
  private flushStart = 0;

  constructor(private readonly props: CleanupProps, base: string) {
    const tool = new Group(); tool.name = 'Pooper scooper'; props.root.add(tool);
    this.tool = {id: 'scooper', name: 'Scooper', icon: '🥄', object: tool, home: [3.8, .04, 3.0], carryPace: 'walk'};
    tool.position.set(...this.tool.home); props.items.push(this.tool);
    this.poop.name = 'Dog poop'; props.root.add(this.poop); this.poop.position.set(...POOP_HOME);
    const paper = new Group(); paper.name = 'Bathroom toilet paper'; paper.position.set(6.21, .7, -.8); props.root.add(paper);
    const soap = new Group(); soap.name = 'Hand soap'; soap.position.set(3.96, .9, -3.24); props.root.add(soap);
    const pets = base + 'assets/pets/';
    void Promise.all([
      importProp(tool, pets + 'shovel.glb', .75, [180, 0, 0]), importProp(this.poop, pets + 'poop.glb', .18),
      importProp(paper, pets + 'paper.glb', .24), importProp(soap, pets + 'soap.glb', .21),
    ]).then(() => { this.loaded = true; }).catch(error => { this.errors.push(String(error)); console.error('Pet assets failed to load', error); });
    const shape = shapes(props.root);
    this.water = shape('Toilet flushing water', 'cylinder', [5.78, .48, -.36], [.33, .015, .28], '#9bdae7', false);
    this.bubbles.name = 'Handwashing bubbles'; props.root.add(this.bubbles);
    const bubble = shapes(this.bubbles);
    for (let i = 0; i < 8; i++) bubble('Soap bubble', 'sphere', [Math.sin(i * 2) * .17, (i % 3) * .065, Math.cos(i * 2) * .12], [.08, .08, .08], '#9bdae7', false);
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
    props.interactions.push(
      {id: 'pickup-scooper', name: 'Scooper', icon: '🥄', kind: 'pickup', item: 'scooper', task: 'pet-care', anchor: v(...this.tool.home), marker: v(3.8, 1, 3), range: .85, available: carried => this.loaded && this.stage === 'tool' && !carried},
      {id: 'scoop-poop', name: 'Dog poop', icon: '💩', kind: 'pet', actionLabel: 'Scoop', task: 'pet-care', item: 'scooper', anchor: v(3.7, 0, 5.3), marker: v(3.7, .55, 5.3), range: .9, available: carried => this.stage === 'scoop' && carried === 'scooper'},
      {id: 'flush-poop', name: 'Toilet', icon: '🚽', kind: 'pet', actionLabel: 'Flush', task: 'pet-care', item: 'scooper', anchor: v(5.15, 0, -.38), marker: v(5.87, 1, -.38), range: .85, available: carried => this.stage === 'flush' && carried === 'scooper'},
      {id: 'wash-hands', name: 'Wash your hands', icon: '🫧', kind: 'pet', actionLabel: 'Wash hands', task: 'pet-care', anchor: v(4.12, 0, -2.35), marker: v(4.1, 1.45, -3.08), range: .9, available: carried => this.stage === 'wash' && !carried},
    );
    this.reset(false);
  }

  /** Once the poop is flushed, only washing up can come next. */
  allows(target: Interaction) { return !this.active || this.stage !== 'wash' || target.task === 'pet-care'; }
  pickedUp() { if (this.stage === 'tool') this.stage = 'scoop'; }
  scoop() {
    if (this.stage !== 'scoop') return;
    this.tool.object.add(this.poop); this.poop.position.set(0, .08, .045); this.stage = 'flush';
  }
  flush(now: number) {
    if (this.stage !== 'flush') return;
    this.props.root.add(this.poop); this.poop.position.set(...BOWL_WATER);
    this.flushStart = now; this.stage = 'wash'; this.tool.object.visible = false;
  }

  /** Per frame: the flush swirl and the soap bubbles at her hands while she washes. */
  update(now: number, washProgress: number, hands: Vector3) {
    this.bubbles.visible = this.active && washProgress > 0;
    if (this.bubbles.visible) { this.bubbles.position.copy(hands); this.bubbles.rotation.y = now / 8 * Math.PI / 180; this.bubbles.scale.set(1 + washProgress * .4, 1, 1); }
    this.water.visible = this.active && this.flushStart > 0 && now - this.flushStart < 900;
    if (this.water.visible) {
      const t = Math.min(1, (now - this.flushStart) / 900), size = Math.max(.01, 1 - t);
      this.poop.position.set(BOWL_WATER[0] + Math.cos(t * 14) * .09 * size, BOWL_WATER[1] - t * .17, BOWL_WATER[2] + Math.sin(t * 14) * .09 * size);
      this.poop.scale.setScalar(size); this.water.rotation.y = t * 400 * Math.PI / 180;
    } else if (this.stage === 'wash' || this.stage === 'done') this.poop.visible = false;
  }

  finish() { this.stage = 'done'; this.bubbles.visible = false; this.poop.visible = false; }

  reset(active: boolean) {
    this.active = active; this.stage = 'tool'; this.flushStart = 0;
    const tool = this.tool.object;
    this.props.root.add(tool); tool.position.set(...this.tool.home); tool.rotation.set(0, 0, 0); tool.scale.setScalar(1); tool.visible = active;
    this.props.root.add(this.poop); this.poop.position.set(...POOP_HOME); this.poop.scale.setScalar(1); this.poop.visible = active;
    this.water.visible = false; this.bubbles.visible = false;
  }

  get hint() {
    if (!this.active || this.stage === 'done') return null;
    return {tool: '🐾 Pick up the scooper by the landing, then find the poop.', scoop: '🥄 Carry the scooper to the dog poop, then tap Scoop.',
      flush: '🚽 Take the loaded scooper to the bathroom toilet and tap Flush.', wash: '🫧 Almost done! Go to the bathroom sink and wash your hands.'}[this.stage];
  }
  snapshot() { return {stage: this.stage, loaded: this.loaded, errors: this.errors, poopVisible: this.poop.visible, poopParent: this.poop.parent?.name, washing: this.bubbles.visible, flushing: this.water.visible}; }
}
