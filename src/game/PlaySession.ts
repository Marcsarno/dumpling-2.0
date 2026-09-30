import {Group, type Scene, type WebGLRenderer} from 'three';
import {loadArianna, ariannaQuality, type LoadedCharacter} from '../characters/Arianna';
import {buildClipLibrary} from '../characters/clips';
import {CarrySocket, CharacterAnimator, groundHeight} from '../characters/CharacterAnimator';
import {Lilah} from './Lilah';
import {Marc} from './Marc';
import {SunnyPup} from './SunnyPup';
import {DayLoop} from './DayLoop';
import {AdventureHUD, type HudState} from '../ui/AdventureHUD';
import {ActionButton} from '../ui/ActionButton';
import {STORES} from '../data/hunt';
import {Chores, type ChoreMode} from './Chores';
import {PlayerMovement, type MovementArea, type Walkable} from './movement';
import {MoveInput} from '../input/Input';
import {HOUSE_ROOMS} from '../data/house';
import type {IsometricCamera} from '../engine/IsometricCamera';
import type {Daylight} from '../engine/lighting';
import {HouseLighting} from '../engine/HouseLighting';
import {HouseMusic} from '../ui/HouseMusic';
import {SoundSettings} from '../ui/SoundSettings';
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
  marc?: Marc;
  pup?: SunnyPup;
  /** The household day: clock, chores, wallet and saves. */
  readonly day: DayLoop;
  hud!: AdventureHUD;
  chores!: Chores;
  action!: ActionButton;
  /** The house's lamps after dark (only while the house is loaded). */
  lighting?: HouseLighting;
  readonly music = new HouseMusic();
  settings!: SoundSettings;
  private drawnSize = '';
  private readonly completed = new Set<string>();
  private syncPicker = () => {};
  private region: LoadedRegion;
  private last = 0;
  private running = false;

  private constructor(private readonly scene: Scene, private readonly renderer: WebGLRenderer, private readonly camera: IsometricCamera, region: LoadedRegion,
    private readonly draw: () => void, private readonly daylight?: Daylight) {
    this.region = region;
    if (region.region === 'house') this.lighting = new HouseLighting(scene, region.data.semantics, region.root);
    const axes = camera.groundAxes();
    this.movement = new PlayerMovement(axes.right, axes.forward, movementArea(region));
    this.input = new MoveInput(document.querySelector<HTMLElement>('#joystick') ?? undefined, document.querySelector<HTMLElement>('#joystick-knob') ?? undefined);
    this.player.name = 'Player'; scene.add(this.player);
    this.day = new DayLoop(localStorage);
  }

  static async start(scene: Scene, renderer: WebGLRenderer, camera: IsometricCamera, region: LoadedRegion, draw: () => void, extraMenu: HTMLElement[] = [], daylight?: Daylight) {
    const session = new PlaySession(scene, renderer, camera, region, draw, daylight);
    session.action = new ActionButton(document.querySelector<HTMLButtonElement>('#action-button')!, () => session.chores?.press(), () => session.chores?.cancelHold());
    const sound = document.createElement('button'); sound.id = 'sound-settings-open'; sound.type = 'button'; sound.className = 'adventure-sound-open';
    sound.textContent = '♫ Sound & performance';
    sound.addEventListener('click', () => { session.hud.close(); session.settings.open(); });
    session.hud = new AdventureHUD(() => { session.input.reset(); session.action.reset(); }, [session.activityPicker(), sound, ...extraMenu]);
    session.character = await loadArianna(renderer);
    const library = buildClipLibrary(session.character);
    session.player.add(session.character.root);
    session.animator = new CharacterAnimator(session.character.root, session.character.model, library.clips);
    const hand = (n: string) => session.character.bones.get(n)!;
    session.socket = new CarrySocket(session.character.root, [hand('LeftHand'), hand('RightHand')]);
    session.chores = new Chores(scene, camera.camera, region.data.semantics, session.movement, session.animator, session.socket, session.day, movementArea(region), hand('RightHand'));
    // The day moving on (a new phase, school, a new morning) resets the routine props.
    session.day.onPhaseChange = phase => {
      session.chores.dayChanged();
      // Home from school: in through the front door (PlayCanvas repositions to the doorway).
      if (phase === 'afternoon') { session.movement.place(-2.1, 8.2); session.animator.setYaw(90 * Math.PI / 180); }
    };
    session.day.onNewDay = () => session.chores.dayChanged();
    session.chores.routines.onSchool = () => session.hud.close();
    // Explore rounds pay nothing, so they leave no receipt behind.
    session.chores.onFinished = (receipt, amount) => { if (amount > 0) session.day.credit(receipt, amount); };
    session.settings = new SoundSettings(renderer, [session.music.button, session.chores.audio.button]);
    // The family lives in the house; they load alongside Arianna and wait out shop visits.
    // (The session starts in the house, so its region carries their chair and routes.)
    const area = movementArea(region);
    [session.lilah, session.marc, session.pup] = await Promise.all([
      Lilah.load(renderer, area), Marc.load(renderer, area, region.data.semantics), SunnyPup.load(renderer, area)]);
    for (const member of [session.lilah, session.marc, session.pup]) scene.add(member.root);
    session.placeAtStart();
    // Compile the lit house now so nightfall never stalls a frame.
    session.lighting?.prepare(renderer, camera.camera);
    session.running = true; session.last = performance.now();
    requestAnimationFrame(session.frame);
    return session;
  }

  setRegion(region: LoadedRegion) {
    this.region = region; this.movement.setArea(movementArea(region)); this.placeAtStart();
    this.lighting?.dispose(); this.lighting = undefined;
    if (region.region === 'house') {
      this.lighting = new HouseLighting(this.scene, region.data.semantics, region.root);
      this.lighting.prepare(this.renderer, this.camera.camera);
      const area = movementArea(region);
      this.lilah?.setArea(area); this.marc?.setArea(area, region.data.semantics); this.pup?.setArea(area);
    }
  }

  private placeAtStart() {
    const exit = this.region.data.semantics.exit;
    if (this.region.region === 'house') this.movement.place(0, .9); else if (exit) this.movement.place(0, exit[2] - .4);
    this.sync(1);
  }

  private sync(dt: number) {
    const p = this.movement.position;
    this.player.position.set(p.x, this.chores?.heightOverride ?? groundHeight(this.region.surfaces, p.x, p.z), p.z);
    this.camera.follow(p.x, p.z, dt);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    // Long stalls (tab switches) never teleport her; per-frame dt is capped like PlayCanvas.
    const dt = Math.min(.04, Math.max(0, (now - this.last) / 1000)); this.last = now;
    const home = this.region.region === 'house';
    // The day runs only at home in everyday life while Arianna is free (PlayCanvas GameLoop pause rules).
    const chores = this.chores;
    // School is a short transition that always runs (PlayCanvas counts it down whenever the day is active).
    const atSchool = this.day.state.phase === 'school';
    this.day.update(dt, home && chores.mode === 'day' && !this.hud.modalOpen && !document.hidden && (atSchool || !this.animator.busy && !chores.working && !this.movement.approaching));
    const input = this.hud.modalOpen ? {x: 0, y: 0} : this.input.read();
    const school = this.day.state.phase === 'school';
    this.movement.enabled = !chores.movementLocked && chores.mission.state !== 'finished' && !school;
    const card = document.querySelector<HTMLElement>('#school-transition'); if (card) card.hidden = !school || !home;
    this.movement.update(dt, input);
    this.action.enabled = home;
    chores.props.root.visible = home;
    if (home) chores.update(now, this.action.held, Math.hypot(input.x, input.y) > .2); else chores.feedback.hide();
    this.animator.update(dt, this.movement.velocity);
    this.socket.update();
    this.sync(dt);
    const arianna = this.movement.position, surfaces = this.region.surfaces;
    const marc = this.marc?.position, pup = this.pup?.position;
    this.lilah?.update(dt, arianna, surfaces, home, [...(marc ? [{...marc, space: .4}] : []), ...(pup ? [{...pup, space: .35}] : [])]);
    this.marc?.update(dt, arianna, this.lilah?.position ?? null, surfaces, home);
    this.pup?.update(dt, [arianna, ...[this.lilah?.position, this.marc?.position].filter(v => !!v)], surfaces, home);
    // After dark at home in everyday life, the lamps come on and the sun sets (PlayCanvas main.ts).
    const night = home && chores.mode === 'day' && this.day.state.phase === 'night';
    this.lighting?.update(night, document.hidden ? 0 : dt);
    this.daylight?.dusk(home ? this.lighting?.amount ?? 0 : 0);
    this.music.update({mode: home ? 'home' : 'store', phase: this.day.state.phase, store: home ? '' : this.region.region, paused: false, revealing: false}, dt);
    // Rendering pauses behind menus (PlayCanvas PerformanceSettings); a resize still redraws.
    const size = `${this.renderer.domElement.width}x${this.renderer.domElement.height}`;
    if (!this.hud.modalOpen || size !== this.drawnSize) { this.draw(); this.drawnSize = size; this.settings.drew(); }
    this.hud.update(this.hudState());
    if (this.hud.menu.open) this.syncPicker();
    this.lilah?.updateLabel(this.camera.camera, this.renderer.domElement);
    this.marc?.updateLabel(this.camera.camera, this.renderer.domElement);
    requestAnimationFrame(this.frame);
  };

  /** Where she is: the room at home, or the shop's name. */
  get location() {
    if (this.region.region !== 'house') return STORES.find(s => 'store-' + s.id === this.region.region)?.name ?? 'Out and about';
    const p = this.movement.position, room = HOUSE_ROOMS.find(r => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);
    return room?.name ?? 'Home';
  }

  private hudState(): HudState {
    const s = this.day.state, m = this.chores.mission, home = this.region.region === 'house', seconds = Math.ceil(m.remaining / 1000);
    const everyday = this.chores.mode === 'day';
    this.completed.clear(); for (const id of everyday ? s.done : m.completed) this.completed.add(id);
    return {location: this.location, day: s.day, time: this.day.clock.label, phase: s.phase, balance: this.day.balance,
      tasks: everyday ? this.day.clock.tasks : m.tasks, completed: this.completed, hint: everyday ? this.chores.dayHint ?? this.day.hint : this.chores.hint,
      timed: home && m.timed, remaining: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, urgent: seconds <= 10 && m.state === 'running',
      clockNote: !home ? '' : m.timed && m.state === 'running' ? 'Your round timer keeps running while you browse.' : everyday ? 'Your day continues while you browse.' : '',
      action: home ? this.chores.action : {ready: false, title: 'Action', detail: 'Come closer'}, message: this.day.message || this.day.problem};
  }

  /** "Choose an activity" in the menu (PlayCanvas mission picker, same ids and labels). */
  private activityPicker() {
    const box = document.createElement('details'); box.className = 'adventure-activities';
    const modes: [ChoreMode, string][] = [['day', 'Daily life'], ['house', 'House · 6'], ['bedroom', 'Bedroom · 5'], ['pet', 'Puppy · 1'], ['practice', 'Explore']];
    box.innerHTML = `<summary>Choose an activity</summary><p>Everyday life, a one-minute round for your allowance, or Explore to practise every chore.</p><div id="mission-picker" aria-label="Choose an activity">${modes.map(([mode, label]) => `<button id="mission-${mode}" type="button">${label}</button>`).join('')}</div>`;
    for (const [mode] of modes) box.querySelector('#mission-' + mode)!.addEventListener('click', () => { this.chores.configure(mode); this.hud.close(); });
    // Kept current every frame while the menu is open (a timed round locks the picker).
    this.syncPicker = () => {
      const locked = !!this.chores && this.chores.mission.state === 'running' && this.chores.mission.timed;
      for (const b of box.querySelectorAll<HTMLButtonElement>('button')) {
        const pressed = String(b.id === 'mission-' + this.chores?.mode);
        if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
        b.disabled = locked;
      }
    };
    return box;
  }

  snapshot() {
    return {position: [this.movement.position.x, this.movement.position.y, this.movement.position.z], velocity: [this.movement.velocity.x, 0, this.movement.velocity.z],
      input: [this.input.value.x, this.input.value.y], animation: this.animator.snapshot(), quality: ariannaQuality(this.character, this.renderer),
      socket: this.socket.getWorldPosition(this.socket.position.clone()).toArray(), lilah: this.lilah?.snapshot(this.renderer),
      marc: this.marc?.snapshot(this.renderer), pup: this.pup?.snapshot(this.renderer),
      day: this.day.snapshot(), location: this.location, cleanup: this.chores.snapshot(),
      lighting: this.lighting?.snapshot() ?? null, daylight: this.daylight ? {sun: this.daylight.sun.intensity, ambient: this.daylight.ambient.color.toArray()} : null,
      music: this.music.snapshot()};
  }
  stop() { this.running = false; this.input.destroy(); this.action.destroy(); this.hud.destroy(); this.chores.dispose(); this.music.destroy(); this.settings.destroy(); this.lighting?.dispose(); this.player.removeFromParent(); this.lilah?.dispose(); this.marc?.dispose(); this.pup?.dispose(); }
}
