// Explicit, one-time opt-in. Never replace existing workspace records.
export function addSampleData(data, date) {
 if(data.settings.sampleDataAdded)return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw new Error('Invalid sample date.');
 const keys=['sites','jobs','members','crews','entries'];
 if(keys.some(k=>data[k].some(r=>r.id.startsWith('gp_sample_'))))throw new Error('Sample records already exist. No records were changed.');
 const day=n=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const id=s=>'gp_sample_'+s;
 const members=['Alex','Sam'].map((name,i)=>({id:id('member_'+i),name:'[Sample] '+name,role:'Gardener',phone:'',email:''}));
 const crews=[{id:id('crew'),name:'[Sample] Garden crew',memberIds:members.map(m=>m.id)}];
 const sites=[
  {name:'[Sample] Central Business Park',address:'100 Example Avenue, Demo Park',estimatedTime:'2h',nextVisitNote:'Trim back bushes beside the front entrance on the next visit.'},
  {name:'',address:'[Sample] Unit 2, 24 Example Street, Demo Park',estimatedTime:'1h',nextVisitNote:'Close the side gate when leaving.'},
  {name:'[Sample] Riverside Offices',address:'200 Example Road, Demo Park',estimatedTime:'3h',nextVisitNote:'Check the hedge after the rain.'},
  {name:'',address:'[Sample] Unit 5, 40 Example Court, Demo Park',estimatedTime:'30m',nextVisitNote:''}
 ].map((s,i)=>({id:id('site_'+i),frequency:i===3?'fortnightly':'weekly',preferredDay:'',memberId:'',crewId:crews[0].id,rideOn:false,parking:'Fictional test location — do not travel here.',notes:'Sample data for testing only.',lastCompleted:i===3?day(-1):'',tasks:[{id:id('task_'+i),name:'Mow lawn and tidy edges',done:false}],...s}));
 const job=(suffix,siteIndex,offset,extra={})=>({id:id('job_'+suffix),siteId:sites[siteIndex].id,date:day(offset),time:'',memberId:'',crewId:crews[0].id,notes:'Sample visit for testing only.',status:'scheduled',photos:[],...extra});
 const jobs=[
  job('today_1',0,0,{time:'09:00',order:0}),
  job('today_2',1,0,{time:'11:30',order:1}),
  job('tomorrow',3,1),
  job('next_week',0,7,{time:'09:00'}),
  job('waiting',2,-2,{status:'deferred',deferrals:[{date:day(-2),reason:'[Sample] Heavy rain — return when there is a gap in the schedule.',at:day(-2)+'T00:00:00Z'}]}),
  job('completed',3,-1,{status:'completed',notes:'[Sample] Lawn mowed and edges tidied.',completedAt:day(-1)+'T00:30:00Z'})
 ];
 const entries=[{id:id('entry'),siteId:sites[3].id,start:day(-1)+'T00:00:00Z',end:day(-1)+'T00:30:00Z',notes:'[Sample] Completed maintenance visit.'}];
 const samples={sites,jobs,members,crews,entries};
 for(const key of keys)data[key].push(...samples[key]);
 data.settings.sampleDataAdded=true;
 return true;
}
