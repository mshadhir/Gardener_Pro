import {defaultAssignment} from './team.js';
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function addDays(value,n){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function dueDate(site){
 if(!validDate(site.lastCompleted)||site.frequency==='one-off')return '';
 if(site.frequency!=='monthly')return addDays(site.lastCompleted,site.frequency==='weekly'?7:14);
 const d=new Date(site.lastCompleted+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.toISOString().slice(0,10);
}
export function preferredDate(site,date){const pref=String(site.preferredDay??'');if(!/^[0-6]$/.test(pref))return date;return addDays(date,(Number(pref)-new Date(date+'T12:00:00Z').getUTCDay()+7)%7);}
export function autoPlan(data,start,end,today){
 if(!validDate(start)||!validDate(end)||start<today||end<start||end>addDays(start,90))throw new Error('Choose a range from today onwards, up to 90 days.');
 const planned=[],skipped=[];
 for(const site of data.sites){let reason='';const open=data.jobs.find(j=>j.siteId===site.id&&j.status!=='completed');const due=dueDate(site);let date=preferredDate(site,due&&due>start?due:start);
 if(site.frequency==='one-off')reason='One-off site — schedule manually';else if(open)reason=open.status==='deferred'?'Waiting job — reschedule it first':'Already has an open visit';else if(date>end)reason='Next visit falls after this range';else if(data.jobs.some(j=>j.siteId===site.id&&j.date===date))reason='A visit already exists on this date';
 if(reason)skipped.push({siteId:site.id,reason});else planned.push({siteId:site.id,date,due,reason:due?(due<start?'Overdue':'Due in range'):'First visit — check date',...defaultAssignment(data,site)});
 }
 planned.sort((a,b)=>(a.due||a.date).localeCompare(b.due||b.date)||a.siteId.localeCompare(b.siteId));return {planned,skipped};
}
export function applyAutoPlan(data,rows,start,end,today,makeId){
 const seen=new Set();const additions=[];
 for(const row of rows){const site=data.sites.find(s=>s.id===row.siteId);if(!site||site.frequency==='one-off'||seen.has(row.siteId)||!validDate(row.date)||row.date<today||row.date<start||row.date>end)throw new Error('Review the selected sites and dates.');seen.add(row.siteId);
 if(data.jobs.some(j=>j.siteId===site.id&&(j.status!=='completed'||j.date===row.date)))throw new Error('A selected site already has a visit. Refresh the preview.');
 additions.push({id:makeId(),siteId:site.id,date:row.date,time:'',...defaultAssignment(data,site),notes:'',status:'scheduled',photos:[]});}
 data.jobs.push(...additions);return additions.length;
}
