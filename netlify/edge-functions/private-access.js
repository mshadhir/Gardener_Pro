import {accessError,json} from '../lib/access.mjs';
export default async function privateAccess(request,context) {
 const denied=accessError(context,Netlify.env.get('GARDENER_ALLOWED_EMAILS'));
 if(denied)return json({error:denied.error},denied.status);
 const response=await context.next();
 const headers=new Headers(response.headers);
 headers.set('Cache-Control','private, no-store');
 headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
