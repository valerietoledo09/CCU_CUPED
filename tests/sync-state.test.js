import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergePlanStates} from '../sync-state.js';
import {initialState} from '../model.js';

function fixture() {
 const state = initialState();
 state.assignments = [{id: 'social', date: '2026-10-28', role: 'Social Media', description: 'Original task', assignees: ['Amanda Posner'], status: 'Planned'}];
 state.visits = [{id: 'visit', date: '2026-10-29', teacher: 'Ms. Vazquez', status: 'Planned', notes: 'Original notes'}];
 return state;
}

test('independent new tasks from two devices remain together without changing either input', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.assignments.push({...local.assignments[0], id: 'social-new', description: 'Create the video'});
 remote.assignments.push({...remote.assignments[0], id: 'trip', role: 'Field trip', description: 'Conference'});
 const before = structuredClone({base, local, remote});
 const result = mergePlanStates(base, local, remote);
 assert.deepEqual(result.conflicts, []);
 assert.deepEqual(result.state.assignments.map(task => task.id), ['social', 'social-new', 'trip']);
 assert.deepEqual({base, local, remote}, before);
 result.state.assignments[0].description = 'Changed result';
 assert.equal(local.assignments[0].description, 'Original task');
});

test('different fields of one task merge while a conflicting description requires owner review', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.assignments[0].description = 'Film and create content';
 remote.assignments[0].status = 'In progress';
 let result = mergePlanStates(base, local, remote);
 assert.deepEqual(result.conflicts, []);
 assert.equal(result.state.assignments[0].description, 'Film and create content');
 assert.equal(result.state.assignments[0].status, 'In progress');
 remote.assignments[0].description = 'Different instructions';
 result = mergePlanStates(base, local, remote);
 assert.deepEqual(result.conflicts, ['assignments.social.description']);
 assert.equal(result.state.assignments[0].description, 'Film and create content');
 assert.equal(result.state.assignments[0].status, 'In progress');
});

test('intentional deletions survive unrelated remote additions without resurrecting tasks', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.assignments = [];
 remote.assignments.push({...remote.assignments[0], id: 'trip', role: 'Field trip'});
 let result = mergePlanStates(base, local, remote);
 assert.deepEqual(result.conflicts, []);
 assert.deepEqual(result.state.assignments.map(task => task.id), ['trip']);
 result = mergePlanStates(base, remote, local);
 assert.deepEqual(result.conflicts, []);
 assert.deepEqual(result.state.assignments.map(task => task.id), ['trip']);
});

test('edit versus deletion is a conflict in either direction and keeps the local choice', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.assignments = [];
 remote.assignments[0].description = 'Remote edits';
 let result = mergePlanStates(base, local, remote);
 assert.deepEqual(result.conflicts, ['assignments.social']);
 assert.deepEqual(result.state.assignments, []);
 result = mergePlanStates(base, remote, local);
 assert.deepEqual(result.conflicts, ['assignments.social']);
 assert.equal(result.state.assignments[0].description, 'Remote edits');
});

test('unknown ancestor keeps unseen remote records and reports same-field disagreements', () => {
 const local = fixture(), remote = structuredClone(local);
 remote.assignments.push({...remote.assignments[0], id: 'trip', role: 'Field trip'});
 local.assignments[0].description = 'Local instructions';
 const result = mergePlanStates(null, local, remote);
 assert.deepEqual(result.conflicts, ['assignments.social.description']);
 assert.deepEqual(result.state.assignments.map(task => task.id), ['social', 'trip']);
 assert.equal(result.state.assignments[0].description, 'Local instructions');
 const unseen = mergePlanStates(undefined, {...local, assignments: []}, remote);
 assert.deepEqual(unseen.conflicts, []);
 assert.equal(unseen.state.assignments.length, 2);
});

test('roster, teachers, visits and rotations merge by identity and retain independent nested edits', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.students[0].day = 'B';
 remote.students[1].role = 'Presentations';
 local.teachers[0].email = 'teacher@example.com';
 remote.teachers[0].lunch = {A: 'first', B: 'second'};
 local.visits[0].notes = 'Local notes';
 remote.visits[0].status = 'Confirmed';
 local.rotations[0].assignments['Aadi Shah'] = 'Social Media';
 remote.rotations[0].assignments['Ella Corea'] = 'Content Creation';
 const {state, conflicts} = mergePlanStates(base, local, remote);
 assert.deepEqual(conflicts, []);
 assert.equal(state.students[0].day, 'B');
 assert.equal(state.students[1].role, 'Presentations');
 assert.equal(state.teachers[0].email, 'teacher@example.com');
 assert.deepEqual(state.teachers[0].lunch, {A: 'first', B: 'second'});
 assert.equal(state.visits[0].notes, 'Local notes');
 assert.equal(state.visits[0].status, 'Confirmed');
 assert.equal(state.rotations[0].assignments['Aadi Shah'], 'Social Media');
 assert.equal(state.rotations[0].assignments['Ella Corea'], 'Content Creation');
});

test('presenter additions and removals combine as set changes while task assignees stay atomic', () => {
 const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
 local.presenters = local.presenters.slice(1);
 local.presenters.push('Amanda Posner');
 remote.presenters.push('Ella Corea');
 local.assignments[0].assignees = ['Amanda Posner', 'Ella Corea'];
 remote.assignments[0].assignees = ['Amanda Posner', 'Jolie Chirino'];
 const {state, conflicts} = mergePlanStates(base, local, remote);
 assert.deepEqual(conflicts, ['assignments.social.assignees']);
 assert.equal(state.presenters.includes(base.presenters[0]), false);
 assert.ok(state.presenters.includes('Amanda Posner'));
 assert.ok(state.presenters.includes('Ella Corea'));
 assert.deepEqual(state.assignments[0].assignees, local.assignments[0].assignees);
});

test('optional photo deletion is retained and conflicting photo changes are explicit', () => {
 const base = {...fixture(), teamPhoto: {dataUrl: 'old', alt: 'Team'}}, local = structuredClone(base), remote = structuredClone(base);
 delete local.teamPhoto;
 assert.equal(Object.hasOwn(mergePlanStates(base, local, remote).state, 'teamPhoto'), false);
 remote.teamPhoto.dataUrl = 'remote';
 assert.deepEqual(mergePlanStates(base, local, remote).conflicts, ['teamPhoto']);
});
