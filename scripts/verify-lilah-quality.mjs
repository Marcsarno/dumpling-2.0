import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

/** Preserve original color, mesh, rig and animation; user-approved 1024px material map. */
export function verifyLilahQuality(path='public/assets/characters/lilah/lilah.glb') {
 const bytes=readFileSync(path),length=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
 const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash,'9070bb9846d6ef53d46a0af0296ab6e8eadffb2c25139267323b2574d6b68a6e',
  `${path}: Lilah must retain original color and geometry with only the approved 1024px material map.`);
 const textures=gltf.images.map(image=>{const offset=gltf.bufferViews[image.bufferView].byteOffset||0;return{name:image.name,width:binary.readUInt32BE(offset+16),height:binary.readUInt32BE(offset+20)};});
 assert.deepEqual(textures.map(t=>[t.width,t.height]),[[2048,2048],[1024,1024]]);
 return{hash,textures};
}
console.log('Lilah quality verified:',JSON.stringify(verifyLilahQuality()));
