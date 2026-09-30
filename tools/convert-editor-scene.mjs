// Offline converter: PlayCanvas Editor export (scene 2600724) → Dumpling Three world files.
//
// Inputs (read-only, at the pinned PlayCanvas commit):
//   editor-release/2600724.json   authored entities, transforms, enabled flags, tags
//   editor-release/config.json    material, render and container assets
//   editor-release/files/...      Editor containers (primitive counts) and Editor-only textures
//   migration/layout-source.json  what the code built under each Editor record (source material names, models)
// Outputs (written inside this repository):
//   public/world/<region>.json    render nodes, resolved materials, model references, semantic sidecar
//   public/world/scene.json       camera, sun, ambient; public/world/index.json with hashes and counts
//   public/world/textures/*       Editor-only textures the authored materials reference
//
// The runtime merge in PlayCanvas (src/editor/LayoutBridge.ts) is reproduced here once,
// offline: Editor transforms are authoritative; code materials supply everything the
// Editor paint does not (see tools/runtime-material-rules.mjs).
import {writeFileSync,mkdirSync,readFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {resolve,basename,extname} from 'node:path';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Euler,Vector3,Box3,MathUtils} from 'three';
import {ROOT,REFERENCE,requirePlaycanvas,playcanvasBlob,assertWritable,warnIfReferenceMoved} from './paths.mjs';
import {sha256} from './protected.mjs';
import {parseGlb,flattenedPrimitives,meshPlacements} from './glb.mjs';
import {PRIMITIVE_DEFAULTS,PRIMITIVE_SURFACES,LAMP_SHADES,LAMP_EMISSIVE,houseArtRule} from './runtime-material-rules.mjs';

requirePlaycanvas();warnIfReferenceMoved();
const sceneBytes=playcanvasBlob(REFERENCE.editorSceneFile),configBytes=playcanvasBlob(REFERENCE.editorConfigFile),layoutBytes=playcanvasBlob('migration/layout-source.json');
const scene=JSON.parse(sceneBytes),assets=JSON.parse(configBytes).assets,layout=JSON.parse(layoutBytes);
const E=scene.entities,ids=Object.keys(E);
const manifest=JSON.parse(readFileSync(resolve(ROOT,'assets.manifest.json'),'utf8'));
const shipped=new Set(manifest.files.map(f=>f.path));

const REGIONS={'Maple cottage':'house','Clover Corner':'store-corner','Peachy Playroom':'store-toys','Moonbeam Finds':'store-collector','Classroom trading club':'classroom'};
const OBSOLETE=new Set(['Classroom trading club']); // disabled at startup by recess.usesReferenceLayout
const PRIMITIVES=new Set(['box','sphere','cylinder','cone','plane','capsule']);

// ---------- math (PlayCanvas conventions) ----------
const r6=v=>Math.round(v*1e6)/1e6||0;
const quat=([x,y,z])=>new Quaternion().setFromEuler(new Euler(x*MathUtils.DEG2RAD,y*MathUtils.DEG2RAD,z*MathUtils.DEG2RAD,'ZYX')); // == pc.Quat.setFromEulerAngles
const local=e=>new Matrix4().compose(new Vector3(...e.position),quat(e.rotation),new Vector3(...e.scale));
const worldCache=new Map();
const world=id=>{if(worldCache.has(id))return worldCache.get(id);const e=E[id],m=e.parent?world(e.parent).clone().multiply(local(e)):local(e);worldCache.set(id,m);return m;};
const unitAabb=id=>new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(world(id)); // == pc BoundingBox.setFromTransformedAabb
const position=id=>new Vector3().setFromMatrixPosition(world(id)).toArray().map(r6);
const trs=e=>{const q=quat(e.rotation);return{p:e.position.map(r6),q:[q.x,q.y,q.z,q.w].map(v=>Math.round(v*1e7)/1e7||0),s:e.scale.map(r6)};};
const tagValue=(e,prefix)=>e.tags.find(t=>t.startsWith(prefix))?.slice(prefix.length);
const GLB_MATH={compose:(t,r,s)=>new Matrix4().compose(new Vector3(...t),new Quaternion(...r),new Vector3(...s)),matrix:m=>new Matrix4().fromArray(m),identity:()=>new Matrix4()};

