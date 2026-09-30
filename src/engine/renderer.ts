import {Color, NoToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer} from 'three';

/**
 * One WebGL renderer at the display's full native resolution.
 * PROTECTED RULE (CLAUDE.md): the pixel ratio is always window.devicePixelRatio,
 * never capped or reduced, and re-applied on every resize. Arianna and Lilah must
 * render at native display resolution; optimise scenery instead.
 */
export function createRenderer(canvas: HTMLCanvasElement, clearColor: Color) {
  const renderer = new WebGLRenderer({canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping; // PlayCanvas TONEMAP_LINEAR at exposure 1 during play
  renderer.setClearColor(clearColor, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

/**
 * The single resize owner: measures the viewport element, re-applies the native pixel
 * ratio, sizes the drawing buffer and notifies listeners. Returns a disposer.
 */
export function watchViewport(viewport: HTMLElement, renderer: WebGLRenderer, onResize: (width: number, height: number) => void) {
  const apply = () => {
    const {width, height} = viewport.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height, false);
    onResize(width, height);
  };
  const observer = new ResizeObserver(apply);
  observer.observe(viewport);
  // Moving a window between displays changes devicePixelRatio without a size change.
  let query: MediaQueryList | undefined;
  const watchRatio = () => {
    query?.removeEventListener('change', onRatio);
    query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', onRatio);
  };
  const onRatio = () => { apply(); watchRatio(); };
  watchRatio();
  apply();
  return () => { observer.disconnect(); query?.removeEventListener('change', onRatio); };
}
