import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../model.js';
import {applyRudyPresentationChange,applyNovemberRoles,novemberAssignments,novemberPresenters,verifiedPriorRoles} from '../november-rotation.js';
import {applyNewPresentationTeams} from '../calendar-updates.js';
function fixture(){const state=initialState();state.rotations=[{id:'october',start:'2026-10-19',end:'2026-10-30',assignments:Object.fromEntries(Object.entries(verifiedPriorRoles).map(([name,roles])=>[name,roles[0]]))},{id:'november',start:'2026-11-02',end:'2026-11-13',assignments:Object.fromEntries(Object.entries(verifiedPriorRoles).map(([name,roles])=>[name,roles[1]]))}];return state;}
test('all 21 students receive unused roles and Valerie remains Project Lead',()=>{
 const state=fixture(),prior=structuredClone(state.rotations),visits=structuredClone(state.visits);
 assert.equal(applyNovemberRoles(state).changed,true);
 assert.equal(Object.keys(novemberAssignments).length,22);
 for(const [name,role] of Object.entries(novemberAssignments))if(name!=='Valerie Gutierrez')assert.equal(verifiedPriorRoles[name].includes(role),false,name);
 assert.equal(state.rotations.at(-1).assignments['Valerie Gutierrez'],'Project Lead');
 assert.deepEqual(state.rotations.slice(0,2),prior);assert.deepEqual(state.visits,visits);
 assert.deepEqual(state.presenters,novemberPresenters);
 assert.equal(state.presenters.filter(name=>state.students.find(s=>s.name===name).day==='A').length,3);
 assert.equal(state.presenters.filter(name=>state.students.find(s=>s.name===name).day==='B').length,3);
});
test('owner edits survive reload and the old team migration cannot undo the new teams',()=>{
 const state=fixture();applyNovemberRoles(state);state.presenters=['Amanda Posner'];state.rotations.at(-1).assignments['Aadi Shah']='Mobile Branch Help';
 assert.equal(applyNovemberRoles(state).changed,false);assert.equal(applyNewPresentationTeams(state),false);
 assert.deepEqual(state.presenters,['Amanda Posner']);assert.equal(state.rotations.at(-1).assignments['Aadi Shah'],'Mobile Branch Help');
});
test('additional recorded repeats block changes instead of silently reusing roles or presenters',()=>{
 const state=fixture();state.rotations.push({id:'older',start:'2026-09-01',end:'2026-09-14',assignments:{'Aadi Shah':'Social Media'}});
 const before=structuredClone(state);assert.match(applyNovemberRoles(state).issue,/already had/);assert.deepEqual(state,before);
 const other=fixture();other.visits.push({date:'2026-11-09',status:'Completed',presenters:['Amanda Posner']});
 assert.match(applyNovemberRoles(other).issue,/presentation history/);
});
test('blank existing target is filled but nonblank or overlapping rotations are preserved',()=>{
 const state=fixture();state.rotations.push({id:'blank',start:'2026-11-16',end:'2026-11-27',assignments:Object.fromEntries(state.students.map(s=>[s.name,'']))});
 assert.equal(applyNovemberRoles(state).changed,true);assert.equal(state.rotations.at(-1).id,'blank');
 const other=fixture();other.rotations.push({id:'assigned',start:'2026-11-16',end:'2026-11-27',assignments:{'Aadi Shah':'Social Media'}});
 assert.match(applyNovemberRoles(other).issue,/already has role assignments/);
});

test('Rudy amendment updates only his current role and presenter membership after the rotation was saved',()=>{
 const state=fixture();applyNovemberRoles(state);
 state.rotations.at(-1).assignments['Rudy Ramos']='Student Recruitment';
 state.presenters=state.presenters.filter(name=>name!=='Rudy Ramos');
 delete state.rudyPresentationRevision;
 const previous=structuredClone(state.rotations.slice(0,2));
 const otherRoles=Object.fromEntries(Object.entries(state.rotations.at(-1).assignments).filter(([name])=>name!=='Rudy Ramos'));
 assert.equal(applyNovemberRoles(state).changed,true);
 assert.equal(state.rotations.at(-1).assignments['Rudy Ramos'],'Presentations');
 assert.equal(state.presenters.includes('Rudy Ramos'),true);
 assert.deepEqual(state.rotations.slice(0,2),previous);
 assert.deepEqual(Object.fromEntries(Object.entries(state.rotations.at(-1).assignments).filter(([name])=>name!=='Rudy Ramos')),otherRoles);
 assert.equal(applyRudyPresentationChange(state).changed,false);
});