// ---------- assets ----------
/** Editor container name → the shipped public original (geometry-identical for the containers used, see audit). */
function containerSource(containerId){
 const name=assets[containerId].name;let path;
 if(name.startsWith('layout__'))path='assets/'+name.slice(8).split('__').join('/');
 else if(name==='merch__bao-squishy.glb')path='assets/store-kit/bao-squishy-display.glb';
 else if(name==='merch__bamboo-steamer-shelf.glb')path='assets/store-kit/bamboo-steamer-shelf-display.glb';
 else if(name.startsWith('kit__'))path='assets/store-kit/'+name.slice(5);
 if(!path||!shipped.has(path))throw Error(`No shipped original for Editor container ${name} (${path})`);
 return path;
}
const glbCache=new Map();
const publicGlb=path=>{if(!glbCache.has(path))glbCache.set(path,parseGlb(readFileSync(resolve(ROOT,'public',path))));return glbCache.get(path);};
const editorGlb=containerId=>{const key='editor:'+containerId;if(!glbCache.has(key))glbCache.set(key,parseGlb(playcanvasBlob('editor-release/'+decodeURIComponent(assets[containerId].file.url))));return glbCache.get(key);};
const renderAsset=id=>{const a=assets[id];assert.equal(a?.type,'render',`render asset ${id}`);return{container:a.data.containerAsset,index:a.data.renderIndex};};

// Editor texture assets → shipped public file when one is byte-identical, else an Editor-only copy.
const textures=new Map(),hashToPublic=new Map(manifest.files.map(f=>[f.sha256,f.path]));
function texture(id){
 if(id==null)return undefined;if(textures.has(id))return textures.get(id);
 const a=assets[id];assert.equal(a?.type,'texture',`texture asset ${id}`);
 const bytes=playcanvasBlob('editor-release/'+decodeURIComponent(a.file.url.split('?')[0])),hash=sha256(bytes);
 let path=hashToPublic.get(hash);
 if(!path){path=`world/textures/${hash.slice(0,12)}-${basename(a.file.filename??a.name)}`;mkdirSync(resolve(ROOT,'public/world/textures'),{recursive:true});writeFileSync(assertWritable(resolve(ROOT,'public',path)),bytes);}
 textures.set(id,path);return path;
}

