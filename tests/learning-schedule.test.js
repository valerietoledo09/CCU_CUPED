import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningSchedule,learningOn} from '../learning-schedule.js';
import {schoolDateInfo} from '../school-calendar.js';
import {initialState} from '../model.js';
test('published program schedule contains 73 unique dates, all instructional',()=>{
 assert.equal(learningSchedule.length,73);
 assert.equal(new Set(learningSchedule.map(e=>e.date)).size,73);
 for(const event of learningSchedule){assert.equal(schoolDateInfo(event.date).noSchool,false,event.date);assert.equal(event.day,schoolDateInfo(event.date).day);}
 assert.deepEqual(learningSchedule.filter(e=>e.dayWarning).map(e=>e.date),['2026-11-17','2027-02-03']);
});
test('learning hosts and times stay separate from work assignments and intern visits',()=>{
 const activities=learningSchedule.flatMap(e=>e.activities);
 assert.equal(activities.filter(a=>a.title.startsWith('Classroom presentation')).length,10);
 assert.equal(activities.filter(a=>a.title.includes('Module')).length,20);
 for(const a of activities){
  if(a.title.startsWith('Classroom')||a.kind==='tabling')assert.equal(a.host,'Rory');
  if(a.title.startsWith('FinEd')){assert.equal(a.host,'Emory');assert.equal(a.time,'Time not listed');}
 }
 const state=initialState();assert.equal(state.visits.length,0);assert.equal(state.assignments,undefined);
 assert.equal(learningOn('2026-10-28','A').length,1);
 assert.equal(learningOn('2026-10-28','B').length,0);
});
test('mobile branch dates follow the document rather than an invented recurrence',()=>{
 const mobile=learningSchedule.filter(e=>e.mobile);assert.equal(mobile.length,17);
 const grouped=Object.groupBy(mobile,e=>e.date.slice(0,7));
 for(const [month,events] of Object.entries(grouped)){
  assert.equal(events.length,month==='2026-12'?1:2);
  if(month!=='2026-12')assert.deepEqual(events.map(e=>e.day).sort(),['A','B']);
 }
 assert.equal(grouped['2026-12'][0].date,'2026-12-09');
 assert.equal(learningOn('2026-11-17','A')[0].sourceDay,'B');
 assert.equal(learningOn('2027-02-03','A')[0].sourceDay,'B');
});
