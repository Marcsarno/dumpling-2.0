// Tiny read-only GLB inspector for tooling (JSON chunk, accessor counts, node order).
export function parseGlb(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Not a GLB file');
 const jsonLength=bytes.readUInt32LE(12);
 return JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
}

/** Primitives in the order PlayCanvas instantiates them: scene roots depth-first, primitives within each mesh. */
export function flattenedPrimitives(gltf){
 const scene=gltf.scenes[gltf.scene??0],out=[];
 const visit=index=>{
  const node=gltf.nodes[index];
  if(node.mesh!=null)for(const [p,primitive] of gltf.meshes[node.mesh].primitives.entries())
   out.push({node:index,mesh:node.mesh,primitive:p,vertices:gltf.accessors[primitive.attributes.POSITION].count,material:primitive.material??null});
  for(const child of node.children??[])visit(child);
 };
 for(const root of scene.nodes)visit(root);
 return out;
}

/**
 * Placement of every mesh-bearing node relative to the scene, depth-first, as three.js
 * GLTFLoader builds it (only nodes reachable from the scene roots). `compose(t,r,s)`
 * and `matrix(m)` return 4x4 matrices with a `.multiply` method (three.js Matrix4).
 */
export function meshPlacements(gltf,{compose,matrix,identity}){
 const scene=gltf.scenes[gltf.scene??0],out=[];
 const visit=(index,parent)=>{const n=gltf.nodes[index];
  const m=parent.clone().multiply(n.matrix?matrix(n.matrix):compose(n.translation??[0,0,0],n.rotation??[0,0,0,1],n.scale??[1,1,1]));
  if(n.mesh!=null)out.push({node:index,name:n.name,matrix:m});
  for(const c of n.children??[])visit(c,m);};
 for(const root of scene.nodes)visit(root,identity());
 return out;
}
