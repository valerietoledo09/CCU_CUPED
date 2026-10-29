import {roles} from './model.js?v=20';

export const assignmentRoles = [...roles, 'Field trip'];
export const assignmentStatuses = ['Planned', 'In progress', 'Done'];

// Older browser saves and exported plans predate calendar work assignments.
// Preserve existing entries and migrate only the missing collection.
export function normalizeAssignments(state) {
  if (!Array.isArray(state.assignments)) state.assignments = [];
  return state;
}

export function validateAssignment(assignment, state) {
  if (!assignment || typeof assignment !== 'object') return 'Enter a work assignment.';
  if (typeof assignment.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(assignment.date)) {
    return 'Choose a valid assignment date.';
  }
  const date = new Date(assignment.date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== assignment.date) {
    return 'Choose a valid assignment date.';
  }
  if (typeof assignment.role !== 'string' || !assignmentRoles.includes(assignment.role)) {
    return 'Choose a role for this assignment.';
  }
  if (typeof assignment.description !== 'string' || !assignment.description.trim()) {
    return 'Describe what the students should work on.';
  }
  if (!Array.isArray(assignment.assignees) || assignment.assignees.length === 0) {
    return 'Select at least one student.';
  }
  const names = new Set((state.students || []).map(student => student.name));
  if (assignment.assignees.some(name => typeof name !== 'string' || !names.has(name))) {
    return 'Choose students from the team roster.';
  }
  if (new Set(assignment.assignees).size !== assignment.assignees.length) {
    return 'Select each student only once.';
  }
  if (assignment.status !== undefined && !assignmentStatuses.includes(assignment.status)) {
    return 'Choose Planned, In progress, or Done.';
  }
  return '';
}
