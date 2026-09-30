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

  /** Settle toward a floor point like the game's follow camera (1 − e^(−10·dt)). */
  follow(focusX: number, focusZ: number, dt: number) {
    const k = 1 - Math.exp(-10 * dt);
    this.offset.x += (focusX - this.offset.x) * k; this.offset.z += (focusZ - .9 - this.offset.z) * k;
    this.heightOverride = null; this.apply();
  }

  /** Screen-right and screen-up directions on the floor plane, for camera-relative movement. */
  groundAxes() {
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion), forward = new Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    right.y = forward.y = 0; right.normalize(); forward.normalize();
    return {right: {x: right.x, z: right.z}, forward: {x: forward.x, z: forward.z}};
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
