// Missing order preserves the existing time-based ordering of old backups.
export function compareJobs(a,b){return a.date.localeCompare(b.date)||((a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER))||(a.time||'').localeCompare(b.time||'')||a.id.localeCompare(b.id);}
export function moveJob(jobs,id,date,beforeId=''){
 const job=jobs.find(j=>j.id===id);
 if(!job||job.status==='completed')throw new Error('Only open jobs can be moved.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Choose a valid date.');
 if(beforeId===id)return;
 const oldDate=job.date;
 const target=jobs.filter(j=>j.date===date&&j.id!==id).sort(compareJobs);
 const index=beforeId?target.findIndex(j=>j.id===beforeId):target.length;
 if(index<0)throw new Error('The destination job changed. Please try again.');
 job.date=date;target.splice(index,0,job);target.forEach((j,i)=>j.order=i);
 if(oldDate!==date)jobs.filter(j=>j.date===oldDate).sort(compareJobs).forEach((j,i)=>j.order=i);
}
