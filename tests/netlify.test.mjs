import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,storeTarget,MAX_BYTES} from '../netlify/lib/state-handler.mjs';
import {emptyData} from '../worker.js';
import privateAccess from '../netlify/edge-functions/private-access.js';
const context=()=>({user:{id:'verified-user',email:'owner@example.com',expiresAt:new Date(Date.now()+60000)},deploy:{context:'production',id:'deploy-a'}});
function fixture(options={}){
 let value=null,tag=0,reads=0;
 const store={
  async getWithMetadata(){reads++;return value?{data:structuredClone(value),etag:String(tag)}:null;},
  async setJSON(key,data,conditions){
   if(conditions.onlyIfNew&&value || conditions.onlyIfMatch&&conditions.onlyIfMatch!==String(tag))return {modified:false};
   value=structuredClone(data);return {modified:true,etag:String(++tag)};
  }
 };
 return {store,get reads(){return reads;},handler:createHandler({getStoreForContext:()=>store,allowedEmails:()=>options.emails??'owner@example.com'})};
}
const req=(method='GET',body,headers={})=>new Request('https://garden.test/api/state',{method,headers:{Origin:'https://garden.test','Content-Type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
test('anonymous identity and spoofed headers are rejected before storage',async()=>{const f=fixture();assert.equal((await f.handler(req('GET',undefined,{'oai-authenticated-user-email':'owner@example.com','x-nf-user':'verified-user'}),{})).status,401);assert.equal(f.reads,0)});
test('missing allowlist, wrong user and expired identity fail closed',async()=>{assert.equal((await fixture({emails:''}).handler(req(),context())).status,503);const c=context();c.user.email='other@example.com';assert.equal((await fixture().handler(req(),c)).status,403);c.user.email='owner@example.com';c.user.expiresAt=new Date(0);assert.equal((await fixture().handler(req(),c)).status,401)});
test('authorized save, reload and backup restore preserve records',async()=>{const f=fixture(),c=context();assert.equal((await (await f.handler(req(),c)).json()).revision,0);const data=emptyData();data.settings.company='Example';assert.equal((await f.handler(req('PUT',{data,revision:0}),c)).status,200);assert.deepEqual((await (await f.handler(req(),c)).json()).data,data);assert.equal((await f.handler(req('PUT',{data:JSON.parse(JSON.stringify(data)),revision:1}),c)).status,200)});
test('concurrent first writes cannot both win',async()=>{const f=fixture();const results=await Promise.all([f.handler(req('PUT',{data:emptyData(),revision:0}),context()),f.handler(req('PUT',{data:emptyData(),revision:0}),context())]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409])});
test('concurrent updates and stale revision cannot overwrite a winner',async()=>{const f=fixture();await f.handler(req('PUT',{data:emptyData(),revision:0}),context());const results=await Promise.all([f.handler(req('PUT',{data:emptyData(),revision:1}),context()),f.handler(req('PUT',{data:emptyData(),revision:1}),context())]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await f.handler(req('PUT',{data:emptyData(),revision:0}),context())).status,409)});
test('cross-origin writes, wrong media, malformed JSON and invalid data rejected',async()=>{const f=fixture(),c=context();assert.equal((await f.handler(req('PUT',{}, {Origin:'https://evil.test'}),c)).status,403);assert.equal((await f.handler(req('PUT',{}, {'Content-Type':'text/plain'}),c)).status,415);assert.equal((await f.handler(req('PUT','{'),c)).status,400);assert.equal((await f.handler(req('PUT',{data:{},revision:0}),c)).status,400);assert.equal((await f.handler(req('DELETE'),c)).status,405);assert.equal(f.reads,0)});
test('oversized body rejected without trusting content-length',async()=>{const f=fixture();assert.equal((await f.handler(req('PUT','x'.repeat(MAX_BYTES+1)),context())).status,413);assert.equal(f.reads,0)});
test('storage failures cannot be reported as successful saves',async()=>{const f=fixture();f.store.setJSON=async()=>({modified:true,etag:''});assert.equal((await f.handler(req('PUT',{data:emptyData(),revision:0}),context())).status,503);f.store.getWithMetadata=async()=>{throw new Error('secret provider diagnostic')};const r=await f.handler(req(),context());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret provider/)});
test('read failure cannot silently reset existing workspace',async()=>{const f=fixture();f.store.getWithMetadata=async()=>({data:{wrong:'shape'},etag:'x'});assert.equal((await f.handler(req(),context())).status,503)});
test('preview namespace is separate and missing deployment context denied',()=>{assert.equal(storeTarget(context()).production,true);assert.equal(storeTarget({deploy:{context:'deploy-preview',id:'preview-1'}}).production,false);assert.notEqual(storeTarget(context()).name,storeTarget({deploy:{context:'branch-deploy',id:'x'}}).name);assert.throws(()=>storeTarget({}))});
test('responses prohibit caching',async()=>{const r=await fixture().handler(req(),context());assert.match(r.headers.get('Cache-Control'),/no-store/);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff')});
test('edge protects HTML, assets and direct function path',async()=>{
 globalThis.Netlify={env:{get:()=> 'owner@example.com'}};
 try{for(const path of ['/','/app.js','/sites','/.netlify/functions/state']){let called=false;const r=await privateAccess(new Request('https://garden.test'+path),{next:()=>{called=true;return new Response('private')}});assert.equal(r.status,401);assert.equal(called,false)}
 const c=context();c.next=async()=>new Response('ok');const r=await privateAccess(req(),c);assert.equal(await r.text(),'ok');assert.match(r.headers.get('Cache-Control'),/no-store/);
 }finally{delete globalThis.Netlify}
});
