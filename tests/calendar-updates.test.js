import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyFirstWeekPlan} from '../model.js';
import {applyNewPresentationTeams,newPresentationTeams,changeSnapshot,describeChanges,recordCalendarChanges,recentUpdates,teacherProgress} from '../calendar-updates.js';
import {mergePlanStates} from '../sync-state.js';
test('new teams preserve completed visit presenters, dates and rotations; later owner edits are retained',()=>{
 const state=applyFirstWeekPlan(initialState());state.visits[0].status='Completed';
 const visits=structuredClone(state.visits),rotations=structuredClone(state.rotations);
 assert.equal(applyNewPresentationTeams(state),true);assert.deepEqual(state.presenters,newPresentationTeams);
 assert.deepEqual(state.visits,visits);assert.deepEqual(state.rotations,rotations);
 assert.deepEqual(state.presenters.filter(n=>state.students.find(s=>s.name===n)?.day==='A'),newPresentationTeams.slice(0,4));
 assert.deepEqual(state.presenters.filter(n=>state.students.find(s=>s.name===n)?.day==='B'),newPresentationTeams.slice(4));
 state.presenters=['Valerie Gutierrez'];assert.equal(applyNewPresentationTeams(state),false);assert.deepEqual(state.presenters,['Valerie Gutierrez']);
});
test('status and date changes generate readable, persisted updates without duplicate render notifications',()=>{
 const state=applyFirstWeekPlan(initialState()),before=changeSnapshot(state);
 state.visits[0].status='Completed';state.visits[1].date='2026-11-02';
 assert.ok(describeChanges(before,state).some(m=>m.includes('Planned → Completed')));
 assert.ok(recordCalendarChanges(before,state,{id:'change1',at:'2026-10-30T20:00:00Z'}));
 assert.equal(recentUpdates(state).length,1);assert.equal(recordCalendarChanges(changeSnapshot(state),state),false);
 state.visits.pop();assert.ok(describeChanges(before,state).some(m=>m.includes('removed')));
});
test('dashboard counts distinct teachers separately from total visits',()=>{
 const state={visits:[{teacher:'A',status:'Confirmed'},{teacher:'A',status:'Confirmed'},{teacher:'B',status:'Completed'},{teacher:'C',status:'Completed'},{teacher:'D',status:'Pending'}]};
 assert.deepEqual(teacherProgress(state,'Confirmed'),{teachers:1,visits:2});assert.deepEqual(teacherProgress(state,'Completed'),{teachers:2,visits:2});
});
test('independent device notifications merge without creating calendar conflicts',()=>{
 const base=initialState(),local=structuredClone(base),remote=structuredClone(base);
 local.calendarUpdates={one:{id:'one',at:'2026-10-30',messages:['one']}};
 remote.calendarUpdates={two:{id:'two',at:'2026-10-30',messages:['two']}};
 const result=mergePlanStates(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.equal(recentUpdates(result.state).length,2);
});
