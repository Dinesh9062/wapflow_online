import {PrismaClient} from '@prisma/client';
import {Queue,Worker} from 'bullmq';
import Redis from 'ioredis';
const db=new PrismaClient(),connection=new Redis(process.env.REDIS_URL||'redis://localhost:6379',{maxRetriesPerRequest:null});
const queue=new Queue('zfleet-due',{connection});
await queue.upsertJobScheduler('scan-due',{every:5000},{name:'scan',data:{},opts:{removeOnComplete:10,removeOnFail:100}});
const worker=new Worker('zfleet-due',async()=>{
 const now=new Date();
 // Workers prepare jobs. Only a verified active WhatsApp tab may send.
 await db.schedule.updateMany({where:{status:'queued',dueAt:{lte:now}},data:{status:'ready'}});
 await db.schedule.updateMany({where:{status:'sending',leaseAt:{lt:new Date(Date.now()-120000)}},data:{status:'unknown',error:'Send confirmation missing. Inspect WhatsApp before retrying.'}});
 // Never replay a delayed automatic reply long after its triggering conversation.
 await db.schedule.updateMany({where:{kind:'auto',status:{in:['ready','needs-whatsapp-open']},dueAt:{lt:new Date(Date.now()-300000)}},data:{status:'cancelled',error:'Automatic reply expired'}});
},{connection,concurrency:1});
worker.on('failed',(job,error)=>console.error('Scheduler failure',{job:job?.id,message:error.message}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await worker.close();await queue.close();connection.disconnect();await db.$disconnect();process.exit(0);});
console.log('Wapflow scheduler active');