// ---------- materials ----------
const editorMaterial=id=>{const a=assets[id];assert.equal(a?.type,'material',`material asset ${id}`);return a;};
const gloss=d=>r6((d.shininess??25)/100);
/** A material exactly as the Editor defines it (store art and other Editor-only renders). */
function fromEditor(id){
 const {name,data:d}=editorMaterial(id);
 return {source:'editor',name,color:d.diffuse,workflow:d.useMetalness?'metalness':'specular',metalness:d.metalness,specular:d.specular,gloss:gloss(d),glossInvert:!!d.glossInvert,
  emissive:d.emissive,emissiveIntensity:d.emissiveIntensity,opacity:d.opacity,blend:d.blendType,depthWrite:d.depthWrite,alphaTest:d.alphaTest,cull:d.cull,twoSided:!!d.twoSidedLighting,
  vertexColors:!!d.diffuseVertexColor,map:texture(d.diffuseMap),mapTiling:d.diffuseMap!=null?d.diffuseMapTiling:undefined,mapOffset:d.diffuseMap!=null?d.diffuseMapOffset:undefined,
  opacityMap:texture(d.opacityMap),opacityMapChannel:d.opacityMap!=null?d.opacityMapChannel:undefined,normalMap:texture(d.normalMap)};
}
/** A code primitive material (primitives.ts material()) painted by the Editor. */
function paintedPrimitive(paintId,sourceName){
 const {data:p}=editorMaterial(paintId),surface=PRIMITIVE_SURFACES[sourceName];
 return {source:'code-primitive',name:sourceName,color:p.diffuse,workflow:'specular',metalness:p.metalness,specular:p.specular,gloss:gloss(p),glossInvert:PRIMITIVE_DEFAULTS.glossInvert,
  emissive:LAMP_SHADES.has(sourceName)?LAMP_EMISSIVE.color:[0,0,0],emissiveIntensity:LAMP_SHADES.has(sourceName)?LAMP_EMISSIVE.dayIntensity:1,lamp:LAMP_SHADES.has(sourceName)||undefined,
  opacity:1,blend:3,depthWrite:true,alphaTest:0,cull:1,twoSided:false,vertexColors:false,
  map:p.diffuseMap!=null?texture(p.diffuseMap):undefined,surface:p.diffuseMap==null&&surface?{kind:surface[0],tiling:surface[1]}:undefined};
}
/** A HouseArt glTF material (cloned at runtime) painted by the Editor; the glTF keeps its maps, alpha and sidedness. */
function paintedModel(paintId,runtimeName){
 const {data:p}=editorMaterial(paintId),rule=houseArtRule(runtimeName);
 if(!rule)throw Error(`Unrecognised HouseArt material name ${runtimeName}`);
 return {source:'gltf-painted',name:runtimeName,color:p.diffuse,workflow:'metalness',metalness:0,gloss:gloss(p),glossInvert:true,
  surface:rule.surface?{kind:rule.surface[0],tiling:rule.surface[1]}:undefined,lamp:rule.lamp||undefined,
  emissive:rule.lamp?LAMP_EMISSIVE.color:undefined,emissiveIntensity:rule.lamp?LAMP_EMISSIVE.dayIntensity:undefined};
}

// ---------- conversion ----------
const records=new Map(layout.records.map(r=>[r.key,r]));
// layout-source `enabled` is PlayCanvas GraphNode.enabled, i.e. enabled *in hierarchy*. Scopes
// whose room was switched off at capture (the shops) report every record false, so only a
// live scope's false means the code itself disabled that original (e.g. the hidden books).
const liveScopes=new Set(layout.records.filter(r=>r.enabled).map(r=>r.scope));
const codeDisabled=record=>record.enabled===false&&liveScopes.has(record.scope);
const children=id=>E[id].children;
const envRoots=ids.filter(id=>E[id].tags.includes('migration.environment'));
const counted=new Set(),stats={previewsVerified:0,previewNodeMismatches:[],castShadowMismatches:0};
const regions={};

