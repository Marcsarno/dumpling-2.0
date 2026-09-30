import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier)){
  const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);
 }
 return next(specifier,context);
}});
