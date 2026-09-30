// Full-motion review captures of Arianna from the motion lab, in a disposable headless
// Edge context at 390x844 @3x. Frames are individual full-resolution PNGs (for texture
// review) plus one strip per clip and view (for motion review).
//   MOTION_CLIPS=Run,RunAuthored MOTION_VIEWS=front,side MOTION_FRAMES=8 node tests/browser/capture-motion.mjs
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const clipsWanted=process.env.MOTION_CLIPS?.split(','),views=(process.env.MOTION_VIEWS??'front,left,right').split(','),count=Number(process.env.MOTION_FRAMES??8);
const out=resolve(ROOT,'artifacts','motion');await mkdir(out,{recursive:true});
const {createServer}=await import('vite');
const server=await createServer({root:ROOT,logLevel:'warn',server:{host:'127.0.0.1',port:5211,strictPort:false}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const who=process.env.MOTION_CHARACTER??'arianna';
 await page.goto(server.resolvedUrls.local[0]+'lab.html?capture=1&character='+who);
 await page.waitForFunction(()=>document.body.dataset.ready==='true',undefined,{timeout:120000});
 const quality=await page.evaluate(()=>window.__lab.quality());
 await writeFile(resolve(out,`quality-${who}.json`),JSON.stringify(quality,null,1)+'\n');
 console.log('Quality',JSON.stringify({...quality,clips:quality.clips.length}));
 const clips=(await page.evaluate(()=>window.__lab.clips())).filter(c=>!clipsWanted||clipsWanted.includes(c.name));
 for(const clip of clips)for(const view of views){
  const frames=[];
  for(let i=0;i<count;i++){
   const t=clip.duration*i/count;
   await page.evaluate(({n,t,v})=>window.__lab.pose(n,t,v),{n:clip.name,t,v:view});
   const file=resolve(out,`${who==='arianna'?'':who+'-'}${clip.name}-${view}-${String(i).padStart(2,'0')}.png`);
   await page.screenshot({path:file});frames.push(await page.screenshot({clip:{x:55,y:70,width:280,height:640}}));
  }
  // Strip: frames side by side, cropped to the figure, for reviewing the whole motion at once.
  const strip=await page.evaluate(async list=>{
   const images=await Promise.all(list.map(b=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+b;})));
   const w=images[0].width,h=images[0].height,c=new OffscreenCanvas(w*images.length,h),x=c.getContext('2d');images.forEach((img,i)=>x.drawImage(img,i*w,0));
   const bytes=new Uint8Array(await (await c.convertToBlob({type:'image/png'})).arrayBuffer());let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);
  },frames.map(f=>f.toString('base64')));
  await writeFile(resolve(out,`${who==='arianna'?'':who+'-'}${clip.name}-${view}-strip.png`),Buffer.from(strip,'base64'));
  console.log('captured',clip.name,view,count,'frames');
 }
 console.log('Errors:',errors.length?errors:'none');
}finally{await browser.close();await server.close();}
