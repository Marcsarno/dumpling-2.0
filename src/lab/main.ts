// Motion lab: poses Arianna from any clip at any time, from fixed review angles, under
// the game's daylight. Used for owner motion review and automated motion captures.
//   lab.html?clip=Running&time=0.2&view=front|side|back|three-quarter|game&capture=1
import {AnimationMixer, CircleGeometry, Color, Mesh, MeshStandardMaterial, OrthographicCamera, Scene, SRGBColorSpace, Vector3, type AnimationAction, type AnimationClip} from 'three';
import {createRenderer, watchViewport} from '../engine/renderer';
import {Daylight} from '../engine/lighting';
import type {SceneSettings} from '../world/format';
import {ARIANNA, LILAH, loadCharacter, characterQuality} from '../characters/Arianna';
import {buildClipLibrary} from '../characters/clips';

const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.dataset.capture = '';
const base = import.meta.env.BASE_URL;
const settings = await (await fetch(`${base}world/scene.json`)).json() as SceneSettings;
const renderer = createRenderer(document.querySelector<HTMLCanvasElement>('#game-canvas')!, new Color().setRGB(...settings.camera.clearColor, SRGBColorSpace));
const scene = new Scene();
const daylight = new Daylight(scene, settings);
const floor = new Mesh(new CircleGeometry(1.6, 64).rotateX(-Math.PI / 2), new MeshStandardMaterial({color: new Color('#e9d6bd'), roughness: .8}));
floor.receiveShadow = true; scene.add(floor);

const profile = params.get('character') === 'lilah' ? LILAH : ARIANNA;
const character = await loadCharacter(profile, renderer, base);
scene.add(character.root);
// Lilah plays her own authored clips as supplied; Arianna's library adds the generated motions.
const library = profile === ARIANNA ? buildClipLibrary(character) : {clips: character.clips, notes: {} as Record<string, string>};
const mixer = new AnimationMixer(character.model);
const actions = new Map<string, AnimationAction>(library.clips.map(c => [c.name, mixer.clipAction(c)]));

// Review cameras frame the whole figure; 'game' is the isometric play angle close up.
const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 40);
const VIEWS: Record<string, [number, number, number]> = {front: [0, .72, 6], left: [6, .72, 0], right: [-6, .72, 0], back: [0, .72, -6], 'three-quarter': [4.2, 1.2, 4.2], game: [6, 14, 18.9]};
let view = params.get('view') ?? 'front', aspect = 1;
function applyCamera() {
  const h = .95 * profile.displayHeight / ARIANNA.displayHeight, eye = VIEWS[view] ?? VIEWS.front, target = new Vector3(0, .7 * profile.displayHeight / ARIANNA.displayHeight, 0);
  camera.left = -h * aspect; camera.right = h * aspect; camera.top = h; camera.bottom = -h;
  camera.position.set(...eye).sub(view === 'game' ? new Vector3(0, .8, .9) : new Vector3()).normalize().multiplyScalar(12).add(target);
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

let clip: AnimationClip = library.clips.find(c => c.name === (params.get('clip') ?? 'Idle')) ?? library.clips[0];
let time = Number(params.get('time') ?? 0), playing = false, last = 0;
function pose(name: string, t: number) {
  const next = library.clips.find(c => c.name === name);
  if (!next) throw Error(`Unknown clip ${name}`);
  clip = next; time = Math.max(0, Math.min(t, clip.duration));
  mixer.stopAllAction();
  const action = actions.get(clip.name)!;
  action.reset().play(); action.paused = true; action.time = time;
  mixer.update(0);
  character.model.updateMatrixWorld(true);
  draw();
}
function draw() {
  applyCamera(); daylight.fit(camera, 4); renderer.render(scene, camera);
  timeInput.max = String(clip.duration); timeInput.value = String(time); readout.textContent = `${time.toFixed(3)} s`;
}

const clipSelect = document.querySelector<HTMLSelectElement>('#clip')!, viewSelect = document.querySelector<HTMLSelectElement>('#view')!;
const timeInput = document.querySelector<HTMLInputElement>('#time')!, readout = document.querySelector<HTMLElement>('#readout')!;
for (const c of library.clips) clipSelect.add(new Option(`${c.name} (${c.duration.toFixed(2)} s)`, c.name));
clipSelect.value = clip.name; viewSelect.value = view;
clipSelect.addEventListener('change', () => pose(clipSelect.value, 0));
viewSelect.addEventListener('change', () => { view = viewSelect.value; draw(); });
timeInput.addEventListener('input', () => pose(clip.name, Number(timeInput.value)));
document.querySelector('#play')!.addEventListener('click', () => { playing = !playing; last = performance.now(); if (playing) requestAnimationFrame(tick); });
function tick(now: number) {
  if (!playing) return;
  time = (time + (now - last) / 1000) % clip.duration; last = now; pose(clip.name, time); requestAnimationFrame(tick);
}
watchViewport(document.querySelector<HTMLElement>('#game')!, renderer, (w, h) => { aspect = w / h; draw(); });

Object.defineProperty(window, '__lab', {configurable: true, value: {
  clips: () => library.clips.map(c => ({name: c.name, duration: c.duration})),
  notes: () => library.notes,
  pose: (name: string, t: number, v?: string) => { if (v) view = v; pose(name, t); },
  quality: () => characterQuality(character, renderer),
  bone: (name: string) => { const b = character.bones.get(name)!; return {position: b.getWorldPosition(new Vector3()).toArray(), quaternion: b.getWorldQuaternion(b.quaternion.clone()).toArray()}; },
}});
pose(clip.name, time);
document.body.dataset.ready = 'true';
