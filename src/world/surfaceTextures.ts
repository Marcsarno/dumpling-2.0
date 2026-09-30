import {CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture} from 'three';
import type {SurfaceKind} from './format';

/**
 * The PlayCanvas "subtle surface" canvases (src/game/SurfaceTextures.ts), same pixel
 * program. One image per kind; each tiling gets a texture view sharing that image.
 */
const images = new Map<SurfaceKind, HTMLCanvasElement>();
const textures = new Map<string, Texture>();

function paint(kind: SurfaceKind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!, pixels = context.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const weave = Math.sin(x * Math.PI / 8) * Math.sin(y * Math.PI / 8);
    const grain = Math.sin(y * Math.PI / 16 + Math.sin(x * Math.PI / 128) * .7);
    const fiber = Math.sin(x * Math.PI / 4 + y * Math.PI / 8) * 2;
    const value = kind === 'checker' ? ((Math.floor(x / 128) + Math.floor(y / 128)) % 2 ? 218 : 255) : kind === 'tile' ? (x < 4 || y < 4 ? 210 : 250)
      : kind === 'terrazzo' ? (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1 > .87 ? 195 : 247) : kind === 'wood' ? 244 + grain * 7 + Math.sin(y * Math.PI / 2) * 2
      : kind === 'rug' ? 240 + weave * 8 + Math.sin(y * Math.PI / 8) * 3 + fiber : 242 + weave * 9 + fiber;
    const i = (y * 256 + x) * 4; pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function surfaceTexture(kind: SurfaceKind, tiling: number): Texture {
  const key = kind + '@' + tiling;
  let texture = textures.get(key);
  if (!texture) {
    let image = images.get(kind);
    if (!image) { image = paint(kind); images.set(kind, image); }
    const shared = [...textures.values()].find(t => t.image === image);
    texture = shared ? shared.clone() : new CanvasTexture(image);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.repeat.set(tiling, tiling);
    texture.needsUpdate = true;
    texture.name = `Subtle ${kind} surface`;
    textures.set(key, texture);
  }
  return texture;
}
