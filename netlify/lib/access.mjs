// Trust only the identity verified by Netlify, never client identity headers.
export function accessError(context, allowedEmails, now=Date.now()) {
 const allowed = (allowedEmails || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if (!allowed.length) return {status:503,error:'Private access is not configured. Set GARDENER_ALLOWED_EMAILS in Netlify and redeploy.'};
 const user = context?.user;
 if (!user?.id || !user.expiresAt || !Number.isFinite(new Date(user.expiresAt).getTime()) || new Date(user.expiresAt).getTime()<=now)
  return {status:401,error:'Netlify private login is required. Keep project visibility Private for production and previews.'};
 if (typeof user.email!=='string' || !allowed.includes(user.email.toLowerCase())) return {status:403,error:'This account is not approved for this workspace.'};
 return null;
}
export function json(body,status=200) {
 return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
}
