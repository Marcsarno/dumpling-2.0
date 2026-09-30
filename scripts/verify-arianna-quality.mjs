import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

/** User-protected source asset: no texture/mesh/material/rig quality reductions. */
export function verifyAriannaQuality(path='public/assets/characters/arianna/arianna.glb') {
 const bytes=readFileSync(path),jsonLength=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
 const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash,'35cfde9dba8d20d53019d654728972c04f7455ccc533040d00818f86d3f82989',
  `${path}: Arianna must retain the original full-quality source asset. Never replace it with an optimized copy.`);
 const textures=gltf.images.map(image=>{const view=gltf.bufferViews[image.bufferView],offset=view.byteOffset||0;return{name:image.name,width:binary.readUInt32BE(offset+16),height:binary.readUInt32BE(offset+20)};});
 for(const texture of textures)assert.deepEqual([texture.width,texture.height],[2048,2048]);
 return{hash,textures,triangles:gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0),joints:gltf.skins[0].joints.length};
}
const result=verifyAriannaQuality();
console.log('Arianna quality verified:',JSON.stringify(result));
