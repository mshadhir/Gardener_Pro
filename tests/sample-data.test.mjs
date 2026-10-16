import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,validate} from '../worker.js';
import {addSampleData} from '../public/sample-data.js';
import {existingFollowUp} from '../public/scheduling.js';
test('samples validate and cover schedule, waiting, completed and duplicate follow-up flows',()=>{
 const d=emptyData();assert.equal(addSampleData(d,'2026-10-16'),true);validate(d);
 assert.equal(d.sites.length,4);assert.equal(d.jobs.length,6);
 assert.equal(d.sites.filter(s=>!s.name).length,2);
 const current=d.jobs.find(j=>j.id.endsWith('today_1'));
 assert.equal(existingFollowUp(d.jobs,current,'2026-10-23').date,'2026-10-23');
 assert.equal(d.jobs.find(j=>j.status==='deferred').deferrals.length,1);
 assert.equal(d.jobs.filter(j=>j.status==='completed').length,1);
 assert.ok(d.entries.every(e=>e.end));
});
test('adding samples preserves real data and active timers; repeated adds preserve edits',()=>{
 const d=emptyData();d.sites.push({id:'real',name:'Real customer',address:'Real address',frequency:'weekly',tasks:[]});
 d.entries.push({id:'real_timer',siteId:'real',start:'2026-10-16T00:00:00Z',end:null});
 const original=structuredClone(d);addSampleData(d,'2026-10-16');validate(d);
 assert.deepEqual(d.sites[0],original.sites[0]);assert.deepEqual(d.entries[0],original.entries[0]);
 d.jobs[0].notes='Edited sample';const once=structuredClone(d);
 assert.equal(addSampleData(d,'2026-11-01'),false);assert.deepEqual(d,once);
});
test('reserved ID collisions fail without changing data',()=>{
 const d=emptyData();d.members.push({id:'gp_sample_member_0',name:'Existing'});const before=structuredClone(d);
 assert.throws(()=>addSampleData(d,'2026-10-16'),/already exist/);assert.deepEqual(d,before);
});
