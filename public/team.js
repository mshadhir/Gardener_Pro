// Assignment records are not login accounts. Snapshot names keep visit history stable.
export const assignmentValue = r => r?.crewId ? 'crew:'+r.crewId : r?.memberId ? 'member:'+r.memberId : '';
export function assignmentFields(data,value,previous){
 if(!value)return {memberId:'',crewId:''};
 const type=value.startsWith('crew:')?'crew':value.startsWith('member:')?'member':'';
 const id=value.slice(type.length+1),record=data[type==='crew'?'crews':'members'].find(r=>r.id===id);
 if(!type||!record||(record.archived&&value!==assignmentValue(previous)))throw new Error('Choose an active person or crew.');
 return {memberId:type==='member'?id:'',crewId:type==='crew'?id:''};
}
export function defaultAssignment(data,record){
 const value=assignmentValue(record);
 try{return assignmentFields(data,value);}catch{return {memberId:'',crewId:''};}
}
export function assignmentLabel(data,r){
 if(r.status==='completed'&&r.teamSnapshot)return r.teamSnapshot.label;
 const record=r.crewId?data.crews.find(c=>c.id===r.crewId):data.members.find(m=>m.id===r.memberId);
 return record?record.name+(record.archived?' (archived)':''):'Unassigned';
}
export function assignedMemberIds(data,r){
 if(r.status==='completed'&&r.teamSnapshot)return r.teamSnapshot.members.map(m=>m.id);
 if(r.crewId)return (data.crews.find(c=>c.id===r.crewId)?.memberIds||[]).filter(id=>data.members.some(m=>m.id===id&&!m.archived));
 return r.memberId?[r.memberId]:[];
}
export function matchesAssignment(data,r,filter){
 if(!filter)return true;
 if(filter==='unassigned:')return !r.memberId&&!r.crewId;
 if(filter.startsWith('member:'))return assignedMemberIds(data,r).includes(filter.slice(7));
 return (r.teamSnapshot?.crewId??r.crewId)===filter.replace(/^crew:/,'');
}
export function snapshotTeam(data,job,ids,source='confirmed'){
 const members=[...new Set(ids)].map(id=>{const m=data.members.find(m=>m.id===id);if(!m)throw new Error('A selected worker no longer exists.');return {id:m.id,name:m.name};});
 return {label:assignmentLabel(data,{...job,status:'scheduled'}),crewId:job.crewId||'',members,source};
}
export function preserveTeamHistory(data){
 for(const job of data.jobs)if(job.status==='completed'&&!job.teamSnapshot)job.teamSnapshot=snapshotTeam(data,job,assignedMemberIds(data,job),'legacy-assignment');
}
export function archiveTeamRecord(data,type,id,archived=true){
 if(!['member','crew'].includes(type))throw new Error('Invalid team record.');
 const record=data[type==='member'?'members':'crews'].find(r=>r.id===id);
 if(!record)throw new Error('Team record not found.');
 preserveTeamHistory(data);record.archived=archived;
}
export function reassignJob(data,id,value){
 const job=data.jobs.find(j=>j.id===id);
 if(!job||job.status==='completed')throw new Error('Only open jobs can be reassigned.');
 Object.assign(job,assignmentFields(data,value,job));
}
