import {validate,emptyData} from '../../worker.js';
import {accessError,json} from './access.mjs';
export const MAX_BYTES=4*1024*1024; // Below Netlify buffered payload limit, including encoding overhead.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
async function boundedJSON(request) {
 if(Number(request.headers.get('Content-Length')||0)>MAX_BYTES)fail('Workspace exceeds the 4 MiB limit. Export a backup and reduce photos.',413);
 const reader=request.body?.getReader();if(!reader)fail('JSON body required.');
 const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();fail('Workspace exceeds the 4 MiB limit. Export a backup and reduce photos.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid JSON.');}
}
export function storeTarget(context) {
 if(context?.deploy?.context==='production')return {production:true,name:'gardener-pro-v1'};
 // Deploy-specific store prevents previews from reading or changing live records.
 if(context?.deploy?.id)return {production:false,name:'gardener-pro-preview-v1'};
 fail('Deployment storage context is unavailable.',503);
}
export function createHandler({getStoreForContext,allowedEmails,authenticate}) {
 return async function handler(request,context) {
  const denied=authenticate?await authenticate(request,context):accessError(context,allowedEmails());if(denied)return json({error:denied.error},denied.status);
  const path=new URL(request.url).pathname;
  if(!['/api/state','/.netlify/functions/state'].includes(path))return json({error:'Not found'},404);
  if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
  try {
   let body;
   if(request.method==='PUT') {
    if(request.headers.get('Origin')!==new URL(request.url).origin)fail('Request origin does not match this site.',403);
    if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')fail('JSON is required.',415);
    body=await boundedJSON(request);
    if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=Number.MAX_SAFE_INTEGER)fail('Invalid revision.');
    validate(body.data);
   }
   const store=getStoreForContext(context);
   const entry=await store.getWithMetadata('workspace',{type:'json',consistency:'strong'});
   if(entry && (!entry.etag || !Number.isSafeInteger(entry.data?.revision) || entry.data.revision<0 || !entry.data.data))throw new Error('Invalid stored state');
   const current=entry?.data||{data:emptyData(),revision:0};
   if(request.method==='GET')return json(current);
   if(body.revision!==current.revision)fail('Records changed on another device. Reload and try again.',409);
   const next={data:body.data,revision:body.revision+1};
   const result=await store.setJSON('workspace',next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
   if(result.modified===false)fail('Records changed on another device. Reload and try again.',409);
   // An ETag is mandatory: never treat a provider failure as a successful save.
   if(result.modified!==true||!result.etag)throw new Error('Unconfirmed storage write');
   return json({revision:next.revision});
  }catch(e){return json({error:e.status?e.message:'Storage is unavailable or the save could not be confirmed. Reload before retrying.'},e.status||503);}
 };
}