for(const envId of envRoots){
 const scope=tagValue(E[envId],'scope:'),region=REGIONS[scope];assert.ok(region,`Unknown scope ${scope}`);
 const nodes=[],materials=[],materialIndex=new Map(),models=[],modelIndex=new Map();
 const mat=def=>{const clean=JSON.parse(JSON.stringify(def));const key=JSON.stringify(clean);if(!materialIndex.has(key)){materialIndex.set(key,materials.length);materials.push(clean);}return materialIndex.get(key);};
 const model=path=>{if(!modelIndex.has(path)){modelIndex.set(path,models.length);models.push({src:path,sha256:manifest.files.find(f=>f.path===path).sha256});}return modelIndex.get(path);};

 const emit=(id,parent)=>{
  const e=E[id];counted.add(id);
  const node={name:e.name,parent,...trs(e)};
  if(!e.enabled)node.enabled=false;
  const tags=e.tags.filter(t=>!['migration.record','migration.preview'].includes(t));if(tags.length)node.tags=tags;
  const key=tagValue(e,'key:'),record=key?records.get(key):undefined;
  if(key){assert.ok(record,`Editor record ${key} missing from layout-source.json`);node.key=key;if(codeDisabled(record))node.codeEnabled=false;}
  const render=e.components.render;
  if(render){
   const shadow={castShadow:!!render.castShadows,receiveShadow:render.receiveShadows!==false};
   if(PRIMITIVES.has(render.type)){
    let material;
    if(record){
     assert.ok(record.render&&record.material,`record ${key} has no code primitive`);
     material=paintedPrimitive(render.materialAssets[0],record.material.name);
     if(record.render.castShadows!==shadow.castShadow){stats.castShadowMismatches++;}
     shadow.castShadow=record.render.castShadows; // the code-built original renders at runtime
    }else material=fromEditor(render.materialAssets[0]);
    node.shape={type:render.type,material:mat(material),...shadow};
    if(render.enabled===false)node.shape.enabled=false;
   }else if(render.type==='asset'){
    assert.ok(!record,`record ${key} carries an asset render`);
    const {container,index}=renderAsset(render.asset),src=containerSource(container),gltf=publicGlb(src);
    const primitives=gltf.meshes[index].primitives;
    assert.equal(editorGlb(container).meshes[index].primitives.length,primitives.length,`${src} mesh ${index} primitive count`);
    node.mesh={model:model(src),mesh:index,materials:primitives.map((_,i)=>render.materialAssets[i]!=null?mat(fromEditor(render.materialAssets[i])):null),
     vertices:primitives.map(p=>gltf.accessors[p.attributes.POSITION].count),...shadow};
    if(render.enabled===false)node.mesh.enabled=false;
   }else throw Error(`Unsupported render type ${render.type} on ${e.name}`);
  }
  const index=nodes.length;nodes.push(node);
  for(const child of children(id)){
   if(E[child].tags.includes('migration.preview'))emitPreview(child,index,record,key);
   else emit(child,index);
  }
 };

 // A record's preview stands in for the code-built model: keep its transform (the model's
 // normalization), instantiate the public GLB under it, paint primitives in PlayCanvas order.
 const emitPreview=(id,parent,record,key)=>{
  const e=E[id];counted.add(id);
  assert.ok(record?.model,`preview under ${key} without a code model`);
  const src='assets/'+record.model;assert.ok(shipped.has(src),`model ${src} not shipped`);
  const gltf=publicGlb(src),flat=flattenedPrimitives(gltf);
  const paints=[],placed=[];
  const walk=(d,parentMatrix)=>{counted.add(d);const r=E[d].components.render,m=parentMatrix.clone().multiply(local(E[d]));
   if(r){assert.equal(r.type,'asset');const {container,index}=renderAsset(r.asset);
    assert.equal(containerSource(container),src,`${key} preview container differs from its code model`);
    const count=editorGlb(container).meshes[index].primitives.length;for(let i=0;i<count;i++)paints.push(r.materialAssets[i]??null);placed.push({name:E[d].name,matrix:m});}
   for(const c of children(d))walk(c,m);};
  for(const c of children(id))walk(c,new Matrix4());
  assert.equal(paints.length,flat.length,`${key}: preview paints ${paints.length} vs ${flat.length} model primitives`);
  assert.equal(record.modelMaterials.length,flat.length,`${key}: layout-source materials vs model primitives`);
  // Each mesh must sit where three.js will place it from the GLB, or dropping the Editor clones would move geometry.
  const glbMeshes=meshPlacements(gltf,GLB_MATH);
  if(glbMeshes.length!==placed.length)stats.previewNodeMismatches.push(`${key}: ${placed.length} preview meshes vs ${glbMeshes.length} GLB mesh nodes`);
  else{glbMeshes.forEach((g,i)=>{const a=placed[i].matrix.elements,b=g.matrix.elements,off=Math.max(...a.map((v,k)=>Math.abs(v-b[k])));
   if(off>1e-4)stats.previewNodeMismatches.push(`${key} mesh ${i} (${placed[i].name}) off by ${off.toExponential(2)}`);});stats.previewsVerified++;}
  const node={name:e.name,parent,...trs(e),model:{model:model(src),
   materials:flat.map((p,i)=>paints[i]!=null?mat(paintedModel(paints[i],record.modelMaterials[i].name)):null),
   vertices:flat.map(p=>p.vertices),castShadow:true,receiveShadow:true}};
  if(!e.enabled)node.enabled=false;
  nodes.push(node);
 };

 emit(envId,-1);
 regions[region]={scope,envId,nodes,materials,models,obsolete:OBSOLETE.has(scope)||undefined};
}

