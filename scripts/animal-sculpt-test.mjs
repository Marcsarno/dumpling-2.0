import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DUMPLINGS} from '../src/data/collection.ts';

test('Four standalone animal sculpts have finite geometry and bounded mobile complexity',()=>{
 let bytes=0;
 for(const kind of ['panda','frog','bunny','cat']){
  const raw=readFileSync(`public/assets/squishies/animal-${kind}.glb`);bytes+=raw.length;
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(8),raw.length);
  const length=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+length)),binary=raw.subarray(28+length);
  let triangles=0,draws=0;const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
   draws++;const a=gltf.accessors[primitive.attributes.POSITION],v=gltf.bufferViews[a.bufferView];assert.equal(a.componentType,5126);
   for(let n=0;n<a.count;n++)for(let axis=0;axis<3;axis++){
    const value=binary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+n*(v.byteStride??12)+axis*4);assert.ok(Number.isFinite(value));
    bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value);
   }
   triangles+=gltf.accessors[primitive.indices].count/3;
  }
  assert.ok(draws<=7,`${kind}: seven material groups`);assert.ok(triangles<45000,`${kind}: ${triangles} triangles`);
  assert.ok(bounds.max[0]-bounds.min[0]<1.6);assert.ok(bounds.max[1]<1.4);assert.ok(bounds.min[1]>-.03);
  assert.ok(gltf.materials.some(m=>m.name.startsWith('Dough tint')));
  assert.ok(!gltf.images?.some(i=>i.uri),'no external texture dependency');
 }
 assert.ok(bytes<4000000,'four shared sculpts including baked occlusion under 4 MB');
});

test('Each approved animal has two palettes while previous preview ownership IDs remain stable',()=>{
 const expected=['dewdrop-unicorn','sunbeam-unicorn','sugarplum-bunny','opal-bunny','starlight-panda','moonwish-panda','nebula-dragon','solstice-dragon'];
 assert.deepEqual(DUMPLINGS.filter(d=>d.special).map(d=>d.id),expected);
 for(const kind of ['panda','frog','bunny','cat']){
  const pair=DUMPLINGS.filter(d=>d.special===kind);assert.equal(pair.length,2);assert.deepEqual(pair.map(d=>d.rarity),['Epic','Legendary']);
  assert.notEqual(pair[0].color,pair[1].color);assert.notEqual(pair[0].accent,pair[1].accent);
 }
});
