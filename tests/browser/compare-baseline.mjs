// Side-by-side and pixel difference of the three.js capture against the PlayCanvas
// authored-only baseline, per viewpoint. Images are decoded and compared in a headless
// page (no image dependencies). Writes artifacts/compare/<id>.png (PlayCanvas | three.js |
// difference) and artifacts/compare/summary.json. Individual full-resolution captures stay
// in artifacts/baseline/ and artifacts/three/ for texture-level review.
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,REFERENCE} from '../../tools/paths.mjs';
import {VIEWPOINTS} from '../viewpoints.mjs';

const tag=`playcanvas-${REFERENCE.playcanvasCommit.slice(0,7)}`;
const pcDir=resolve(ROOT,'artifacts/baseline',tag,'authored'),threeDir=resolve(ROOT,'artifacts/three/authored'),out=resolve(ROOT,'artifacts/compare');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const summary={pcBaseline:tag,note:'Authored-world views only (no characters, toys or UI). diffMean: mean absolute RGB difference 0-255; changedShare: pixels whose max channel difference exceeds 24.',views:{}};
try{
 const page=await browser.newPage();
 for(const view of VIEWPOINTS){
  const a=resolve(pcDir,view.id+'.png'),b=resolve(threeDir,view.id+'.png');
  if(!existsSync(a)||!existsSync(b)){console.log('skip',view.id);continue;}
  const [pa,pb]=await Promise.all([readFile(a),readFile(b)]);
  const res=await page.evaluate(async([pa,pb])=>{
   const load=src=>new Promise((ok,err)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=err;i.src='data:image/png;base64,'+src;});
   const [ia,ib]=await Promise.all([load(pa),load(pb)]),w=ia.width,h=ia.height;
   const read=img=>{const c=new OffscreenCanvas(w,h),x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,w,h).data;};
   const da=read(ia),db=read(ib),diff=new ImageData(w,h);let sum=0,changed=0;
   for(let i=0;i<da.length;i+=4){const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]));
    sum+=(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]))/3;if(d>24)changed++;
    const v=Math.min(255,d*3);diff.data[i]=v;diff.data[i+1]=v*.35;diff.data[i+2]=v*.1;diff.data[i+3]=255;} // black = identical
   const s=.5,sw=Math.round(w*s),sh=Math.round(h*s),c=new OffscreenCanvas(sw*3+16,sh),x=c.getContext('2d');
   x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
   const dc=new OffscreenCanvas(w,h);dc.getContext('2d').putImageData(diff,0,0);
   x.drawImage(ia,0,0,sw,sh);x.drawImage(ib,sw+8,0,sw,sh);x.drawImage(dc,sw*2+16,0,sw,sh);
   x.font='bold 28px system-ui';x.fillStyle='#3d3350';x.fillText('PlayCanvas',12,36);x.fillText('three.js',sw+20,36);x.fillStyle='#fff';x.fillText('difference',sw*2+28,36);
   const blob=await c.convertToBlob({type:'image/png'}),bytes=new Uint8Array(await blob.arrayBuffer());let bin='';for(const b of bytes)bin+=String.fromCharCode(b);
   return {size:[w,h],sizeMatch:ib.width===w&&ib.height===h,diffMean:sum/(w*h),changedShare:changed/(w*h),png:btoa(bin)};
  },[pa.toString('base64'),pb.toString('base64')]);
  await writeFile(resolve(out,view.id+'.png'),Buffer.from(res.png,'base64'));
  delete res.png;summary.views[view.id]={...res,diffMean:+res.diffMean.toFixed(2),changedShare:+res.changedShare.toFixed(4)};
  console.log(view.id.padEnd(26),'mean diff',res.diffMean.toFixed(2),'changed',(res.changedShare*100).toFixed(1)+'%');
 }
 await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,1)+'\n');
}finally{await browser.close();}
