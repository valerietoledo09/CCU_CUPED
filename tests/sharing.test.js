import {test} from 'node:test';import assert from 'node:assert/strict';import {shareUrl,readSharedPlan} from '../sharing.js';import {initialState,enrichTeachers,applyFirstWeekPlan} from '../model.js';
test('share link transfers current schedule and week independently of browser storage',async()=>{const s=enrichTeachers(applyFirstWeekPlan(initialState()));s.visits[0].room='Room 101';s.visits[0].notes='Meet at café & bring slides';const u=new URL(await shareUrl('https://example.com/CCU_CUPED/?old=1#old',s,'2026-10-26'));assert.equal(u.pathname,'/CCU_CUPED/view.html');assert.equal(u.search,'');const plan=await readSharedPlan(u.hash);assert.ok(u.href.length<4000);assert.deepEqual(plan.state,s);assert.equal(plan.week,'2026-10-26');plan.state.visits[0].room='changed';assert.equal(s.visits[0].room,'Room 101');});
test('invalid shared links are rejected; absent snapshots return null',async()=>{assert.equal(await readSharedPlan(''),null);await assert.rejects(()=>readSharedPlan('#plan=invalid'));await assert.rejects(()=>readSharedPlan('#plan='+encodeURIComponent(JSON.stringify({state:{},week:'no'}))));});

test('a photo too large for a URL requires live sharing rather than generating an unusable snapshot link',async()=>{
 const s=enrichTeachers(applyFirstWeekPlan(initialState()));
 const bytes=new Uint8Array(50000);let seed=123456789;
 for(let i=0;i<bytes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed&255;}
 bytes.set([255,216,255]);s.teamPhoto={dataUrl:'data:image/jpeg;base64,'+Buffer.from(bytes).toString('base64'),alt:'Team photo'};
 await assert.rejects(()=>shareUrl('https://example.com/',s,'2026-10-26'),/too large.*Live sync/);
});
