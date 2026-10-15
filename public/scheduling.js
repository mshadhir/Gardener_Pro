// Missing order preserves the existing time-based ordering of old backups.
export function compareJobs(a,b){return a.date.localeCompare(b.date)||((a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER))||(a.time||'').localeCompare(b.time||'')||a.id.localeCompare(b.id);}
export function moveJob(jobs,id,date,beforeId=''){
 const job=jobs.find(j=>j.id===id);
 if(!job||job.status==='completed')throw new Error('Only open jobs can be moved.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Choose a valid date.');
 if(beforeId===id)return;
 const oldDate=job.date;
 const target=jobs.filter(j=>j.status!=='deferred'&&j.date===date&&j.id!==id).sort(compareJobs);
 const index=beforeId?target.findIndex(j=>j.id===beforeId):target.length;
 if(index<0)throw new Error('The destination job changed. Please try again.');
 if(job.status==='deferred'){job.status='scheduled';job.time='';}job.date=date;target.splice(index,0,job);target.forEach((j,i)=>j.order=i);
 if(oldDate!==date)jobs.filter(j=>j.status!=='deferred'&&j.date===oldDate).sort(compareJobs).forEach((j,i)=>j.order=i);
}

// An existing later open visit is the next booking, even after it is dragged
// away from the nominal recurrence date. Do not overwrite its date or details.
export function existingFollowUp(jobs,completedJob,nextDate){
 return jobs.filter(j=>j.id!==completedJob.id&&j.siteId===completedJob.siteId&&
  (j.status==='deferred'||(j.status!=='completed'&&j.date>completedJob.date)||(nextDate&&j.date===nextDate)))
  .sort(compareJobs)[0]||null;
}
export function ensureFollowUp(jobs,completedJob,nextDate,makeId){
 const existing=existingFollowUp(jobs,completedJob,nextDate);
 if(existing||!nextDate)return existing;
 const next={id:makeId(),siteId:completedJob.siteId,date:nextDate,time:completedJob.time,memberId:completedJob.memberId,crewId:completedJob.crewId,notes:'',status:'scheduled',photos:[]};
 jobs.push(next);return next;
}

export function deferJob(data,id,reason,at=new Date().toISOString()){
 const job=data.jobs.find(j=>j.id===id);
 if(!job||!['scheduled','in-progress'].includes(job.status))throw new Error('Only scheduled or in-progress jobs can be deferred.');
 if(typeof reason!=='string'||!reason.trim()||reason.length>2000)throw new Error('Enter a reason (up to 2,000 characters).');
 job.deferrals=[...(job.deferrals||[]),{date:job.date,reason:reason.trim(),at}];
 job.status='deferred';delete job.order;
 for(const entry of data.entries)if(entry.siteId===job.siteId&&!entry.end)entry.end=at;
}

export const siteTitle=s=>s?.name?.trim()||s?.address?.trim()||'Unknown site';
export function estimatedMinutes(value){const match=String(value||'').match(/^(\d+(?:\.\d+)?)(h|m)$/);return match?Number(match[1])*(match[2]==='h'?60:1):0;}
export function dayWorkload(jobs,sites){const map=new Map(sites.map(s=>[s.id,s]));return {count:jobs.length,minutes:jobs.reduce((n,j)=>n+estimatedMinutes(map.get(j.siteId)?.estimatedTime),0),remaining:jobs.filter(j=>j.status!=='completed').length};}
export function appointmentOrderConflict(jobs){const last=new Map();for(const j of [...jobs].sort(compareJobs)){if(!j.time||j.status==='completed')continue;const key=j.date+':'+(j.crewId?'crew:'+j.crewId:'member:'+(j.memberId||'myself'));if(last.has(key)&&j.time<last.get(key))return true;last.set(key,j.time);}return false;}
const scheduleFields=['date','time','order','status'];
export function scheduleSnapshot(jobs){return jobs.map(j=>({id:j.id,...Object.fromEntries(scheduleFields.filter(k=>Object.hasOwn(j,k)).map(k=>[k,j[k]]))}));}
export function restoreSchedule(jobs,snapshot){for(const previous of snapshot){const job=jobs.find(j=>j.id===previous.id);if(!job)throw new Error('The schedule changed. Reload before continuing.');for(const key of scheduleFields){if(Object.hasOwn(previous,key))job[key]=previous[key];else delete job[key];}}}
