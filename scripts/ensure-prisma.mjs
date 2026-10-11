import {createRequire} from 'node:module';
import {readFile,open,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Resolve from this project, regardless of npm's workspace working directory.
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const schema=path.join(root,'apps/api/prisma/schema.prisma');
const lock=path.join(root,'node_modules/.zfleet-prisma-generate.lock');
const normalize=s=>s.replace(/\s+/g,'');
const probe=`const {Prisma,PrismaClient}=require('@prisma/client');if(!Prisma.dmmf?.datamodel?.models?.some(m=>m.name==='User'))process.exit(1);const c=new PrismaClient();c.$disconnect().catch(()=>process.exit(1));`;
async function ready(){try{if(normalize(await readFile(require.resolve('.prisma/client/schema.prisma'),'utf8'))!==normalize(await readFile(schema,'utf8')))return false;return spawnSync(process.execPath,['--input-type=commonjs','-e',probe],{cwd:root,stdio:'ignore',timeout:15000}).status===0;}catch{return false;}}
async function ensure(){
 if(await ready()){console.log('Prisma Client: ready.');return;}
 let owned;
 const deadline=Date.now()+60000;
 while(!owned){
  try{owned=await open(lock,'wx');await owned.writeFile(String(process.pid));}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   // Recover only our own orphaned generation lock; never touch database data.
   try{const pid=Number(await readFile(lock,'utf8'));if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){await unlink(lock);continue;}}}}catch(e){if(e.code==='ENOENT')continue;}
   if(Date.now()>=deadline)throw Error('Another Prisma generation is still running. Wait for it to finish, then retry.');
   await new Promise(r=>setTimeout(r,250));
  }
 }
 try{
  if(await ready()){console.log('Prisma Client: ready.');return;}
  console.log('Preparing Prisma Client for ZFLEET...');
  const cli=require.resolve('prisma/build/index.js');
  const result=spawnSync(process.execPath,[cli,'generate','--schema',schema,'--no-hints'],{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)throw Error('Prisma generation failed. Run npm run db:generate from the project root and review the error above.');
  if(!await ready())throw Error('Generated Prisma Client could not load. Run npm ci followed by npm run db:generate.');
  console.log('Prisma Client: ready.');
 }finally{await owned.close();await unlink(lock).catch(()=>{});}
}
try{await ensure();}catch(error){console.error('ZFLEET setup:',error.message);process.exitCode=1;}
