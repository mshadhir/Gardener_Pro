import test from 'node:test';
import assert from 'node:assert/strict';
import {existingFollowUp,ensureFollowUp} from '../public/scheduling.js';
const done={id:'current',siteId:'garden',date:'2026-10-13',status:'completed',time:'09:00',memberId:'worker',crewId:''};
const booking=(id,date,extra={})=>({id,siteId:'garden',date,status:'scheduled',notes:'Keep the hedge reminder',...extra});
test('existing bookings before or after nominal next date prevent duplicates and stay unchanged',()=>{
 for(const date of ['2026-10-19','2026-10-20','2026-10-22','2026-11-02']){
  const planned=booking('planned',date),jobs=[{...done},planned],before=JSON.stringify(jobs);
  assert.equal(existingFollowUp(jobs,done,'2026-10-20'),planned);
  assert.equal(ensureFollowUp(jobs,done,'2026-10-20',()=>{throw Error('must not create')}),planned);
  assert.equal(JSON.stringify(jobs),before);
 }
});
test('no future visit creates exactly one; retry does not create another',()=>{const jobs=[{...done}];ensureFollowUp(jobs,done,'2026-10-20',()=> 'new');ensureFollowUp(jobs,done,'2026-10-20',()=> 'duplicate');assert.equal(jobs.length,2);assert.equal(jobs[1].time,'09:00');assert.equal(jobs[1].memberId,'worker')});
test('past visits and other sites do not suppress the next booking',()=>{const jobs=[{...done},booking('past','2026-10-12'),booking('other','2026-10-20',{siteId:'other'})];assert.equal(existingFollowUp(jobs,done,'2026-10-20'),null);ensureFollowUp(jobs,done,'2026-10-20',()=> 'new');assert.equal(jobs.length,4)});
test('earliest open visit is shown and completed exact-date visits are not recreated',()=>{const jobs=[booking('later','2026-10-25'),booking('earlier','2026-10-19',{status:'in-progress'})];assert.equal(existingFollowUp(jobs,done,'2026-10-20').id,'earlier');const completed=[booking('finished','2026-10-20',{status:'completed'})];ensureFollowUp(completed,done,'2026-10-20',()=> 'bad');assert.equal(completed.length,1)});
