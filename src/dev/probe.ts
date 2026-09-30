import {Vector2, type WebGLRenderer} from 'three';
import {SAVE_PREFIX} from '../systems/SaveNamespace';
import type {IsometricCamera} from '../engine/IsometricCamera';
import type {LoadedRegion} from '../world/WorldLoader';

/**
 * Read-only diagnostics in the shape the PlayCanvas regression scripts use
 * (window.__roomTest.snapshot()), plus rebuild-specific fields. Capture and quality
 * tests drive the viewer through `frame` and `show`.
 */
export function installProbe(options: {
  renderer: WebGLRenderer; camera: IsometricCamera; current: () => LoadedRegion | undefined;
  render: () => void; show: (region: string) => Promise<void>;
}) {
  const {renderer, camera, current, render, show} = options;
  const probe = {
    snapshot() {
      const size = renderer.getDrawingBufferSize(new Vector2());
      const region = current(), info = renderer.info;
      return {
        engine: 'three', savePrefix: SAVE_PREFIX,
        pixelRatio: renderer.getPixelRatio(), devicePixelRatio: window.devicePixelRatio,
        resolution: [size.x, size.y],
        cameraPosition: camera.camera.position.toArray(), cameraHeight: camera.camera.top,
        drawCalls: info.render.calls, triangles: info.render.triangles,
        memory: {...info.memory}, programs: info.programs?.length ?? 0,
        region: region?.region, world: region ? {...region.stats, problems: region.problems} : undefined,
      };
    },
    frame(focus: [number, number], height: number | null) { camera.frame(focus[0], focus[1], height); render(); return probe.snapshot(); },
    show: async (region: string) => { await show(region); return probe.snapshot(); },
  };
  Object.defineProperty(window, '__roomTest', {configurable: true, value: probe});
  return probe;
}
