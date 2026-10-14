import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {json} from './access.mjs';
const COOKIE='__Host-gardener_session',TTL=8*60*60;
const digest=value=>createHash('sha256').update(value).digest('hex');
const tokenFrom=request=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export function createAuth({getStore,password,now=Date.now}) {
 const configured=()=>typeof password()==='string'&&password().length>=16;
 async function authenticate(request,context){
  if(!configured())return {status:503,error:'Login setup is incomplete. The owner must set GARDENER_PASSWORD in Netlify.'};
  const token=tokenFrom(request);
  if(!/^[a-f0-9]{64}$/.test(token))return {status:401,error:'Please sign in to your workspace.'};
  try{const session=await getStore(context).get(digest(token),{type:'json'});
   if(!session||session.expires<=now()||session.passwordTag!==digest(password())||session.origin!==new URL(request.url).origin)return {status:401,error:'Your session has expired. Please sign in again.'};
   return null;
  }catch{return {status:503,error:'Login service is unavailable. Please try again.'};}
 }
 async function handler(request,context){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid request origin'},403);
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'JSON required'},415);
  if(!configured())return json({error:'Login setup is incomplete. The owner must set GARDENER_PASSWORD in Netlify.'},503);
  try{
   const reader=request.body?.getReader();let text='',size=0;if(!reader)return json({error:'Invalid request'},400);
   const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return json({error:'Request too large'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
   let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid request'},400);}
   if(body?.action==='logout'){
    const token=tokenFrom(request);if(/^[a-f0-9]{64}$/.test(token))await getStore(context).delete(digest(token));
    const r=json({ok:true});r.headers.set('Set-Cookie',cookie('',0));return r;
   }
   if(body?.action!=='login'||typeof body.password!=='string')return json({error:'Invalid request'},400);
   if(!timingSafeEqual(Buffer.from(digest(body.password),'hex'),Buffer.from(digest(password()),'hex')))return json({error:'Incorrect password. Please try again.'},401);
   const token=randomBytes(32).toString('hex');
   const result=await getStore(context).setJSON(digest(token),{expires:now()+TTL*1000,passwordTag:digest(password()),origin:new URL(request.url).origin});
   if(!result?.etag)throw new Error('Unconfirmed session write');
   const r=json({ok:true});r.headers.set('Set-Cookie',cookie(token,TTL));return r;
  }catch{return json({error:'Login service is unavailable. Please try again.'},503);}
 }
 return {authenticate,handler};
}
