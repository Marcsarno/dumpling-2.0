// Checks the armpit candidate against the archived original: everything except the skinned
// primitive's vertex/index data must be byte-identical (textures, rig, clips, material).
//   node tools/arianna-armpit/verify-candidate.mjs <original.glb> <candidate.glb>
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const load = path => {
 const bytes = readFileSync(path), jl = bytes.readUInt32LE(12);
 const gltf = JSON.parse(bytes.subarray(20, 20 + jl)), bin = bytes.subarray(28 + jl, 28 + jl + bytes.readUInt32LE(20 + jl));
 return {bytes, gltf, bin, view: i => {const v = gltf.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);}};
};
const [a, b] = process.argv.slice(2).map(load);
const prim = a.gltf.meshes[0].primitives[0];
const meshAccessors = new Set([...Object.values(prim.attributes), prim.indices]);
const meshViews = new Set([...meshAccessors].map(i => a.gltf.accessors[i].bufferView));
const sha = buf => createHash('sha256').update(buf).digest('hex');

assert.equal(b.gltf.bufferViews.length, a.gltf.bufferViews.length);
let same = 0;
for (let i = 0; i < a.gltf.bufferViews.length; i++) {
 if (meshViews.has(i)) continue;
 assert.equal(sha(b.view(i)), sha(a.view(i)), `buffer view ${i} changed`); same++;
}
const strip = g => JSON.stringify({...g, bufferViews: g.bufferViews.map(({byteOffset, ...v}, i) => meshViews.has(i) ? {} : v),
 accessors: g.accessors.map((x, i) => meshAccessors.has(i) ? {} : x), buffers: []});
assert.equal(strip(b.gltf), strip(a.gltf), 'JSON differs outside the mesh data');
for (const im of b.gltf.images) { const v = b.view(im.bufferView); assert.deepEqual([v.readUInt32BE(16), v.readUInt32BE(20)], [2048, 2048]); }
// original vertices keep position, normal, UV and tangent exactly
const acc = (g, i) => { const x = g.gltf.accessors[i], v = g.gltf.bufferViews[x.bufferView]; return new Float32Array(g.bin.buffer, g.bin.byteOffset + (v.byteOffset ?? 0), x.count * {VEC2: 2, VEC3: 3, VEC4: 4}[x.type]); };
const n0 = a.gltf.accessors[prim.attributes.POSITION].count;
for (const k of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT']) {
 const pa = acc(a, prim.attributes[k]), pb = acc(b, prim.attributes[k]);
 for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) throw Error(`${k} of original vertex ${Math.floor(i / (pa.length / n0))} changed`);
}
const weights = acc(b, b.gltf.meshes[0].primitives[0].attributes.WEIGHTS_0);
for (let i = 0; i < weights.length; i += 4) { const s = weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3]; if (Math.abs(s - 1) > 1e-4) throw Error(`weights of vertex ${i / 4} sum to ${s}`); }
const tris = x => x.gltf.accessors[x.gltf.meshes[0].primitives[0].indices].count / 3;
console.log(JSON.stringify({
 unchangedBufferViews: same, textures: b.gltf.images.map(i => i.name + ' 2048x2048 identical'),
 joints: b.gltf.skins[0].joints.length, clips: b.gltf.animations.map(x => x.name),
 vertices: [n0, b.gltf.accessors[b.gltf.meshes[0].primitives[0].attributes.POSITION].count], triangles: [tris(a), tris(b)],
 sha256: sha(b.bytes), bytes: b.bytes.length,
}, null, 1));