// ---------- authored edits ----------
// PlayCanvas cuts the front doorway at runtime (src/game/Outdoors.ts installDoor): it disables
// wall pieces and obsolete trees/fence, then patches the wall, and its batcher can leave ghost
// geometry. Here the same design intent is baked into the world once, as data.
const EDITS=[];
{
 const house=regions.house,nodeWorld=new Map();
 const worldOf=i=>{if(nodeWorld.has(i))return nodeWorld.get(i);const n=house.nodes[i],m=new Matrix4().compose(new Vector3(...n.p),new Quaternion(...n.q),new Vector3(...n.s));
  const w=n.parent>=0?worldOf(n.parent).clone().multiply(m):m;nodeWorld.set(i,w);return w;};
 house.nodes.forEach((n,i)=>{
  const p=new Vector3().setFromMatrixPosition(worldOf(i));
  const doorway=(['Painted cottage wall','Ivory wall cap','Cottage skirting'].includes(n.name)&&Math.abs(p.x+3.3)<.2&&p.z>5.8&&p.z<7.4)||['Front door timber','Front door inset','Door brass handle'].includes(n.name);
  const route=(n.name.startsWith('Art tree')&&p.z<-3)||(n.name==='Art fence_planksDouble'&&Math.abs(p.z+6)<.2&&p.x<1);
  if(doorway||route){n.enabled=false;n.removedBy=doorway?'front-doorway':'garden-route';EDITS.push(`${n.removedBy}: hid ${n.name} at ${p.toArray().map(v=>v.toFixed(2)).join(',')}`);}
 });
 const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
 const code=(name,h)=>({source:'code-primitive',name,color:hex(h),workflow:'specular',metalness:0,specular:[.08,.07,.09],gloss:.15,glossInvert:false,emissive:[0,0,0],emissiveIntensity:1,opacity:1,blend:3,depthWrite:true,alphaTest:0,cull:1,twoSided:false,vertexColors:false});
 const addMaterial=def=>{house.materials.push(def);return house.materials.length-1;};
 const wall=addMaterial(code('Entry plaster repair','#f3dfca')),trim=addMaterial(code('Entry ivory repair','#f5e9d6'));
 for(const [a,b] of [[3.6,7.6],[8.95,9.5]]){
  house.nodes.push({name:'Open entry wall',parent:0,p:[-3.3,1.325,(a+b)/2],q:[0,0,0,1],s:[.14,2.65,r6(b-a)],shape:{type:'box',material:wall,castShadow:true,receiveShadow:true},addedBy:'front-doorway'});
  house.nodes.push({name:'Open entry skirting',parent:0,p:[-3.28,.12,(a+b)/2],q:[0,0,0,1],s:[.16,.16,r6(b-a)],shape:{type:'box',material:trim,castShadow:true,receiveShadow:true},addedBy:'front-doorway'});
 }
 EDITS.push('front-doorway: added 2 entry wall and 2 skirting pieces');
}

