import {createSign} from 'node:crypto';
import {json} from './access.mjs';
import {buildRouteRequest,readRouteResponse} from '../../public/route-planner.js';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function bodyJSON(request){const reader=request.body?.getReader();if(!reader)fail('JSON required.');let text='',size=0;const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();fail('Request is too large.',413);}text+=decoder.decode(value,{stream:true});}try{return JSON.parse(text+decoder.decode());}catch{fail('Invalid JSON.');}}
export async function reserveRoutingBudget(store,kind,units,limit,day=new Date().toISOString().slice(0,10)){
 const key='routing-budget/'+day+'/'+kind;
 for(let i=0;i<4;i++){const old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});const count=old?.data?.count??0;if(!Number.isSafeInteger(count)||count<0||old&&!old.etag)fail('Routing usage tracking is unavailable.',503);if(count+units>limit)fail('Daily map usage limit reached. Try tomorrow or ask the owner to review the limit.',429);const saved=await store.setJSON(key,{count:count+units},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(saved.modified===true&&saved.etag)return;if(saved.modified!==false)fail('Routing usage could not be confirmed.',503);}
 fail('Routing is busy. Try again shortly.',503);
}
export function createRoutingHandler({authenticate,getStore,environment=()=>process.env,fetchImpl=fetch,now=Date.now}){
 const call=async(url,options={})=>{let response;try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(24000),redirect:'error'});}catch{fail('Google Maps did not respond. Your schedule has not been saved.',503);}if(!response.ok)fail(response.status===429?'Google Maps usage limit reached. Try again later.':'Google Maps connection failed. Check API billing, permissions and credentials in Netlify.',503);try{return await response.json();}catch{fail('Google Maps returned an invalid response.',503);}};
 const credential=env=>{try{const c=JSON.parse(env.GOOGLE_ROUTES_SERVICE_ACCOUNT||'');if(!/^[a-z][a-z0-9-]{4,62}$/.test(c.project_id)||typeof c.client_email!=='string'||!c.client_email.endsWith('.iam.gserviceaccount.com')||typeof c.private_key!=='string')throw new Error();return c;}catch{fail('Set GOOGLE_ROUTES_SERVICE_ACCOUNT to a valid service-account JSON in Netlify.',503);}};
 const token=async env=>{const c=credential(env),iat=Math.floor(now()/1000),header=b64({alg:'RS256',typ:'JWT'}),claims=b64({iss:c.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600});let assertion;try{assertion=header+'.'+claims+'.'+createSign('RSA-SHA256').update(header+'.'+claims).sign(c.private_key,'base64url');}catch{fail('The route service-account key is invalid.',503);}const result=await call('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});if(typeof result.access_token!=='string'||!result.access_token)fail('Google route authorisation failed.',503);return {accessToken:result.access_token,projectId:c.project_id};};
 return async function handler(request,context){
  const denied=await authenticate(request,context);if(denied)return json({error:denied.error},denied.status);
  try{
   if(!['/api/routing','/.netlify/functions/routing'].includes(new URL(request.url).pathname))fail('Not found',404);
   const env=environment(),enabled=env.GARDENER_MAPS_ENABLED==='true';
   if(request.method==='GET')return json({enabled,geocoding:enabled&&!!env.GOOGLE_MAPS_API_KEY,routing:enabled&&!!env.GOOGLE_ROUTES_SERVICE_ACCOUNT});
   if(request.method!=='POST')fail('Method not allowed',405);
   if(request.headers.get('Origin')!==new URL(request.url).origin)fail('Invalid request origin',403);
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')fail('JSON required',415);
   if(!enabled)fail('Map planning needs setup. Add Google credentials and enable maps in Netlify. Your suburb planner is ready to use.',503);
   const body=await bodyJSON(request);if(!body||!['lookup','optimise'].includes(body.action))fail('Unknown map action.');
   const store=getStore(context),entry=await store.getWithMetadata('workspace',{type:'json',consistency:'strong'});if(!entry?.data?.data||!Number.isSafeInteger(entry.data.revision))fail('Saved workspace is unavailable.',503);const data=entry.data.data;
   const limit=(name,fallback,max)=>{const n=Number(env[name]??fallback);if(!Number.isInteger(n)||n<1||n>max)fail('Invalid map usage limit in Netlify.',503);return n;};
   if(body.action==='lookup'){
    if(!env.GOOGLE_MAPS_API_KEY)fail('Set GOOGLE_MAPS_API_KEY in Netlify to look up addresses.',503);
    const site=body.siteId?data.sites.find(s=>s.id===body.siteId):null,address=body.siteId?site?.address:body.address;
    if(typeof address!=='string'||!address.trim()||address.length>500)fail('Enter a complete address.');
    if(site&&(/^gp_sample_/.test(site.id)||/^\[sample\]/i.test(site.name||'')))fail('Sample locations cannot be looked up.');
    await reserveRoutingBudget(store,'lookups',1,limit('GARDENER_MAP_LOOKUPS_PER_DAY',100,2000));
    const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.search=new URLSearchParams({address,components:'country:AU',region:'au',key:env.GOOGLE_MAPS_API_KEY}).toString();
    const result=await call(url);if(!['OK','ZERO_RESULTS'].includes(result.status))fail('Address lookup failed. Check the Geocoding API key and billing.',503);
    const matches=(result.results||[]).slice(0,5).filter(r=>typeof r.place_id==='string').map(r=>({placeId:r.place_id,label:r.formatted_address,precise:!r.partial_match&&['ROOFTOP','RANGE_INTERPOLATED'].includes(r.geometry?.location_type),partial:r.partial_match===true}));
    return json({address,matches});
   }
   if(body.revision!==entry.data.revision)fail('Records changed on another device. Reload before planning routes.',409);
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:data.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));
   let model;try{model=buildRouteRequest(data,body,today);}catch(e){fail(e.message);}
   // Reserve visits, not requests: repeated large plans cannot evade the daily cap.
   credential(env);await reserveRoutingBudget(store,'visits',model.visits.length,limit('GARDENER_ROUTE_VISITS_PER_DAY',200,2000));
   const {accessToken,projectId}=await token(env),result=await call('https://routeoptimization.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+':optimizeTours',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(model.request)});
   let plan;try{plan=readRouteResponse(model,result);}catch(e){fail(e.message,502);}return json({...plan,revision:entry.data.revision});
  }catch(e){return json({error:e.status?e.message:'Map planning could not be completed. Check the settings and try again; your schedule has not been saved.'},e.status||503);}
 };
}
