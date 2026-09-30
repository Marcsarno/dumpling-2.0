import {OrthographicCamera, Vector3} from 'three';
import type {SceneSettings} from '../world/format';

/**
 * The PlayCanvas follow camera (src/game/IsometricCamera.ts): a fixed isometric
 * orthographic view offset from the Editor camera by the focus point.
 */
export class IsometricCamera {
  readonly camera: OrthographicCamera;
  private readonly basePosition: Vector3;
  private readonly baseTarget: Vector3;
  private readonly zoomFactor: number;
  private readonly offset = new Vector3();
  private aspect = 1;
  /** Orthographic half-height; null follows the game's responsive formula. */
  private heightOverride: number | null = null;

  constructor(settings: SceneSettings['camera']) {
    this.zoomFactor = settings.orthoHeight / 7;
    this.basePosition = new Vector3(...settings.position);
    const distance = new Vector3(6, 14, 18.9).distanceTo(new Vector3(0, .8, .9));
    this.baseTarget = this.basePosition.clone().addScaledVector(new Vector3(...settings.forward), distance);
    this.camera = new OrthographicCamera(-1, 1, 1, -1, settings.near, settings.far);
    this.apply();
  }

  /** The game's readable portrait slice: max(5.1, 2.65 / aspect) scaled by the Editor zoom. */
  get playHeight() { return (this.aspect < 1 ? Math.max(5.1, 2.65 / this.aspect) : 5.1) * this.zoomFactor; }

  resize(width: number, height: number) { this.aspect = width / height; this.apply(); }

  /** Centre on a floor point exactly as the follow camera does once settled. */
  frame(focusX: number, focusZ: number, height: number | null = null) {
    this.offset.set(focusX, 0, focusZ - .9);
    this.heightOverride = height;
    this.apply();
  }

  private apply() {
    const h = this.heightOverride ?? this.playHeight, c = this.camera;
    c.left = -h * this.aspect; c.right = h * this.aspect; c.top = h; c.bottom = -h;
    c.position.copy(this.basePosition).add(this.offset);
    c.lookAt(this.baseTarget.clone().add(this.offset));
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
}