// ---------- semantics ----------
const inScope=(id,envId)=>{for(let p=id;p;p=E[p].parent)if(p===envId)return true;return false;};
const enabledBelow=(id,envId)=>{for(let p=id;p&&p!==envId;p=E[p].parent)if(!E[p].enabled)return false;return true;};
const depthFirst=[];(function walk(id){depthFirst.push(id);for(const c of E[id].children)walk(c);})(ids.find(id=>E[id].parent===null));
const tagged=prefix=>depthFirst.filter(id=>E[id].tags.some(t=>t.startsWith(prefix)));
const aabbJson=b=>({center:b.getCenter(new Vector3()).toArray().map(r6),half:b.getSize(new Vector3()).multiplyScalar(.5).toArray().map(r6)});
const PROP_SPACES=[['bed',-2.05,-1.7],['crib',9.8,-1.7],['dining',.55,13.85],['marc-seat',4.5,7.35],['stove',-2.72,12.65],['fridge',-2.65,14.55],['clothes',-.7,3.05]]; // LayoutBridge.ts

for(const [region,r] of Object.entries(regions)){
 const {scope,envId}=r,mine=id=>inScope(id,envId);
 const code=layout.rooms.find(room=>room.name===scope);
 const sem={};
 // PlayCanvas keeps only colliders enabled below the (temporarily enabled) room root; inactive ones are kept, flagged.
 sem.colliders=tagged('collision:'+scope).filter(mine).map(id=>({...aabbJson(unitAabb(id)),index:tagValue(E[id],'index:')!=null?Number(tagValue(E[id],'index:')):undefined,active:enabledBelow(id,envId)?undefined:false}));
 sem.walkable=tagged('walkable:'+scope).filter(mine).map(id=>{const b=unitAabb(id);return{index:Number(tagValue(E[id],'index:')),minX:r6(b.min.x),maxX:r6(b.max.x),minZ:r6(b.min.z),maxZ:r6(b.max.z)};});
 const first=prefix=>{const id=tagged(prefix).find(mine);return id?position(id):undefined;};
 if(region==='house'){
  // Doorway collision matches the baked edit: the old wall span is open, two jamb pieces block.
  const authored=sem.colliders.length;
  sem.colliders=sem.colliders.filter(b=>!(Math.abs(b.center[0]+3.3)<.2&&b.center[2]-b.half[2]<8.25&&b.center[2]+b.half[2]>8.25)).concat(
   [[3.6,7.6],[8.95,9.5]].map(([a,b])=>({center:[-3.3,.7,r6((a+b)/2)],half:[.07,1.4,r6((b-a)/2)],addedBy:'front-doorway'})));
  sem.colliderEdits={authored,removed:authored-(sem.colliders.length-2),added:2};
  EDITS.push(`front-doorway: collision opened (${sem.colliderEdits.removed} removed, 2 jambs added)`);
  const interactionIds=[...new Set(tagged('anchor:').filter(mine).map(id=>tagValue(E[id],'anchor:')))];
  sem.interactions=interactionIds.map(id=>({id,anchor:first('anchor:'+id),marker:first('marker:'+id),placement:first('placement:'+id)}));
  sem.propSpaces=PROP_SPACES.map(([key,x,z])=>{const index=code.obstacles.findIndex(b=>Math.abs(b.center[0]-x)<.01&&Math.abs(b.center[2]-z)<.01),
   id=tagged('prop:Maple cottage:'+index).find(id=>tagValue(E[id],'prop:')==='Maple cottage:'+index);
   return id?{key,origin:[x,0,z],world:world(id).toArray().map(r6)}:{key,origin:[x,0,z],missing:true};});
 }
 if(region.startsWith('store-')){
  sem.sites=[...new Set(tagged(scope+':').filter(mine).map(id=>E[id].tags.find(t=>t.startsWith(scope+':')).split(':')[1]))]
   .map(site=>({id:site,anchor:first(`${scope}:${site}:anchor`),marker:first(`${scope}:${site}:marker`)}));
  sem.exit=first('exit:'+scope);
  sem.stock=tagged('stock:'+scope+':').filter(mine).map(id=>{const [,,site,n]=tagValue(E[id],'').split(':');const e=E[id];
   return {site:Number(site),slot:Number(n),parentProp:tagValue(E[e.parent],'prop:'),position:e.position.map(r6),rotation:e.rotation.map(r6),scale:e.scale.map(r6)};});
  sem.propGroups=tagged('prop:'+scope+':').filter(mine).filter(id=>E[id].tags.includes('migration.prop')).map(id=>{const i=Number(tagValue(E[id],'prop:'+scope+':'));
   return {index:i,origin:code.obstacles[i]?.center.map(r6),world:world(id).toArray().map(r6)};});
 }
 sem.lights=tagged('light:').filter(mine).map(id=>{const l=E[id].components.light;return{name:tagValue(E[id],'light:'),position:position(id),type:l.type,color:l.color,intensity:l.intensity,range:l.range,enabled:E[id].enabled};});
 if(region==='classroom')sem.tradingAnchors=tagged('trading-anchor').filter(mine).map(id=>({name:E[id].name,position:position(id)}));
 r.semantics=sem;
}

