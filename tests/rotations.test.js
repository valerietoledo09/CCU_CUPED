import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankRotation,previousRotation,latestRotation} from '../rotations.js';
test('new rotations explicitly leave every student unassigned without changing prior roles',()=>{
 const students=[{name:'Ella'},{name:'Cathy'}];
 const old={id:'old',start:'2026-10-19',end:'2026-10-30',assignments:{Ella:'Social Media',Cathy:'Presentations'}};
 const before=structuredClone(old),next=blankRotation(students,'2026-11-02','2026-11-13','new');
 assert.deepEqual(next.assignments,{Ella:'',Cathy:''});assert.deepEqual(old,before);
 next.assignments.Ella='Teacher Outreach';assert.equal(old.assignments.Ella,'Social Media');
});
test('previous role source is the closest earlier rotation by date, not array position or selected latest',()=>{
 const older={id:'older',start:'2026-10-05',end:'2026-10-16',assignments:{}};
 const prior={id:'prior',start:'2026-10-19',end:'2026-10-30',assignments:{Ella:'Social Media'}};
 const current={id:'current',start:'2026-11-02',end:'2026-11-13',assignments:{}};
 const future={id:'future',start:'2026-11-16',end:'2026-11-27',assignments:{}};
 assert.equal(previousRotation([future,prior,older,current],current),prior);
 assert.equal(previousRotation([future,current,older,prior],prior),older);
 assert.equal(previousRotation([future,current,older,prior],older),null);
});

test('default rotation is the most recent by date even when synced records are unordered',()=>{
 const old={id:'old',start:'2026-10-19',end:'2026-10-30'};
 const latest={id:'latest',start:'2026-11-16',end:'2026-11-27'};
 const middle={id:'middle',start:'2026-11-02',end:'2026-11-13'};
 const records=[latest,old,middle];assert.equal(latestRotation(records),latest);assert.deepEqual(records,[latest,old,middle]);
 assert.equal(latestRotation([]),null);
});
