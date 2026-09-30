// Minimal read-only static file server for local captures (no dependencies).
//   node tools/serve-static.mjs <folder> [port]
import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
 '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.bin':'application/octet-stream',
 '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.map':'application/json'};

export function serveStatic(folder,port=0,host='127.0.0.1'){
 const root=resolve(folder);
 const server=createServer((req,res)=>{
  try{
   let path=decodeURIComponent(new URL(req.url,'http://x').pathname);
   let file=resolve(root,'.'+path);
   if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
   let info=statSync(file,{throwIfNoEntry:false});
   if(info?.isDirectory()){file=resolve(file,'index.html');info=statSync(file,{throwIfNoEntry:false});}
   if(!info){res.writeHead(404).end('Not found');return;}
   res.writeHead(200,{'Content-Type':TYPES[extname(file).toLowerCase()]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
   createReadStream(file).pipe(res);
  }catch(error){res.writeHead(500).end(String(error));}
 });
 return new Promise(ready=>server.listen(port,host,()=>ready({server,url:`http://${host}:${server.address().port}/`,close:()=>new Promise(r=>server.close(r))})));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {url}=await serveStatic(process.argv[2]??'dist',Number(process.argv[3]??0));
 console.log('Serving',resolve(process.argv[2]??'dist'),'at',url);
}