// ---------- scene-level ----------
const rootId=ids.find(id=>E[id].parent===null);counted.add(rootId);
const rootChild=tag=>E[rootId].children.find(id=>E[id].tags.includes(tag));
const cameraId=rootChild('migration.camera'),sunId=rootChild('migration.sun');
for(const id of E[rootId].children)if(!envRoots.includes(id))counted.add(id); // camera, sun, disabled default Box and Plane
const cam=E[cameraId],sun=E[sunId];
const forward=new Vector3(0,0,-1).applyQuaternion(quat(cam.rotation)),sunDirection=new Vector3(0,-1,0).applyQuaternion(quat(sun.rotation));
const sceneJson={format:'dumpling-world/1',
 camera:{position:cam.position,rotation:cam.rotation,forward:forward.toArray().map(r6),orthoHeight:cam.components.camera.orthoHeight,near:cam.components.camera.nearClip,far:cam.components.camera.farClip,clearColor:cam.components.camera.clearColor.slice(0,3)},
 sun:{rotation:sun.rotation,direction:sunDirection.toArray().map(r6),...Object.fromEntries(['color','intensity','castShadows','shadowResolution','shadowDistance','numCascades','shadowBias','normalOffsetBias','shadowType'].map(k=>[k,sun.components.light[k]])),mask:9},
 ambient:scene.settings.render.global_ambient,gammaCorrection:scene.settings.render.gamma_correction,toneMapping:scene.settings.render.tonemapping,exposure:scene.settings.render.exposure};

// ---------- assertions (audit §6.4 / P0 exit criteria) ----------
const all=Object.values(E),count=pred=>all.filter(pred).length,hasTag=t=>e=>e.tags.includes(t),prefixed=p=>e=>e.tags.some(t=>t.startsWith(p));
const expect={entities:4430,records:1019,colliders:128,walkables:12,anchors:34,markers:34,placements:13,siteTags:36,stock:36,exits:3,lights:13,storeArt:756,previews:295,renders:2570};
const actual={entities:ids.length,records:count(hasTag('migration.record')),colliders:count(prefixed('collision:')),walkables:count(prefixed('walkable:')),
 anchors:count(prefixed('anchor:')),markers:count(prefixed('marker:')),placements:count(prefixed('placement:')),
 siteTags:count(e=>e.tags.some(t=>/^(Clover Corner|Peachy Playroom|Moonbeam Finds):[^:]+:(anchor|marker)$/.test(t))),
 stock:count(prefixed('stock:')),exits:count(prefixed('exit:')),lights:count(prefixed('light:')),storeArt:count(hasTag('store.art')),previews:count(hasTag('migration.preview')),renders:count(e=>!!e.components.render)};
