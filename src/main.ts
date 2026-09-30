// P0 static world viewer: renders the converted authored world (house and the three
// shops) with daylight, at native resolution, on demand. Characters, toys and gameplay
// arrive in later phases.
//   ?region=house|store-corner|store-toys|store-collector  &view=<viewpoint id>
//   &focus=x,z &height=h   &capture=1 (hides the viewer controls)   &loop=1 (continuous frames)
import {Color, Scene, SRGBColorSpace} from 'three';
import {createRenderer, watchViewport} from './engine/renderer';
import {IsometricCamera} from './engine/IsometricCamera';
import {Daylight} from './engine/lighting';
import {loadRegion, type LoadedRegion} from './world/WorldLoader';
import type {SceneSettings} from './world/format';
import {installProbe} from './dev/probe';
import {PlaySession} from './game/PlaySession';
import {VIEWPOINTS} from '../tests/viewpoints.mjs';

const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.dataset.capture = '';
const base = import.meta.env.BASE_URL;
const status = document.querySelector<HTMLElement>('#status')!;
const regionSelect = document.querySelector<HTMLSelectElement>('#region')!;
const viewSelect = document.querySelector<HTMLSelectElement>('#view')!;

const settings = await (await fetch(`${base}world/scene.json`)).json() as SceneSettings;
const clear = new Color().setRGB(...settings.camera.clearColor, SRGBColorSpace);
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const renderer = createRenderer(canvas, clear);
const scene = new Scene();
const camera = new IsometricCamera(settings.camera);
const daylight = new Daylight(scene, settings);

let frameRequested = false;
const drawNow = () => { daylight.fit(camera.camera); renderer.render(scene, camera.camera); };
// Static views render on demand; the play session drives its own frame loop.
const render = () => {
  if (frameRequested || session) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    drawNow();
    if (params.has('loop')) render();
  });
};
const playing = !params.has('capture') && !params.has('view') && !params.has('focus');
let session: PlaySession | undefined;
watchViewport(document.querySelector<HTMLElement>('#game')!, renderer, (width, height) => { camera.resize(width, height); render(); });

const REGIONS = ['house', 'store-corner', 'store-toys', 'store-collector'];
const regionOf = (id: string) => VIEWPOINTS.find(v => v.id === id)?.scene === 'store' ? 'store-' + VIEWPOINTS.find(v => v.id === id)!.store : 'house';
let current: LoadedRegion | undefined;
async function show(region: string) {
  if (current?.region === region) return;
  status.textContent = `Loading ${region}…`;
  const next = await loadRegion(region, base, !params.has('nobatch'));
  current?.dispose();
  current = next; scene.add(next.root);
  session?.setRegion(next);
  status.textContent = `${region}: ${next.stats.meshes} meshes, ${Math.round(next.stats.triangles).toLocaleString()} triangles${next.problems.length ? `, ${next.problems.length} problems` : ''}`;
  render();
}
function frameView(id: string) {
  const view = VIEWPOINTS.find(v => v.id === id);
  if (view) camera.frame(view.focus[0], view.focus[1], view.height);
  render();
}

for (const r of REGIONS) regionSelect.add(new Option(r, r));
const fillViews = (region: string) => {
  viewSelect.replaceChildren(...VIEWPOINTS.filter(v => regionOf(v.id) === region).map(v => new Option(v.id, v.id)));
};
regionSelect.addEventListener('change', async () => { fillViews(regionSelect.value); await show(regionSelect.value); frameView(viewSelect.value); });
viewSelect.addEventListener('change', () => frameView(viewSelect.value));

installProbe({renderer, camera, current: () => current, render, show});

const initialView = params.get('view') ?? (params.get('region') ? undefined : 'house-bedroom');
const initialRegion = params.get('region') ?? (initialView ? regionOf(initialView) : 'house');
regionSelect.value = initialRegion; fillViews(initialRegion);
await show(initialRegion);
if (initialView) { viewSelect.value = initialView; frameView(initialView); }
else if (params.has('focus')) {
  const [x, z] = params.get('focus')!.split(',').map(Number);
  camera.frame(x, z, params.has('height') ? Number(params.get('height')) : null); render();
} else if (!playing) frameView(viewSelect.value);
if (playing) {
  document.body.dataset.playing = '';
  status.textContent = 'Loading Arianna…';
  session = await PlaySession.start(scene, renderer, camera, current!, drawNow);
  status.textContent = 'Move with the joystick, WASD or arrow keys';
}
Object.defineProperty(window, '__player', {configurable: true, value: {snapshot: () => session?.snapshot(), session: () => session}});
document.body.dataset.ready = 'true';
