import {
  BackSide, Color, DoubleSide, FrontSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader,
  type BufferGeometry, type Material, type Texture,
} from 'three';
import type {MaterialDef} from './format';
import {surfaceTexture} from './surfaceTextures';

/**
 * PlayCanvas gloss → three.js GGX roughness. PlayCanvas (enableGGXSpecular off) uses a
 * normalised Blinn-Phong lobe with power 2^(11·glossiness); glossInvert means the stored
 * value is roughness-like and is inverted in the shader. Matching the lobe width,
 * alpha = sqrt(2 / (n + 2)) and roughness = sqrt(alpha).
 */
export function roughnessFromGloss(gloss: number, invert: boolean) {
  const glossiness = invert ? 1 - gloss : gloss;
  return Math.min(1, Math.pow(2 / (Math.pow(2, 11 * glossiness) + 2), .25));
}

const srgb = (c: readonly number[]) => new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);
const SIDES = [DoubleSide, FrontSide, BackSide] as const;
const textureLoader = new TextureLoader();
const loadedTextures = new Map<string, Promise<Texture>>();

/** Authored textures follow glTF conventions (no vertical flip), repeat addressing, sRGB colour. */
function loadTexture(url: string) {
  let texture = loadedTextures.get(url);
  if (!texture) {
    texture = textureLoader.loadAsync(url).then(t => { t.flipY = false; t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.needsUpdate = true; return t; });
    loadedTextures.set(url, texture);
  }
  return texture;
}

/** Resolves world material definitions into shared three.js materials for one region. */
export class MaterialLibrary {
  private readonly cache = new Map<string, Material>();
  private readonly maps = new Map<string, Texture>();
  readonly created: Material[] = [];
  constructor(private readonly defs: MaterialDef[], private readonly base: string) {}

  /** Load every authored texture the region references before building materials. */
  async preload() {
    const urls = [...new Set(this.defs.flatMap(d => d.map ? [d.map] : []))];
    await Promise.all(urls.map(async path => this.maps.set(path, await loadTexture(this.base + path))));
  }

  private remember(key: string, build: () => Material) {
    let material = this.cache.get(key);
    if (!material) { material = build(); this.cache.set(key, material); this.created.push(material); }
    return material;
  }

  private authoredMap(def: MaterialDef) {
    if (!def.map) return null;
    const shared = this.maps.get(def.map)!;
    const [u, v] = def.mapTiling ?? [1, 1], [ou, ov] = def.mapOffset ?? [0, 0];
    if (u === 1 && v === 1 && ou === 0 && ov === 0) return shared;
    const view = shared.clone(); view.repeat.set(u, v); view.offset.set(ou, ov); view.needsUpdate = true; return view;
  }

  /** Editor-authored and code-primitive materials are built directly from the definition. */
  direct(index: number, geometry: BufferGeometry) {
    const def = this.defs[index], vertexColors = !!def.vertexColors && !!geometry.getAttribute('color');
    return this.remember(`${index}:${vertexColors}`, () => {
      const m = new MeshStandardMaterial({
        name: def.name, color: srgb(def.color), metalness: def.metalness ?? 0,
        roughness: roughnessFromGloss(def.gloss, def.glossInvert), vertexColors,
        side: SIDES[def.cull ?? 1] ?? FrontSide,
      });
      m.map = def.surface ? surfaceTexture(def.surface.kind, def.surface.tiling) : this.authoredMap(def);
      if (def.emissive) { m.emissive = srgb(def.emissive); m.emissiveIntensity = def.emissiveIntensity ?? 1; }
      if (def.blend === 2 || (def.opacity ?? 1) < 1) { m.transparent = def.blend === 2; m.opacity = def.opacity ?? 1; }
      if (def.depthWrite === false) m.depthWrite = false;
      if (def.alphaTest) m.alphaTest = def.alphaTest;
      m.userData.world = {source: def.source, index}; if (def.lamp) m.userData.lamp = true;
      return m;
    });
  }

  /**
   * HouseArt at runtime clones the model's own glTF material (keeping its texture, alpha
   * and sidedness), then the Editor paint replaces colour and gloss; metalness is 0.
   */
  painted(index: number, source: Material, geometry: BufferGeometry) {
    const def = this.defs[index], from = source as MeshStandardMaterial;
    const vertexColors = !!geometry.getAttribute('color') && !!from.vertexColors;
    return this.remember(`${index}:${source.uuid}:${vertexColors}`, () => {
      const m = new MeshStandardMaterial({
        name: def.name, color: srgb(def.color), metalness: 0, roughness: roughnessFromGloss(def.gloss, true), vertexColors,
        map: def.surface ? surfaceTexture(def.surface.kind, def.surface.tiling) : from.map ?? null,
        transparent: from.transparent, opacity: from.opacity, depthWrite: from.depthWrite, alphaTest: from.alphaTest, side: from.side,
      });
      if (def.emissive) { m.emissive = srgb(def.emissive); m.emissiveIntensity = def.emissiveIntensity ?? 0; }
      m.userData.world = {source: def.source, index}; if (def.lamp) m.userData.lamp = true;
      return m;
    });
  }

  dispose() { for (const m of this.created) m.dispose(); this.cache.clear(); this.created.length = 0; }
}
