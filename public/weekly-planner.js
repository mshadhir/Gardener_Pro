import {autoPlan,applyAutoPlan,addDays} from './auto-schedule.js';
import {assignmentFields,assignmentValue,assignedMemberIds} from './team.js';
import {estimatedMinutes} from './scheduling.js';

export function plannerOptions(options={}){
 const o={maxJobs:Number(options.maxJobs??7),maxHours:Number(options.maxHours??7),buffer:Number(options.buffer??15),weekdays:options.weekdays??[1,2,3,4,5]};
 if(!Number.isInteger(o.maxJobs)||o.maxJobs<1||o.maxJobs>30||!Number.isFinite(o.maxHours)||o.maxHours<1||o.maxHours>16||!Number.isFinite(o.buffer)||o.buffer<0||o.buffer>120||!Array.isArray(o.weekdays)||!o.weekdays.length||o.weekdays.some(x=>!Number.isInteger(x)||x<0||x>6))throw new Error('Check daily limits and choose at least one working day.');
 return o;
}
export const suburbKey=s=>s?.addressParts?.confirmed?[s.addressParts.state,s.addressParts.suburb.trim().toLowerCase()].join(':'):'';
const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
function resources(data,row){const ids=assignedMemberIds(data,row);return [...new Set([...(row.crewId?['crew:'+row.crewId]:[]),...ids.map(id=>'member:'+id)])];}
const duration=(data,row,options)=>estimatedMinutes(data.sites.find(s=>s.id===row.siteId)?.estimatedTime)+options.buffer;
function fits(data,row,jobs,options){
 const keys=resources(data,row);if(!keys.length)return false;
 return keys.every(key=>{const list=jobs.filter(j=>j.date===row.date&&resources(data,j).includes(key));return list.length+1<=options.maxJobs&&list.reduce((n,j)=>n+duration(data,j,options),0)+duration(data,row,options)<=options.maxHours*60;});
}
function assignmentProblem(data,row){
 if(!assignmentValue(row))return 'Choose a person or crew';
 try{assignmentFields(data,assignmentValue(row));}catch{return 'Assignment is archived or missing';}
 if(row.crewId&&!assignedMemberIds(data,row).length)return 'Crew has no active members';
 return '';
}
export function weeklyDayWarnings(data,rows,settings){
 const options=plannerOptions(settings),keys=[...new Set(rows.flatMap(r=>resources(data,r)))],warnings=[];
 for(const key of keys){const jobs=rows.filter(r=>resources(data,r).includes(key));const minutes=jobs.reduce((n,r)=>n+duration(data,r,options),0);if(jobs.length>options.maxJobs||minutes>options.maxHours*60){const id=key.slice(key.indexOf(':')+1),name=(key.startsWith('crew:')?data.crews:data.members).find(r=>r.id===id)?.name||'Assignment';warnings.push(name+': '+jobs.length+' visits, '+Math.round(minutes/60*10)/10+'h including buffer');}}
 return warnings;
}
export function buildWeeklyPlan(data,start,end,today,settings={}){
 const options=plannerOptions(settings),base=autoPlan(data,start,end,today),planned=[],needs=[];
 const candidateIds=new Set(base.planned.map(p=>p.jobId).filter(Boolean));
 const fixed=data.jobs.filter(j=>j.date>=start&&j.date<=end&&j.status!=='deferred'&&!candidateIds.has(j.id));
 const jobs=[...fixed];
 const candidates=[...base.planned].sort((a,b)=>(a.due||a.date).localeCompare(b.due||b.date)||suburbKey(data.sites.find(s=>s.id===a.siteId)).localeCompare(suburbKey(data.sites.find(s=>s.id===b.siteId)))||a.siteId.localeCompare(b.siteId));
 for(const p of candidates){const site=data.sites.find(s=>s.id===p.siteId),problem=assignmentProblem(data,p)||(!suburbKey(site)?'Confirm address for suburb grouping':'')||(!estimatedMinutes(site.estimatedTime)?'Add an estimated visit duration':'');
  if(problem){needs.push({...p,date:'',issue:problem});continue;}
  const days=[];for(let date=start;date<=end;date=addDays(date,1)){
   if(date<today||date<p.date||!options.weekdays.includes(weekday(date)))continue;
   if(/^[0-6]$/.test(String(site.preferredDay??''))&&weekday(date)!==Number(site.preferredDay))continue;
   if(data.jobs.some(j=>j.siteId===p.siteId&&j.id!==p.jobId&&j.date===date))continue;
   const row={...p,date};if(!fits(data,row,jobs,options))continue;
   const same=jobs.filter(j=>j.date===date&&resources(data,j).some(k=>resources(data,row).includes(k)));
   const groupCount=same.filter(j=>suburbKey(data.sites.find(s=>s.id===j.siteId))===suburbKey(site)).length;
   days.push({date,score:(groupCount?-1000:0)+same.reduce((n,j)=>n+duration(data,j,options),0)});
  }
  days.sort((a,b)=>a.score-b.score||a.date.localeCompare(b.date));
  if(days.length){const row={...p,date:days[0].date};planned.push(row);jobs.push({...row,status:'scheduled'});}
  else needs.push({...p,date:'',issue:'No space on an eligible working day'});
 }
 return {planned,needs,fixed,skipped:base.skipped,options};
}

// Validate the entire draft before mutating the workspace. Existing bookings are fixed.
export function saveWeeklyPlan(data,rows,start,end,today,settings,makeId){
 const options=plannerOptions(settings),copy=structuredClone(data),base=autoPlan(copy,start,end,today);
 const moving=new Set(rows.map(r=>r.jobId).filter(Boolean));
 const jobs=copy.jobs.filter(j=>j.status!=='deferred'&&!moving.has(j.id));
 for(const row of rows){const candidate=base.planned.find(p=>p.siteId===row.siteId),site=copy.sites.find(s=>s.id===row.siteId);if(!candidate||!site)throw new Error('Bookings changed. Rebuild the weekly draft.');
  const fields=assignmentFields(copy,row.assignment??assignmentValue(candidate));const check={...row,...fields,status:'scheduled'};
  const problem=assignmentProblem(copy,check);if(problem)throw new Error(problem);
  if(!estimatedMinutes(site.estimatedTime))throw new Error('Add an estimated visit duration before allocating this site.');
  if(!options.weekdays.includes(weekday(row.date)))throw new Error('Choose one of your working days.');
  if(row.date<candidate.date)throw new Error('Choose a date on or after the suggested due date.');
  if(/^[0-6]$/.test(String(site.preferredDay??''))&&weekday(row.date)!==Number(site.preferredDay))throw new Error('This site has a preferred weekday. Update the site to change it.');
  if(!fits(copy,check,jobs,options))throw new Error('Daily job or hour limit exceeded. Move a visit or adjust the limits.');
  jobs.push(check);
 }
 applyAutoPlan(copy,rows,start,end,today,makeId);
 for(const row of rows){const job=row.jobId?copy.jobs.find(j=>j.id===row.jobId):copy.jobs.find(j=>j.siteId===row.siteId&&j.status==='scheduled'&&j.date===row.date);Object.assign(job,assignmentFields(copy,row.assignment??assignmentValue(job)));}
 data.jobs=copy.jobs;
 data.settings.planner=options;
 return rows.length;
}
