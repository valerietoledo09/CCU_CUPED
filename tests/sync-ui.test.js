import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupSync} from '../sync-ui.js';
import {initialState} from '../model.js';
import {createSyncJournal} from '../sync-journal.js';

const config={url:'https://fixture.supabase.co',key:'sb_publishable_fixture_owner_single_session',planId:'11111111-1111-4111-8111-111111111111'};
const uid='22222222-2222-4222-8222-222222222222';
const clone=value=>structuredClone(value);
const task=(id='social')=>({id,date:'2026-10-28',role:'Social Media',assignees:['Amanda Posner'],description:'Create the approved social media video.',status:'In progress'});
const baseState=()=>({...initialState(),assignments:[]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t,{local=baseState(),remote=baseState(),last=remote,lastRevision=1,hasLocalPlan=true,localWriterId='fixture-tab',writerId='fixture-writer'}={}){
 const previous=new Map();
 const globals={};
 const node=()=>({textContent:'',value:'',required:false,disabled:false,hidden:false,readOnly:false,addEventListener(){},removeEventListener(){},closest(){return this;},showModal(){},close(){},remove(){},querySelector(){return node();}});
 const statusNode=node(),settings=node(),error=node(),submit=node(),elements=Object.fromEntries(['url','key','planId','email','password'].map(name=>[name,node()]));
 const form={...node(),elements,querySelector(){return submit;}};
 const dialogNodes=new Map();
 const dialog={...node(),querySelector(selector){if(selector==='form')return form;if(selector==='#cloud-error')return error;if(!dialogNodes.has(selector))dialogNodes.set(selector,node());return dialogNodes.get(selector);}};
 const storage=new Map();
 storage.set('cuped-cloud-config',JSON.stringify(config));
 storage.set('cuped-cloud-last-state',JSON.stringify({url:config.url,planId:config.planId,revision:lastRevision,state:last}));
 globals.document=Object.assign(new EventTarget(),{hidden:false,querySelector(selector){return selector==='#sync-status'?statusNode:settings;},createElement(){return dialog;},body:{append(){}}});
 globals.window=new EventTarget();
 globals.location={hash:''};
 globals.confirm=()=>true;
 const tabStorage=new Map([['cuped-editor-tab','fixture-tab']]);globals.sessionStorage={getItem:key=>tabStorage.get(key)??null,setItem:(key,value)=>tabStorage.set(key,String(value))};
 globals.localStorage={get length(){return storage.size;},key:index=>[...storage.keys()][index]??null,getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
 for(const [name,value] of Object.entries(globals)){previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}
 let state=clone(local),row={id:config.planId,owner_id:uid,state:clone(remote),revision:1},delay=null,saveError=null,saves=0,controller;
 const client={config:clone(config),session:{user:{id:uid},access_token:'fixture'},async getUser(){return {id:uid};},async load(){return clone(row);},async loadIfChanged(knownRevision){if(delay)return delay.promise;return knownRevision===row.revision?null:clone(row);},async save(snapshot,revision){saves++;if(saveError)throw saveError;assert.equal(revision,row.revision);row={...row,state:clone(snapshot),revision:row.revision+1};return clone(row);}};
 t.after(()=>{controller?.destroy();for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 return {client,storage,statusNode,get state(){return state;},get row(){return row;},get saves(){return saves;},set saveError(value){saveError=value;},holdRead(){delay=deferred();return {row:clone(row),release(value){delay.resolve(value);delay=null;}};},async start(){controller=await setupSync({readOnly:false,hasLocalPlan,localWriterId,writerId,ownerClient:client,getState:()=>clone(state),applyState:incoming=>state=clone(incoming)});await settle();return controller;},stop(){controller?.destroy();},edit(entry=task()){state.assignments.push(entry);controller.queueSave(clone(state));},updateLocal(change){change(state);controller.queueSave(clone(state));},click(selector){return dialog.querySelector(selector).onclick?.();},setRemote(next){row={...row,state:clone(next),revision:row.revision+1};}};
}

test('a late refresh cannot replace a newer task that was saved while the read was in flight',async t=>{
 const f=fixture(t),ctrl=await f.start();
 const pendingRead=f.holdRead();const refresh=ctrl.refresh();
 f.edit();const saving=ctrl.flush();await settle();
 pendingRead.release(pendingRead.row);await Promise.all([refresh,saving]);await ctrl.flush();
 assert.equal(f.state.assignments.length,1,'the just-saved task must remain in the editor');
 assert.equal(f.state.assignments[0].description,task().description);
 assert.deepEqual(f.row.state.assignments,[task()]);
});

test('an unsynced local task survives restarting sync and can continue saving automatically',async t=>{
 const local=baseState();local.assignments.push(task());
 const f=fixture(t,{local,remote:baseState(),last:baseState(),lastRevision:null}),ctrl=await f.start();
 await ctrl.flush();await settle();
 assert.equal(f.state.assignments.length,1);
 assert.equal(f.row.state.assignments.length,1,'reopening must resume the local save instead of requiring replacement with the old shared copy');
});

test('a failed save keeps the exact task available for a retry',async t=>{
 const f=fixture(t),ctrl=await f.start();f.saveError=Error('Connection unavailable');
 f.edit();await ctrl.flush();assert.equal(f.state.assignments[0].description,task().description);assert.equal(f.row.state.assignments.length,0);
 f.saveError=null;await ctrl.flush();
 assert.deepEqual(f.row.state.assignments,[task()]);assert.deepEqual(f.state.assignments,[task()]);
});


test('independent tasks added on another device combine with unsent local work',async t=>{
 const f=fixture(t),ctrl=await f.start();f.edit();
 const remote=baseState();remote.assignments.push({...task('field-trip'),role:'Field trip',description:'Attend the leadership conference.'});f.setRemote(remote);
 await ctrl.refresh();await ctrl.flush();
 assert.deepEqual(new Set(f.state.assignments.map(a=>a.id)),new Set(['social','field-trip']));
 assert.deepEqual(f.row.state.assignments,f.state.assignments);
});

test('an intentional local deletion stays deleted while another device adds a different task',async t=>{
 const initial=baseState();initial.assignments=[task()];
 const f=fixture(t,{local:initial,remote:initial,last:initial}),ctrl=await f.start();
 f.updateLocal(state=>state.assignments=[]);
 const remote=clone(initial);remote.assignments.push({...task('field-trip'),role:'Field trip'});f.setRemote(remote);
 await ctrl.refresh();await ctrl.flush();
 assert.deepEqual(f.state.assignments.map(a=>a.id),['field-trip']);
 assert.deepEqual(f.row.state.assignments.map(a=>a.id),['field-trip']);
});

test('a same-detail conflict keeps the local text and waits for the owner to choose before writing',async t=>{
 const initial=baseState();initial.assignments=[task()];
 const f=fixture(t,{local:initial,remote:initial,last:initial}),ctrl=await f.start();
 f.updateLocal(state=>state.assignments[0].description='My exact updated description.');
 const remote=clone(initial);remote.assignments[0].description='A different description from another device.';f.setRemote(remote);
 await ctrl.refresh();await ctrl.flush();
 assert.equal(f.state.assignments[0].description,'My exact updated description.');
 assert.equal(f.row.state.assignments[0].description,remote.assignments[0].description);
 assert.equal(f.saves,0,'a conflicting detail must not be overwritten automatically');
 assert.match(f.statusNode.textContent,/same detail|same.*detail|Both|Two versions/);
 await f.click('#cloud-keep-local');await ctrl.flush();
 assert.equal(f.row.state.assignments[0].description,'My exact updated description.');
});


test('startup reconciles an unsent task even when the cloud revision has not changed',async t=>{
 const local=baseState();local.assignments=[task()];
 const f=fixture(t,{local,remote:baseState(),last:baseState(),lastRevision:1}),ctrl=await f.start();
 await ctrl.flush();await settle();
 assert.equal(f.state.assignments.length,1);
 assert.deepEqual(f.row.state.assignments,[task()],'metadata alone cannot establish that the unsent local work was saved');
});

test('several save callers waiting on one request do not start overlapping writes',async t=>{
 const f=fixture(t),ctrl=await f.start(),firstSave=deferred();
 const save=f.client.save.bind(f.client);let active=0,maximum=0,calls=0;
 f.client.save=async (...args)=>{active++;maximum=Math.max(maximum,active);calls++;try{if(calls===1)await firstSave.promise;else await settle();return await save(...args);}finally{active--;}};
 f.edit();const first=ctrl.flush();await settle();
 f.edit({...task('second-task'),description:'A second independent task.'});
 const second=ctrl.flush(),third=ctrl.flush();firstSave.resolve();
 await Promise.all([first,second,third]);await ctrl.flush();
 assert.equal(maximum,1,'concurrent flush callers must share a single write queue');
 assert.deepEqual(new Set(f.row.state.assignments.map(a=>a.id)),new Set(['social','second-task']));
});


test('a newer recovery journal restores work even when the main browser plan stayed stale',async t=>{
 const f=fixture(t),recovered=baseState();recovered.assignments=[task()];
 await createSyncJournal(config).put({id:'fixture-tab',token:'recover-own-task',baseState:baseState(),baseRevision:1,state:recovered,updatedAt:Date.now()});
 const ctrl=await f.start();await ctrl.flush();
 assert.deepEqual(f.state.assignments,[task()]);assert.deepEqual(f.row.state.assignments,[task()]);
});

test('a recovery draft without a main browser plan uses the shared plan instead of prototype visits',async t=>{
 const prototype=baseState();prototype.visits=[{id:'prototype-visit',date:'2026-10-29',teacher:'Ms. Vazquez',start:'09:40',end:'09:55',presenters:[]}];
 const remote=baseState(),f=fixture(t,{local:prototype,remote,last:null,hasLocalPlan:false});
 const recovered=clone(remote);recovered.assignments=[task()];
 await createSyncJournal(config).put({id:'fixture-tab',token:'recover-no-main-plan',baseState:remote,baseRevision:1,state:recovered,updatedAt:Date.now()});
 const ctrl=await f.start();await ctrl.flush();
 assert.deepEqual(f.state.visits,[]);assert.deepEqual(f.row.state.visits,[]);assert.deepEqual(f.row.state.assignments,[task()]);
});

test('an unresolved same-detail conflict remains paused after restarting the controller',async t=>{
 const initial=baseState();initial.assignments=[task()];
 const f=fixture(t,{local:initial,remote:initial,last:initial});let ctrl=await f.start();
 f.updateLocal(state=>state.assignments[0].description='Keep my unresolved text.');
 const remote=clone(initial);remote.assignments[0].description='Other device text.';f.setRemote(remote);
 await ctrl.refresh();await settle();f.stop();ctrl=await f.start();await ctrl.flush();
 assert.equal(f.saves,0);assert.equal(f.state.assignments[0].description,'Keep my unresolved text.');assert.equal(f.row.state.assignments[0].description,'Other device text.');
 assert.match(f.statusNode.textContent,/same detail|same.*detail|Both|Two versions/);
});


test('a newer own recovery draft stays visible when stale main storage and the shared task also differ',async t=>{
 const ancestor=baseState();ancestor.assignments=[task()];
 const recovered=clone(ancestor);recovered.assignments[0].description='My newer task text kept only in recovery storage.';
 const remote=clone(ancestor);remote.assignments[0].description='The other device changed this task too.';
 const f=fixture(t,{local:ancestor,remote,last:ancestor,localWriterId:'fixture-tab',writerId:'fixture-writer'});
 const journal=createSyncJournal(config);
 await journal.put({id:'fixture-tab',token:'recover-conflicting-task',baseState:ancestor,baseRevision:1,state:recovered,updatedAt:Date.now()});
 let ctrl=await f.start();await ctrl.flush();await settle();
 assert.equal(f.state.assignments[0].description,recovered.assignments[0].description,'the newest recovered owner text must be shown while awaiting a conflict choice');
 assert.equal(f.row.state.assignments[0].description,remote.assignments[0].description);assert.equal(f.saves,0);
 const drafts=await journal.list();
 assert.ok(drafts.length>0);assert.ok(drafts.every(draft=>draft.state.assignments[0].description===recovered.assignments[0].description),'recovery must not rewrite the newer owner draft with the competing shared text');
 f.stop();ctrl=await f.start();await ctrl.flush();
 assert.equal(f.state.assignments[0].description,recovered.assignments[0].description);assert.equal(f.saves,0);
});