assert.deepEqual(actual,expect,'Editor scene census changed');
assert.equal(counted.size,ids.length,`Converter accounted for ${counted.size} of ${ids.length} entities`);
const regionCount=(key,fn)=>Object.values(regions).reduce((n,r)=>n+fn(r),0);
const converted={
 colliders:regionCount('c',r=>r.semantics.colliderEdits?.authored??r.semantics.colliders.length),activeColliders:regionCount('a',r=>r.semantics.colliders.filter(c=>c.active!==false).length),walkables:regionCount('w',r=>r.semantics.walkable.length),
 interactions:regions.house.semantics.interactions.length,placements:regions.house.semantics.interactions.filter(i=>i.placement).length,
 sites:regionCount('s',r=>r.semantics.sites?.length??0),stock:regionCount('k',r=>r.semantics.stock?.length??0),exits:regionCount('x',r=>r.semantics.exit?1:0),
 lights:regionCount('l',r=>r.semantics.lights.length),
 records:regionCount('r',r=>r.nodes.filter(n=>n.key).length),
 renders:regionCount('n',r=>r.nodes.filter(n=>n.shape||n.mesh||n.model).length),
};
assert.deepEqual({...converted,renders:undefined,activeColliders:undefined},{colliders:128,activeColliders:undefined,walkables:12,interactions:34,placements:13,sites:18,stock:36,exits:3,lights:13,records:1019,renders:undefined});
assert.ok(regions.house.semantics.propSpaces.every(p=>!p.missing),'prop space not found');
assert.equal(stats.previewNodeMismatches.length,0,'Preview clones differ from GLB nodes:\n'+stats.previewNodeMismatches.slice(0,10).join('\n'));

// ---------- write ----------
const outDir=resolve(ROOT,'public/world');mkdirSync(outDir,{recursive:true});
for(const f of readdirSync(outDir))if(f.endsWith('.json'))rmSync(assertWritable(resolve(outDir,f)));
const source={repo:REFERENCE.playcanvasRepo,commit:REFERENCE.playcanvasCommit,scene:scene.id??REFERENCE.editorScene,checkpoint:scene.checkpoint_id,
 sceneSha256:sha256(sceneBytes),configSha256:sha256(configBytes),layoutSourceSha256:sha256(layoutBytes)};
const index={format:'dumpling-world/1',note:'Generated by tools/convert-editor-scene.mjs from the pinned PlayCanvas Editor export. Do not edit by hand.',source,census:actual,converted,edits:EDITS,regions:{},textures:[...new Set(textures.values())]};
for(const [region,r] of Object.entries(regions)){
 const file={format:'dumpling-world/1',region,scope:r.scope,obsolete:r.obsolete,source,materials:r.materials,models:r.models,nodes:r.nodes,semantics:r.semantics};
 const text=JSON.stringify(file);writeFileSync(assertWritable(resolve(outDir,region+'.json')),text+'\n');
 index.regions[region]={file:`world/${region}.json`,scope:r.scope,obsolete:r.obsolete,sha256:sha256(Buffer.from(text+'\n')),nodes:r.nodes.length,
  renders:r.nodes.filter(n=>n.shape||n.mesh||n.model).length,materials:r.materials.length,models:r.models.length};
}
writeFileSync(assertWritable(resolve(outDir,'scene.json')),JSON.stringify(sceneJson,null,1)+'\n');
writeFileSync(assertWritable(resolve(outDir,'index.json')),JSON.stringify(index,null,1)+'\n');
console.log('Census',JSON.stringify(actual));
console.log('Converted',JSON.stringify(converted));
for(const [k,v] of Object.entries(index.regions))console.log(`  ${k.padEnd(16)} ${v.nodes} nodes, ${v.renders} renders, ${v.materials} materials, ${v.models} models${v.obsolete?' (obsolete, not loaded)':''}`);
console.log(`Previews verified against their GLB node transforms: ${stats.previewsVerified}. Editor/code castShadows differences resolved to code: ${stats.castShadowMismatches}. Editor-only textures: ${index.textures.filter(t=>t.startsWith('world/')).length}.`);
