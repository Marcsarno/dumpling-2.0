import {Group, type Scene, type WebGLRenderer} from 'three';
import {loadArianna, ariannaQuality, type LoadedCharacter} from '../characters/Arianna';
import {buildClipLibrary} from '../characters/clips';
import {CarrySocket, CharacterAnimator, groundHeight} from '../characters/CharacterAnimator';
import {Lilah} from './Lilah';
import {PlayerMovement, type MovementArea, type Walkable} from './movement';
import {MoveInput} from '../input/Input';
import {HOUSE_ROOMS} from '../data/house';
import type {IsometricCamera} from '../engine/IsometricCamera';
import type {LoadedRegion} from '../world/WorldLoader';

/** Movement area for a converted region: authored walkables and active colliders. */
export function movementArea(region: LoadedRegion): MovementArea {
  const s = region.data.semantics;
  if (region.region === 'house') {
    // Room ids/titles come from the game data; bounds come from the authored walkable nodes.
    const walkable: Walkable[] = HOUSE_ROOMS.map(room => ({...room}));
    for (const w of s.walkable) if (walkable[w.index]) Object.assign(walkable[w.index], {minX: w.minX, maxX: w.maxX, minZ: w.minZ, maxZ: w.maxZ});
    return {walkable, obstacles: s.colliders, halfWidth: 11.1, halfDepth: 16.4};
  }
  const walkable = s.walkable.map(w => ({minX: w.minX, maxX: w.maxX, minZ: w.minZ, maxZ: w.maxZ}));
  return {walkable, obstacles: s.colliders, halfWidth: Math.max(...walkable.map(w => Math.max(-w.minX, w.maxX))), halfDepth: Math.max(...walkable.map(w => Math.max(-w.minZ, w.maxZ)))};
}

/** Arianna walking the authored world: input → movement → animation → camera, every frame. */
export class PlaySession {
  readonly player = new Group();
  readonly movement: PlayerMovement;
  readonly input: MoveInput;
  animator!: CharacterAnimator;
  character!: LoadedCharacter;
  /** Arianna's held-item point between her hands. */
  socket!: CarrySocket;
  lilah?: Lilah;
  private region: LoadedRegion;
  private last = 0;
  private running = false;

  private constructor(private readonly scene: Scene, private readonly renderer: WebGLRenderer, private readonly camera: IsometricCamera, region: LoadedRegion, private readonly draw: () => void) {
    this.region = region;
    const axes = camera.groundAxes();
    this.movement = new PlayerMovement(axes.right, axes.forward, movementArea(region));
    this.input = new MoveInput(document.querySelector<HTMLElement>('#joystick') ?? undefined, document.querySelector<HTMLElement>('#joystick-knob') ?? undefined);
    this.player.name = 'Player'; scene.add(this.player);
  }

  static async start(scene: Scene, renderer: WebGLRenderer, camera: IsometricCamera, region: LoadedRegion, draw: () => void) {
    const session = new PlaySession(scene, renderer, camera, region, draw);
    session.character = await loadArianna(renderer);
    const library = buildClipLibrary(session.character);
    session.player.add(session.character.root);
    session.animator = new CharacterAnimator(session.character.root, session.character.model, library.clips);
    const hand = (n: string) => session.character.bones.get(n)!;
    session.socket = new CarrySocket(session.character.root, [hand('LeftHand'), hand('RightHand')]);
    // Lilah lives in the house; she loads alongside Arianna and waits out shop visits.
    session.lilah = await Lilah.load(renderer, movementArea(region));
    scene.add(session.lilah.root);
    session.placeAtStart();
    session.running = true; session.last = performance.now();
    requestAnimationFrame(session.frame);
    return session;
  }

  setRegion(region: LoadedRegion) {
    this.region = region; this.movement.setArea(movementArea(region)); this.placeAtStart();
    if (region.region === 'house') this.lilah?.setArea(movementArea(region));
  }

  private placeAtStart() {
    const exit = this.region.data.semantics.exit;
    if (this.region.region === 'house') this.movement.place(0, .9); else if (exit) this.movement.place(0, exit[2] - .4);
    this.sync(1);
  }

  private sync(dt: number) {
    const p = this.movement.position;
    this.player.position.set(p.x, groundHeight(this.region.surfaces, p.x, p.z), p.z);
    this.camera.follow(p.x, p.z, dt);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    // Long stalls (tab switches) never teleport her; per-frame dt is capped like PlayCanvas.
    const dt = Math.min(.04, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.movement.update(dt, this.input.read());
    this.animator.update(dt, this.movement.velocity);
    this.socket.update();
    this.sync(dt);
    this.lilah?.update(dt, this.movement.position, this.region.surfaces, this.region.region === 'house');
    this.draw();
    this.lilah?.updateLabel(this.camera.camera, this.renderer.domElement);
    requestAnimationFrame(this.frame);
  };

  snapshot() {
    return {position: [this.movement.position.x, this.movement.position.y, this.movement.position.z], velocity: [this.movement.velocity.x, 0, this.movement.velocity.z],
      input: [this.input.value.x, this.input.value.y], animation: this.animator.snapshot(), quality: ariannaQuality(this.character, this.renderer),
      socket: this.socket.getWorldPosition(this.socket.position.clone()).toArray(), lilah: this.lilah?.snapshot(this.renderer)};
  }
  stop() { this.running = false; this.input.destroy(); this.player.removeFromParent(); this.lilah?.dispose(); }
}
