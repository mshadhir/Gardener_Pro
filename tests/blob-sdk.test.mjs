import test from 'node:test';
import assert from 'node:assert/strict';
import {getStore} from '@netlify/blobs';
import {checkedTransport} from '../netlify/lib/blob-transport.mjs';
const mockStore=(transport)=>getStore({name:'test',siteID:'synthetic',token:'synthetic',edgeURL:'https://synthetic.test',uncachedEdgeURL:'https://synthetic.test',consistency:'strong',fetch:checkedTransport(transport)});
test('installed SDK reports atomic precondition conflict',async()=>{
 const store=mockStore(async()=>new Response('',{status:412}));
 assert.equal((await store.setJSON('workspace',{revision:1},{onlyIfNew:true})).modified,false);
});
test('failed provider write with ETag cannot become success through SDK',async()=>{
 const store=mockStore(async()=>new Response('Unavailable',{status:503,headers:{etag:'error-response'}}));
 await assert.rejects(store.setJSON('workspace',{revision:1},{onlyIfMatch:'old-tag'}),/Storage request failed/);
});
test('transport permits missing reads but rejects missing write targets',async()=>{
 const transport=checkedTransport(async()=>new Response('',{status:404}));
 assert.equal((await transport('https://synthetic.test',{method:'get'})).status,404);
 await assert.rejects(transport('https://synthetic.test',{method:'put'}));
});
