import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState, roles} from '../model.js';
import {normalizeAssignments, validateAssignment, assignmentStatuses} from '../assignments.js';

const assignment = () => ({
  id: 'work-1', date: '2026-10-26', role: 'Teacher Outreach',
  assignees: ['Ella Corea'], description: 'Prepare the next outreach checklist.', status: 'Planned'
});

test('migration adds an empty collection without seeding work or changing existing plans', () => {
  const state = initialState();
  const visits = state.visits;
  assert.equal(normalizeAssignments(state), state);
  assert.deepEqual(state.assignments, []);
  assert.equal(state.visits, visits);
  const existing = [assignment()];
  state.assignments = existing;
  normalizeAssignments(state);
  assert.equal(state.assignments, existing);
  assert.equal(state.assignments[0].description, 'Prepare the next outreach checklist.');
});

test('all supported roles and statuses are valid, including mixed A/B teams and dates without school-day rules', () => {
  const state = initialState();
  for (const role of roles) {
    for (const status of assignmentStatuses) {
      assert.equal(validateAssignment({...assignment(), role, status, assignees: ['Ella Corea', 'Jolie Chirino']}, state), '');
    }
  }
  const withoutStatus = assignment();
  delete withoutStatus.status;
  assert.equal(validateAssignment(withoutStatus, state), '');
  assert.equal(validateAssignment({...assignment(), date: '2026-11-01'}, state), '');
});

test('invalid dates and impossible calendar dates are rejected while leap day is accepted', () => {
  const state = initialState();
  for (const date of ['', '2026-1-02', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-00', '2026-10-26T12:00:00Z']) {
    assert.match(validateAssignment({...assignment(), date}, state), /valid assignment date/);
  }
  assert.equal(validateAssignment({...assignment(), date: '2028-02-29'}, state), '');
});

test('incomplete descriptions, missing students, unknown students, roles, and statuses are rejected', () => {
  const state = initialState();
  assert.match(validateAssignment({...assignment(), description: ' \n '}, state), /Describe/);
  assert.match(validateAssignment({...assignment(), role: ''}, state), /role/);
  assert.match(validateAssignment({...assignment(), role: 'Unknown role'}, state), /role/);
  assert.match(validateAssignment({...assignment(), assignees: []}, state), /at least one/);
  assert.match(validateAssignment({...assignment(), assignees: ['Not in roster']}, state), /roster/);
  assert.match(validateAssignment({...assignment(), assignees: ['Ella Corea', 'Ella Corea']}, state), /only once/);
  assert.match(validateAssignment({...assignment(), status: 'Unavailable'}, state), /Planned/);
  assert.match(validateAssignment(null, state), /assignment/);
});

import {validState} from '../model.js';
test('shared plans allow older saves but reject malformed work assignment collections',()=>{const state=initialState();assert.ok(validState(state));state.assignments=[{id:'a',date:'2026-10-28',role:'Content Creation',description:'Prepare handouts',assignees:['Aadi Shah'],status:'Planned'}];assert.ok(validState(state));state.assignments[0].assignees='not a list';assert.equal(validState(state),false);});
