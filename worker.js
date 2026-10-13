const MAX_BYTES = 8 * 1024 * 1024;
export const emptyData = () => ({version:1,sites:[],jobs:[],members:[],crews:[],entries:[],settings:{name:'',company:'',phone:'',timezone:'Australia/Melbourne'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const str=(v,max=10000)=>typeof v==='string'&&v.length<=max;
export function validate(data) {
 if(!data||data.version!==1||!data.settings)fail('This is not a Gardener Pro backup.');
 for(const key of ['sites','jobs','members','crews','entries']){
  if(!Array.isArray(data[key])||data[key].length>20000)fail('Invalid '+key+' records.');
  const ids=new Set();for(const r of data[key]){if(!r||!str(r.id,100)||!/^[-_A-Za-z0-9]+$/.test(r.id)||ids.has(r.id))fail('Invalid or duplicate record ID.');ids.add(r.id);}
 }
 for(const r of data.sites){if(!str(r.name,200)||!r.name.trim()||!str(r.address,500)||!r.address.trim()||!['weekly','fortnightly','monthly','one-off'].includes(r.frequency)||!Array.isArray(r.tasks)||r.tasks.length>200)fail('Invalid site details.'); for(const t of r.tasks)if(!str(t.id,100)||!/^[-_A-Za-z0-9]+$/.test(t.id)||!str(t.name,300)||typeof t.done!=='boolean')fail('Invalid task.');}
 const siteIds=new Set(data.sites.map(x=>x.id));
 for(const r of data.jobs){if(!siteIds.has(r.siteId)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['scheduled','in-progress','completed'].includes(r.status)||!Array.isArray(r.photos)||r.photos.length>6||r.photos.some(p=>!str(p,600000)||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)))fail('Invalid job details or photos.');}
 for(const r of data.entries){if(!siteIds.has(r.siteId)||!Number.isFinite(Date.parse(r.start))||(r.end!==null&&(!Number.isFinite(Date.parse(r.end))||Date.parse(r.end)<Date.parse(r.start))))fail('Invalid time entry.');}
 if(data.entries.filter(x=>!x.end).length>1)fail('Only one timer can run at a time.');
 for(const r of [...data.members,...data.crews])if(!str(r.name,200)||!r.name.trim())fail('A name is required.');
 for(const r of data.crews)if(!Array.isArray(r.memberIds)||r.memberIds.some(id=>!data.members.some(m=>m.id===id)))fail('Invalid crew members.');
 if(!str(data.settings.name,200)||!str(data.settings.company,200)||!str(data.settings.phone,100)||!str(data.settings.timezone,100))fail('Invalid profile.');
 try{new Intl.DateTimeFormat('en-AU',{timeZone:data.settings.timezone})}catch{fail('Invalid time zone.')}
 return data;
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  try {
   if(url.pathname!=='/api/state')return json({error:'Not found'},404);
   if(!env.DB)return json({error:'Saved records are not available. Database connection is missing.'},503);
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS workspace_head (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)').run();
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS workspace_chunks (revision INTEGER, part INTEGER, data TEXT NOT NULL, PRIMARY KEY(revision,part))').run();
   await env.DB.prepare('INSERT OR IGNORE INTO workspace_head VALUES (1,0)').run();
   if(request.method==='GET'){
    const rows=(await env.DB.prepare('SELECT h.revision,c.data FROM workspace_head h LEFT JOIN workspace_chunks c ON c.revision=h.revision WHERE h.id=1 ORDER BY c.part').all()).results;return json({data:rows[0].data===null?emptyData():JSON.parse(rows.map(r=>r.data).join('')),revision:rows[0].revision});
   }
   if(request.method!=='PUT')return json({error:'Method not allowed'},405);
   if(request.headers.get('Origin')!==url.origin)return json({error:'Request origin does not match this site.'},403);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON is required.'},415);
   if(Number(request.headers.get('Content-Length')||0)>MAX_BYTES)return json({error:'Backup exceeds 8 MB. Remove some photos first.'},413);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>MAX_BYTES)return json({error:'Saved records exceed 8 MB. Export a backup and remove old photos.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
   validate(body.data);if(!Number.isSafeInteger(body.revision)||body.revision<0)fail('Invalid revision.');
   const serialized=JSON.stringify(body.data), statements=[];
   for(let offset=0,part=0;offset<serialized.length;offset+=200000,part++)statements.push(env.DB.prepare('INSERT INTO workspace_chunks (revision,part,data) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM workspace_head WHERE id=1 AND revision=?)').bind(body.revision+1,part,serialized.slice(offset,offset+200000),body.revision));
   const updateIndex=statements.length;
   statements.push(env.DB.prepare('UPDATE workspace_head SET revision=revision+1 WHERE id=1 AND revision=?').bind(body.revision));
   statements.push(env.DB.prepare('DELETE FROM workspace_chunks WHERE revision < (SELECT revision FROM workspace_head WHERE id=1)'));
   const result=(await env.DB.batch(statements))[updateIndex];
   if(!result.meta.changes)return json({error:'Records changed on another device. Reload and try again.'},409);
   return json({revision:body.revision+1});
  } catch(e){return json({error:e.status?e.message:'Unable to save or load records. Please try again.'},e.status||500)}
 }
};
