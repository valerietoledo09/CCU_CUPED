// Three-way merges keep independent edits from different devices without
// guessing which version of a conflicting edit the owner intended.
const MISSING = Symbol('missing');
const collections = {students: 'name', teachers: 'name', visits: 'id', assignments: 'id', rotations: 'id'};
const object = value => value !== MISSING && value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => value === MISSING ? MISSING : structuredClone(value);
const field = (value, key) => object(value) && Object.hasOwn(value, key) ? value[key] : MISSING;

function equal(a, b) {
 if (a === b) return true;
 if (a === MISSING || b === MISSING || a === null || b === null || typeof a !== typeof b) return false;
 if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => equal(value, b[index]));
 if (!object(a) || !object(b)) return false;
 const keys = Object.keys(a);
 return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
}

function records(value, key) {
 if (value === MISSING) return new Map();
 if (!Array.isArray(value)) return null;
 const result = new Map();
 for (const item of value) {
  if (!object(item) || typeof item[key] !== 'string' || result.has(item[key])) return null;
  result.set(item[key], item);
 }
 return result;
}

export function mergePlanStates(base, local, remote) {
 if (!object(local) || !object(remote)) throw Error('Two valid calendar states are required to merge changes.');
 const conflicts = [];
 const ancestor = object(base) ? base : MISSING;
 function conflict(path, value) {
  conflicts.push(path.join('.'));
  return copy(value);
 }
 function merge(previous, ours, theirs, path) {
  if (equal(ours, theirs)) return copy(ours);
  if (equal(ours, previous)) return copy(theirs);
  if (equal(theirs, previous)) return copy(ours);
  // Without an ancestor, an absent value means this device has not seen it.
  // It must not be interpreted as an intentional deletion.
  if (previous === MISSING) {
   if (ours === MISSING) return copy(theirs);
   if (theirs === MISSING) return copy(ours);
  }
  const collectionKey = path.length === 1 && collections[path[0]];
  if (collectionKey) {
   const old = records(previous, collectionKey), own = records(ours, collectionKey), other = records(theirs, collectionKey);
   if (!old || !own || !other) return conflict(path, ours);
   const merged = [];
   for (const id of new Set([...own.keys(), ...other.keys(), ...old.keys()])) {
    const item = merge(old.has(id) ? old.get(id) : MISSING, own.has(id) ? own.get(id) : MISSING, other.has(id) ? other.get(id) : MISSING, [...path, id]);
    if (item !== MISSING) merged.push(item);
   }
   return merged;
  }
  if (path.length === 1 && path[0] === 'presenters' && [ours, theirs].every(value => Array.isArray(value) && value.every(item => typeof item === 'string')) && (previous === MISSING || Array.isArray(previous))) {
   const old = new Set(previous === MISSING ? [] : previous), own = new Set(ours), other = new Set(theirs);
   return [...new Set([...ours, ...theirs])].filter(name => old.has(name) ? own.has(name) && other.has(name) : own.has(name) || other.has(name));
  }
  if (object(ours) && object(theirs) && (previous === MISSING || object(previous))) {
   const merged = {};
   for (const key of new Set([...Object.keys(ours), ...Object.keys(theirs), ...(previous === MISSING ? [] : Object.keys(previous))])) {
    const value = merge(field(previous, key), field(ours, key), field(theirs, key), [...path, key]);
    if (value !== MISSING) Object.defineProperty(merged, key, {value, enumerable: true, writable: true, configurable: true});
   }
   return merged;
  }
  return conflict(path, ours);
 }
 return {state: merge(ancestor, local, remote, []), conflicts};
}
