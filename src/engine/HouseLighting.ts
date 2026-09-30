import {Color, DirectionalLight, PointLight, SRGBColorSpace, type Camera, type Material, type MeshStandardMaterial, type Object3D, type Scene, type WebGLRenderer} from 'three';
import type {RegionSemantics} from '../world/format';
import {LINEAR_FALLOFF} from './interiorLights';

/** Seconds for the lamps to come fully on or off (PlayCanvas HouseLighting). */
export const LIGHT_FADE_SECONDS = 1.2;
const SHADE_GLOW = .8;
const DEG = Math.PI / 180;

/**
 * The house after dark (PlayCanvas HouseLighting): the 13 Editor-authored interior lights
 * (12 warm lamps and fixtures plus a soft interior bounce) fade in over 1.2 s at night, lamp
 * shades and sconce glass glow, and the sun and sky dim to dusk (see Daylight.dusk). The
 * lamps use PlayCanvas's linear falloff and light only the inside of the house; the garden
 * keeps the sun and sky alone (interiorLights.ts).
 *
 * For phones: three.js forward rendering evaluates every light in the shader and recompiles
 * shaders when the number of lights changes. So the lamps are switched off entirely by day
 * (daylight costs nothing extra), the lit house's shaders are compiled once at load (nightfall
 * never stalls), and the garden, much of the screen, skips the lamps. Capping the lamps at
 * the nearest eight was measured and rejected: on a tall phone the view spans several rooms,
 * and dropped lamps visibly darkened up to a quarter of the screen.
 */
export class HouseLighting {
  private amountValue = 0;
  private readonly lamps: {light: PointLight; intensity: number}[] = [];
  private readonly bounce?: {light: DirectionalLight; intensity: number};
  private readonly shades: MeshStandardMaterial[] = [];
  private on = false;

  constructor(private readonly scene: Scene, semantics: RegionSemantics, world: Object3D) {
    for (const l of semantics.lights ?? []) {
      const color = new Color().setRGB(l.color[0], l.color[1], l.color[2], SRGBColorSpace);
      if (l.type === 'directional') {
        // PlayCanvas "Warm interior bounce" at Euler (45, -30, 0), shining along its -Y axis.
        const a = 45 * DEG, b = -30 * DEG, light = new DirectionalLight(color, 0);
        light.name = l.name; light.position.set(Math.sin(a) * Math.sin(b), Math.cos(a), Math.sin(a) * Math.cos(b));
        this.bounce = {light, intensity: l.intensity * Math.PI};
        scene.add(light, light.target);
        continue;
      }
      const light = new PointLight(color, 0, l.range, LINEAR_FALLOFF);
      light.name = l.name; light.position.set(...l.position); light.castShadow = false;
      this.lamps.push({light, intensity: l.intensity * Math.PI}); scene.add(light);
    }
    this.setOn(false);
    // Shades and sconce glass (the converter flags their materials; batching keeps them apart).
    const seen = new Set<Material>();
    world.traverse(o => {
      const m = (o as {material?: Material}).material;
      if (m && !Array.isArray(m) && !seen.has(m) && m.userData.lamp) { seen.add(m); this.shades.push(m as MeshStandardMaterial); }
    });
  }

  /** 0 in daylight, 1 once the lamps are fully on. */
  get amount() { return this.amountValue; }

  /** Compile the lit house's shaders now, so nightfall never stalls a frame. */
  prepare(renderer: WebGLRenderer, camera: Camera) { this.setOn(true); renderer.compile(this.scene, camera); this.setOn(this.amountValue > 0); }

  private setOn(on: boolean) {
    this.on = on;
    for (const {light} of this.lamps) light.visible = on;
    if (this.bounce) this.bounce.light.visible = on;
  }

  /** Per frame: `night` is whether the lamps should be on. */
  update(night: boolean, dt: number) {
    const target = night ? 1 : 0;
    if (this.amountValue === target && this.on === (target > 0)) return;
    this.amountValue += Math.sign(target - this.amountValue) * Math.min(Math.abs(target - this.amountValue), dt / LIGHT_FADE_SECONDS);
    const amount = this.amountValue;
    if ((amount > 0) !== this.on) this.setOn(amount > 0);
    for (const {light, intensity} of this.lamps) light.intensity = intensity * amount;
    if (this.bounce) this.bounce.light.intensity = this.bounce.intensity * amount;
    for (const m of this.shades) m.emissiveIntensity = amount * SHADE_GLOW;
  }

  snapshot() {
    return {amount: this.amountValue, on: this.on, lamps: this.lamps.map(({light}) => ({name: light.name, visible: light.visible, intensity: light.intensity, range: light.distance})),
      bounce: this.bounce?.light.intensity ?? 0, shades: this.shades.length, shadeGlow: this.shades[0]?.emissiveIntensity ?? 0};
  }

  dispose() { for (const {light} of this.lamps) light.removeFromParent(); this.bounce?.light.target.removeFromParent(); this.bounce?.light.removeFromParent(); }
}
