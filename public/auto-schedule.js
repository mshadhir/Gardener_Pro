import {defaultAssignment} from './team.js';
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function addDays(value,n){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function dueDate(site){
 if(!validDate(site.lastCompleted)||site.frequency==='one-off')return '';
 if(site.frequency!=='monthly')return addDays(site.lastCompleted,site.frequency==='weekly'?7:14);
 const d=new Date(site.lastCompleted+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.toISOString().slice(0,10);
}
export function preferredDate(site,date){const pref=String(site.preferredDay??'');if(!/^[0-6]$/.test(pref))return date;return addDays(date,(Number(pref)-new Date(date+'T12:00:00Z').getUTCDay()+7)%7);}
export function weekRange(date){if(!validDate(date))throw new Error('Choose a valid week.');const weekday=new Date(date+'T12:00:00Z').getUTCDay();const start=addDays(date,-((weekday+6)%7));return {start,end:addDays(start,6)};}
export function autoPlan(data,start,end,today){
 if(!validDate(start)||!validDate(end)||!validDate(today)||end<start||end>addDays(start,90))throw new Error('Choose a valid planning week.');
 const planned=[],skipped=[],earliest=start>today?start:today;
 for(const site of data.sites){
  const open=data.jobs.filter(j=>j.siteId===site.id&&j.status!=='completed');
  const due=dueDate(site),job=open[0];let reason='',carry=null;
  if(end<today)reason='Past week — no visits added';
  else if(open.length>1)reason='Multiple open visits — review existing bookings';
  else if(job?.status==='in-progress')reason='Visit in progress — keep current booking';
  else if(job&&job.status!=='deferred'&&job.date>=today)reason=job.date>=start&&job.date<=end?'Already scheduled in this week':'Upcoming unfinished visit — keep its booked day';
  else if(job){carry=job;}
  else if(site.frequency==='one-off')reason='One-off site — schedule manually';
  const date=preferredDate(site,carry?earliest:(due&&due>earliest?due:earliest));
  if(!reason&&date>end)reason='Next visit falls after this week';
  if(!reason&&data.jobs.some(j=>j.siteId===site.id&&j.id!==carry?.id&&j.date===date))reason='A visit already exists on this date';
  if(reason)skipped.push({siteId:site.id,reason});
  else planned.push({siteId:site.id,date,due,jobId:carry?.id||'',reason:carry?(carry.status==='deferred'?'Move waiting visit':'Move missed visit from '+carry.date):due?(due<earliest?'Overdue':'Due this week'):'First visit — check date',...(carry?{memberId:carry.memberId||'',crewId:carry.crewId||''}:defaultAssignment(data,site))});
 }
 planned.sort((a,b)=>(a.due||a.date).localeCompare(b.due||b.date)||a.siteId.localeCompare(b.siteId));return {planned,skipped};
}
export function applyAutoPlan(data,rows,start,end,today,makeId){
 const eligible=autoPlan(data,start,end,today).planned,seen=new Set(),operations=[];
 for(const row of rows){const site=data.sites.find(s=>s.id===row.siteId),candidate=eligible.find(p=>p.siteId===row.siteId);
  if(!site||!candidate||seen.has(row.siteId)||!validDate(row.date)||row.date<today||row.date<start||row.date>end||(row.jobId||'')!==candidate.jobId)throw new Error('Bookings changed or a date is outside this week. Refresh the preview.');
  seen.add(row.siteId);
  if(data.jobs.some(j=>j.siteId===site.id&&j.id!==candidate.jobId&&j.date===row.date))throw new Error('A visit already exists on this date. Refresh the preview.');
  if(candidate.jobId)operations.push({job:data.jobs.find(j=>j.id===candidate.jobId),date:row.date});
  else operations.push({addition:{id:makeId(),siteId:site.id,date:row.date,time:'',...defaultAssignment(data,site),notes:'',status:'scheduled',photos:[]}});
 }
 for(const op of operations){if(op.addition)data.jobs.push(op.addition);else{op.job.date=op.date;op.job.status='scheduled';op.job.time='';delete op.job.order;}}
 return operations.length;
}
