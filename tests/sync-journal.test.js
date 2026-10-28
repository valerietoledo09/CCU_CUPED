import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSyncJournal} from '../sync-journal.js';

function storage() {
 const values = new Map();
 return {get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}
const config = {url:'https://example.supabase.co', planId:'calendar-a', key:'must-not-be-stored'};
const draft = (extra = {}) => ({id:'tab-a', token:'edit-1', baseState:{assignments:[]}, baseRevision:3, state:{assignments:[{id:'task-a',description:'Keep this exact text.'}]}, updatedAt:'2026-10-28T20:00:00Z', ...extra});

test('pending edits survive new journal instances and remain scoped to their calendar', async () => {
 const saved = storage(), options = {indexedDB:null, storage:saved};
 const first = createSyncJournal(config, options), value = draft({conflicts:['assignments.task-a.description', null, 123]});
 const pending = first.put(value); value.state.assignments[0].description = 'Changed after enqueue'; await pending;
 const records = await createSyncJournal(config, options).list();
 assert.equal(records[0].state.assignments[0].description, 'Keep this exact text.');
 assert.equal(records[0].baseRevision,3);
 assert.deepEqual(records[0].conflicts,['assignments.task-a.description']);
 assert.equal(JSON.stringify(records).includes(config.key),false);
 assert.deepEqual(await createSyncJournal({...config, planId:'calendar-b'},options).list(),[]);
});

test('acknowledging an older save cannot remove a newer pending edit', async () => {
 const saved=storage(), journal=createSyncJournal(config,{indexedDB:null,storage:saved});
 await journal.put(draft());
 await journal.put(draft({token:'edit-2',state:{assignments:[{id:'task-a',description:'Newer work'}]}}));
 assert.equal(await journal.remove('tab-a','edit-1'),false);
 assert.equal((await journal.list())[0].token,'edit-2');
 assert.equal(await journal.remove('tab-a','edit-2'),true);
 assert.deepEqual(await journal.list(),[]);
});

test('closed-tab drafts coexist and a save clears only its matching draft', async () => {
 const saved=storage(), journal=createSyncJournal(config,{indexedDB:null,storage:saved});
 await Promise.all([journal.put(draft()),journal.put(draft({id:'tab-b',token:'edit-b'}))]);
 assert.equal((await journal.list()).length,2);
 await journal.remove('tab-a','edit-1');
 assert.equal((await journal.list())[0].id,'tab-b');
});

test('storage failures stay visible instead of pretending a draft was saved', async () => {
 const saved=storage(); saved.setItem=()=>{throw Error('Storage quota exceeded');};
 const journal=createSyncJournal(config,{indexedDB:null,storage:saved});
 await assert.rejects(journal.put(draft()),/quota/);
 await assert.rejects(journal.remove('tab-a',''),/token/);
});
