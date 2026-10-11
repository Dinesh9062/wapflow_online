export function errorResponse(error:any){
 const code=error?.code;
 if(code==='P1000')return {status:503,error:'Database login failed. Check DATABASE_URL username/password; existing Docker database passwords are not changed by editing .env.'};
 if(['P1001','P1002','P1017'].includes(code))return {status:503,error:'Database unavailable. Start PostgreSQL and check DATABASE_URL host/port.'};
 if(['P2021','P2022'].includes(code))return {status:503,error:'Database schema is outdated. Run npm run db:generate and npm run db:migrate in the source folder.'};
 if(code==='P2002')return {status:409,error:'This record already exists. Refresh and try again.'};
 if(error?.status)return {status:error.status,error:error.message};
 return {status:500,error:'Server could not complete this request. Check the API log with the request ID.'};
}
export function readRecord<T>(read:()=>T,warnings:string[],label:string):T|null{
 try{return read();}catch(error:any){warnings.push(error.code==='DATA_RECORD_FORMAT'?label+' has an unsupported legacy or damaged encrypted format. It is preserved; changing .env does not repair its format.':error.code==='DATA_KEY_CONFIG'?label+' cannot be read: check encryption-key configuration in the server .env.':label+' could not be decrypted. Preserve existing data and restore the original DATA_ENCRYPTION_KEY from your previous .env, or include an available original key in DATA_ENCRYPTION_PREVIOUS_KEYS.');return null;}
}
