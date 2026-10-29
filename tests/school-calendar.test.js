import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schoolDays,schoolDateInfo,calendarRange} from '../school-calendar.js';
import {initialState,applyFirstWeekPlan,validateVisit,roles} from '../model.js';
import {assignmentRoles,validateAssignment} from '../assignments.js';
test('school calendar has 180 instructional days and matches published month boundaries',()=>{
 assert.equal(Object.keys(schoolDays).length,180);
 const anchors={'2026-08-13':'A','2026-09-01':'B','2026-09-22':'A','2026-10-01':'B','2026-10-29':'B','2026-10-30':'A','2026-11-02':'B','2026-11-30':'A','2026-12-01':'B','2027-01-04':'A','2027-01-19':'B','2027-02-01':'A','2027-03-01':'B','2027-03-11':'A','2027-03-30':'B','2027-04-01':'B','2027-05-03':'B','2027-06-01':'B','2027-06-03':'B'};
 for(const [date,day] of Object.entries(anchors))assert.equal(schoolDays[date],day,date);
 for(const date of ['2026-09-21','2026-11-03','2026-11-11','2026-11-23','2026-12-18','2027-01-15','2027-03-10','2027-03-29','2027-05-31','2027-06-04','2026-10-31']){assert.equal(schoolDateInfo(date).noSchool,true,date);assert.equal(schoolDays[date],undefined);}
 assert.equal(schoolDateInfo('2027-07-01').noSchool,false);
});
test('month range includes all dates with Monday start and complete weeks',()=>{
 for(let month=0;month<12;month++){
  const {start,count,columns}=calendarRange(new Date(2027,month,15,12),'month');
  assert.equal(start.getDay(),1);assert.equal(count%7,0);assert.equal(columns,7);
  const end=new Date(start);end.setDate(end.getDate()+count-1);
  assert.ok(start<=new Date(2027,month,1,12));assert.ok(end>=new Date(2027,month+1,0,12));
 }
});
test('school dates validate visits without generating year-long recurring visits',()=>{
 const state=applyFirstWeekPlan(initialState());
 assert.ok(state.visits.every(v=>['2026-10-29','2026-10-30'].includes(v.date)));
 const visit={...state.visits[0],date:'2026-11-03'};
 assert.match(validateVisit(visit,state),/No school/);
 assert.match(validateVisit({...visit,date:'2026-11-04',day:'B'},state),/A-Day/);
});
test('mobile branch help and Rory tabling work can be assigned without changing old roles',()=>{
 for(const role of ['Mobile Branch Help','Tabling with Rory']){
  assert.ok(roles.includes(role));assert.ok(assignmentRoles.includes(role));
  assert.equal(validateAssignment({date:'2026-11-03',role,description:'Help the team',assignees:['Valerie Gutierrez']},initialState()),'');
 }
 assert.ok(assignmentRoles.includes('Field trip'));assert.ok(roles.includes('Mobile Branch Promotion'));
});
