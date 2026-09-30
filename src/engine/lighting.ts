import {AmbientLight, Color, DirectionalLight, OrthographicCamera, SRGBColorSpace, Vector3, type Scene} from 'three';
import type {SceneSettings} from '../world/format';

/**
 * Daylight as PlayCanvas renders it: scene ambient plus the one shadow-casting sun.
 * PlayCanvas diffuse is albedo·N·L·light while three.js physical lighting divides
 * diffuse by π, so intensities are scaled by π. Colours are sRGB in both engines.
 */
export class Daylight {
  readonly sun: DirectionalLight;
  readonly ambient: AmbientLight;
  private readonly direction: Vector3;
  private readonly corners = Array.from({length: 8}, () => new Vector3());
  /** A camera, not a plain Object3D: cameras look down -Z like the shadow camera does. */
  private readonly probe = new OrthographicCamera();

  constructor(scene: Scene, private readonly settings: SceneSettings) {
    const {sun, ambient} = settings;
    this.ambient = new AmbientLight(new Color().setRGB(ambient[0], ambient[1], ambient[2], SRGBColorSpace), Math.PI);
    this.sun = new DirectionalLight(new Color().setRGB(sun.color[0], sun.color[1], sun.color[2], SRGBColorSpace), sun.intensity * Math.PI);
    this.direction = new Vector3(...sun.direction).normalize();
    this.sun.castShadow = sun.castShadows;
    this.sun.shadow.mapSize.set(sun.shadowResolution, sun.shadowResolution);
    this.sun.shadow.bias = -.0004;
    this.sun.shadow.normalBias = .025;
    scene.add(this.ambient, this.sun, this.sun.target);
  }

  /**
   * Dusk (PlayCanvas main.ts): as the lamps come on, the sun dims to a sliver and cools
   * toward blue, and the sky ambient darkens, following the house lamps' fade (0 day, 1 night).
   * Shadows stay on (switching them would recompile every shader).
   */
  dusk(amount: number) {
    const {sun, ambient} = this.settings, d = Math.max(0, Math.min(1, amount));
    this.sun.intensity = sun.intensity * (1 - .98 / 1.2 * d) * Math.PI;
    this.sun.color.setRGB(sun.color[0] * (1 - .28 * d), sun.color[1] * (1 - .12 / .92 * d), Math.min(1, sun.color[2] * (1 + .17 / .83 * d)), SRGBColorSpace);
    this.ambient.color.setRGB(ambient[0] * (1 - .42 / .72 * d), ambient[1] * (1 - .36 / .68 * d), ambient[2] * (1 - .31 / .77 * d), SRGBColorSpace);
  }

  /**
   * Fit the shadow map to the visible slice of the view (up to the PlayCanvas shadow
   * distance), extended toward the sun so off-screen casters still shade the view.
   */
  fit(view: OrthographicCamera, casterReach = 30) {
    const far = Math.min(view.far, this.settings.sun.shadowDistance);
    let i = 0;
    for (const x of [view.left, view.right]) for (const y of [view.bottom, view.top]) for (const z of [-view.near, -far])
      this.corners[i++].set(x, y, z).applyMatrix4(view.matrixWorld);
    const center = this.corners.reduce((sum, c) => sum.add(c), new Vector3()).multiplyScalar(1 / 8);
    const distance = casterReach + 60;
    this.sun.target.position.copy(center); this.sun.target.updateMatrixWorld();
    this.sun.position.copy(center).addScaledVector(this.direction, -distance); this.sun.updateMatrixWorld();
    // Light-space extents from the same orientation three.js gives the shadow camera.
    this.probe.position.copy(this.sun.position); this.probe.lookAt(center); this.probe.updateMatrixWorld();
    const inverse = this.probe.matrixWorld.clone().invert();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of this.corners) {
      const p = c.clone().applyMatrix4(inverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, -p.z); maxZ = Math.max(maxZ, -p.z);
    }
    const camera = this.sun.shadow.camera;
    camera.left = minX; camera.right = maxX; camera.bottom = minY; camera.top = maxY;
    camera.near = Math.max(.1, minZ - casterReach); camera.far = maxZ + 1;
    camera.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }
}
