import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveGornailToPending,pendingVisits} from '../pending-visits.js';
import {initialState,applyFirstWeekPlan,validState,validateVisit} from '../model.js';
test('Gornail moves off October 29; completed Vazquez and Cordova stay byte-for-byte intact',()=>{
 const state=applyFirstWeekPlan(initialState());
 state.visits[0].status='Completed';state.visits[1].status='Completed';
 const others=structuredClone(state.visits.filter(v=>v.teacher!=='Mr. Gornail'));
 assert.equal(moveGornailToPending(state),true);
 const [pending]=pendingVisits(state);assert.equal(pending.teacher,'Mr. Gornail');assert.equal(pending.day,'B');
 assert.equal(pending.date,'');assert.equal(pending.start,'');assert.equal(pending.end,'');assert.equal(pending.previousDate,'2026-10-29');
 assert.match(pending.notes,/had lunch/);assert.equal(validState(state),true);assert.equal(validateVisit(pending,state,pending.id),'');
 assert.deepEqual(state.visits.filter(v=>v.teacher!=='Mr. Gornail'),others);
 const copy=structuredClone(state);assert.equal(moveGornailToPending(state),false);assert.deepEqual(state,copy);
 assert.deepEqual(pendingVisits(state,'A'),[]);assert.equal(pendingVisits(state,'B').length,1);
});
test('correction does not overwrite completed, deleted, renamed or rescheduled visits',()=>{
 for(const change of [{status:'Completed'},{date:'2026-11-02'},{teacher:'Ms. Riley'},{id:'other-visit'},{status:'Cancelled'}]){
  const state=applyFirstWeekPlan(initialState());Object.assign(state.visits.find(v=>v.teacher==='Mr. Gornail'),change);
  const copy=structuredClone(state);assert.equal(moveGornailToPending(state),false);assert.deepEqual(state,copy);
 }
 const state=initialState();assert.equal(moveGornailToPending(state),false);assert.equal(state.visits.length,0);
});
