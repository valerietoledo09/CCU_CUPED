import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesInternCode,requireInternAccess} from '../intern-access.js';
test('intern code rejects missing, wrong and owner-like values',()=>{
 for(const value of [null,undefined,'','wrong','cuped2026','owner'])assert.equal(matchesInternCode(value),false);
 assert.equal(matchesInternCode('cuped2627'),true);
 assert.equal(matchesInternCode(' cuped2627 '),true);
});
test('wrong code keeps viewer locked; valid code resolves without storage or data access',async()=>{
 const previous=globalThis.document;
 const input={value:'wrong',focus(){},select(){},setAttribute(){},removeAttribute(){}};
 const error={textContent:''};const form={elements:{code:input}};
 let removed=false;const shell={hidden:false,inert:false};
 const screen={querySelector:s=>s==='form'?form:s==='#intern-access-error'?error:null,remove(){removed=true;}};
 globalThis.document={querySelector:()=>shell,createElement:()=>screen,body:{append(){}}};
 try{
  let unlocked=false;const pending=requireInternAccess().then(()=>{unlocked=true;});
  assert.equal(shell.hidden,true);assert.equal(shell.inert,true);
  form.onsubmit({preventDefault(){}});await Promise.resolve();
  assert.equal(unlocked,false);assert.equal(removed,false);assert.match(error.textContent,/did not match/);
  input.value='cuped2627';form.onsubmit({preventDefault(){}});await pending;
  assert.equal(unlocked,true);assert.equal(removed,true);assert.equal(input.value,'');
 }finally{globalThis.document=previous;}
});
test('viewer starts hidden and gate precedes plan loading and sync',async()=>{
 const html=await readFile(new URL('../view.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/id="planner-shell" hidden inert/);
 assert.match(html,/href="index.html\?owner=1">Owner login/);
 assert.ok(app.indexOf('if(readOnly)await requireInternAccess()')<app.indexOf('let state='));
 assert.ok(app.indexOf('if(readOnly)await requireInternAccess()')<app.indexOf('sync=await setupSync'));
});

test('root opens viewer by default and owner entry is explicit',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const gate=await readFile(new URL('../intern-access.js',import.meta.url),'utf8');
 assert.ok(app.includes("pageParams.get('owner')!=='1'"));
 assert.ok(gate.includes('href="index.html?owner=1"'));
});
