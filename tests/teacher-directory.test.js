import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyTeacherDirectory,teacherRoom,visitRoom} from '../teacher-directory.js';
import {initialState,enrichTeachers,emailDraft} from '../model.js';
test('directory adds Susan Harrison and fills presentation teacher rooms without rewriting visits',()=>{
 const state=initialState();state.visits=[{id:'v',teacher:'Ms. Riley',date:'2026-11-06',room:'',status:'Completed'}];
 const visits=structuredClone(state.visits);assert.equal(applyTeacherDirectory(state),true);enrichTeachers(state);
 const h=state.teachers.find(t=>t.name==='Mrs. Harrison');assert.equal(h.email,'sharrison@dadeschools.net');assert.equal(h.room,'415');assert.equal(h.department,'Mathematics');
 const mirabal=state.teachers.find(t=>t.name==='Ms. Mirabal'),bolt=state.teachers.find(t=>t.name==='Ms. Bolt');
 assert.equal(mirabal.room,'305');assert.equal(mirabal.email,'ammirabal@dadeschools.net');assert.equal(bolt.room,'302');assert.equal(bolt.email,'michellebolt@dadeschools.net');
 assert.equal(state.teachers.length,15);assert.deepEqual(state.visits,visits);
 assert.equal(visitRoom(state.visits[0],state),'247');
 const rooms={'Ms. Vazquez':'104','Mr. Cordova':'241','Mr. Gornail':'111','Ms. Depool':'67','Ms. Mercurius':'309','Ms. Macqouid':'106','Mr. McGraw':'263','Ms. Medina':'211','Ms. Salinas':'285','Ms. Eden':'218','Mr. Lorenzo':'54'};
 for(const [name,room] of Object.entries(rooms))assert.equal(teacherRoom(state.teachers.find(t=>t.name===name)),room);
 assert.equal(applyTeacherDirectory(state),false);assert.equal(state.teachers.length,15);
});
test('entered emails and visit room exceptions take priority over directory defaults',()=>{
 const state=initialState();state.teachers[0].email='custom@example.org';state.teachers[0].room='Auditorium';
 applyTeacherDirectory(state);assert.equal(state.teachers[0].email,'custom@example.org');assert.equal(state.teachers[0].room,'Auditorium');
 assert.equal(visitRoom({teacher:'Ms. Vazquez',room:'Library'},state),'Library');
});
test('email uses known room and requests time confirmation without claiming prior consent or asking for rooms',()=>{
 const state=initialState();applyTeacherDirectory(state);
 const visit={teacher:'Mrs. Harrison',date:'2026-11-09',start:'09:40',end:'09:55',status:'Planned',presenters:['Ella Corea']};
 const draft=emailDraft(visit,state);assert.match(draft,/Mrs\. Harrison \(Room 415\)/);assert.match(draft,/in Room 415/);
 assert.doesNotMatch(draft,/share your room|you confirmed|spoke with you/i);assert.match(draft,/reply to confirm/);
 const confirmed=emailDraft({...visit,status:'Confirmed'},state);assert.match(confirmed,/Thank you for confirming/);assert.doesNotMatch(confirmed,/opportunities\?/);
});
