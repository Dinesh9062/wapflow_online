import {PrismaClient} from '@prisma/client';
import {unseal,decryptionKeys} from '../apps/api/src/crypto.ts';
import {errorResponse} from '../apps/api/src/errors.ts';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const db=new PrismaClient();
try{
 decryptionKeys();if((process.env.JWT_SECRET||'').length<32)throw Error('JWT_SECRET must have at least 32 characters.');
 try{const file=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));if(file.DATA_ENCRYPTION_KEY&&file.DATA_ENCRYPTION_KEY!==process.env.DATA_ENCRYPTION_KEY){console.error('Running DATA_ENCRYPTION_KEY differs from the source .env. An inherited shell/service variable may override it. Restart with the intended original environment.');process.exitCode=1;}else console.log('Encryption environment matches source .env.');}catch(error:any){if(error.code!=='ENOENT')throw error;console.log('No source .env to compare; checking the supplied process environment.');}
 await db.$connect();await db.$queryRaw`SELECT 1`;const users=await db.user.count();await db.featureFlag.count();await db.conversation.count();
 console.log('Database connection and schema: OK. Accounts:',users);
 const groups=[{label:'Follow-ups',read:(skip:number)=>db.followup.findMany({skip,take:200,orderBy:{id:'asc'},select:{data:true}}),decode:(r:any)=>r.data},{label:'Schedules',read:(skip:number)=>db.schedule.findMany({skip,take:200,orderBy:{id:'asc'},select:{data:true}}),decode:(r:any)=>r.data},{label:'Auto rules',read:(skip:number)=>db.autoRule.findMany({skip,take:200,orderBy:{id:'asc'},select:{data:true}}),decode:(r:any)=>r.data},{label:'Private notes',read:(skip:number)=>db.contact.findMany({where:{note:{not:''}},skip,take:200,orderBy:{id:'asc'},select:{note:true}}),decode:(r:any)=>{try{return JSON.parse(r.note);}catch{throw Object.assign(Error('Invalid note format'),{code:'DATA_RECORD_FORMAT'});}}}];
 let unreadable=0;for(const group of groups){let checked=0,keyMismatch=0,format=0;for(let skip=0;;skip+=200){const records=await group.read(skip);for(const record of records){checked++;try{unseal(group.decode(record));}catch(error:any){if(error.code==='DATA_RECORD_FORMAT')format++;else keyMismatch++;}}if(records.length<200)break;}console.log(`${group.label}: checked=${checked}, readable=${checked-keyMismatch-format}, key-mismatch=${keyMismatch}, unsupported-format=${format}`);unreadable+=keyMismatch+format;}
 if(unreadable){console.error('Unreadable records are preserved. Key mismatch: use original keys from your own .env backups (DATA_ENCRYPTION_KEY / DATA_ENCRYPTION_PREVIOUS_KEYS). Unsupported format: changing keys does not repair a legacy/damaged record. No database reset is needed.');process.exitCode=1;}
 const demo=process.env.SEED_EMAIL?await db.user.findUnique({where:{email:process.env.SEED_EMAIL.trim().toLowerCase()},select:{id:true}}):null;
 console.log('Configured demo account:',demo?'exists':'not created; run npm run demo:setup only if you need a demo account');
}catch(error:any){console.error(errorResponse(error).error);if(/JWT_SECRET|DATA_ENCRYPTION/.test(error.message))console.error(error.message);process.exitCode=1;}finally{await db.$disconnect();}
