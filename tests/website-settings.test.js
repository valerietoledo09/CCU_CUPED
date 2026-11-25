import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWebsiteSettings,validateWebsiteSettings,normalizeSchoolDirectory,publicWebsiteData,cacheWebsiteData,websiteDefaults} from '../website-settings.js';
import {setupSiteManager} from '../site-manager.js';
import {loadSchoolDirectory} from '../school-portal.js';
function withLocation(fn){const previous=globalThis.location;globalThis.location={href:'https://ccu.madebyvale.com/index.html?owner=1',hash:''};try{return fn();}finally{globalThis.location=previous;}}
test('public text and design are bounded and reject executable or unreadable settings',()=>{
 const result=normalizeWebsiteSettings({homeHeading:'<b>A school</b>',announcement:'',font:'javascript:bad',primaryColor:'red;display:none',logo:{dataUrl:'data:image/svg+xml;base64,AAAA',alt:'logo'}});
 assert.equal(result.homeHeading,'<b>A school</b>');assert.equal(result.announcement,'');assert.equal(result.font,'DM Sans');assert.equal(result.primaryColor,websiteDefaults.primaryColor);assert.equal(result.logo,null);
 validateWebsiteSettings(normalizeWebsiteSettings());
 assert.throws(()=>validateWebsiteSettings(normalizeWebsiteSettings({primaryColor:'#ffffff'})),/darker/);
 assert.throws(()=>validateWebsiteSettings(normalizeWebsiteSettings({backgroundColor:'#000000'})),/lighter/);
});
test('school directory always retains the current school and only links existing HTTPS sites',()=>withLocation(()=>{
 const result=normalizeSchoolDirectory([{id:'school-two',name:'Second school',url:'https://school-two.example.org/'}]);
 assert.equal(result[0].id,'coral-reef');assert.equal(result[0].current,true);assert.equal(result[1].url,'https://school-two.example.org/');
 for(const url of ['javascript:alert(1)','http://school.example.org','https://user:password@school.example.org','https://ccu.madebyvale.com/index.html?owner=1'])assert.throws(()=>normalizeSchoolDirectory([{id:'other',name:'Other school',url}]));
 assert.throws(()=>normalizeSchoolDirectory([{id:'same',name:'One',url:'https://one.example.org'},{id:'same',name:'Two',url:'https://two.example.org'}]),/different IDs/);
}));
test('public chooser data excludes calendar, private notes and student records',()=>withLocation(()=>{
 const result=publicWebsiteData({siteSettings:{schoolName:'Coral Reef'},students:[{name:'Private example'}],visits:[{notes:'not directory metadata'}],privateTeacherNotes:['not public']});
 assert.deepEqual(Object.keys(result).sort(),['schoolDirectory','siteSettings']);
 assert.equal(JSON.stringify(result).includes('Private example'),false);
}));
test('public settings cache avoids duplicating images or storing student data',()=>withLocation(()=>{
 const previous=globalThis.localStorage;let stored='';globalThis.localStorage={setItem(key,value){stored=value;}};
 try{cacheWebsiteData({siteSettings:{homeHeading:'My website'},students:[{name:'Private example'}]});const cached=JSON.parse(stored);assert.equal(cached.siteSettings.homeHeading,'My website');assert.equal(cached.siteSettings.logo,null);assert.equal(stored.includes('Private example'),false);}finally{globalThis.localStorage=previous;}
}));
test('Manage website never mounts for students or unverified owners',()=>{
 assert.equal(setupSiteManager(),null);assert.equal(setupSiteManager({authorized:true,isAuthorized:()=>false}),null);
});
test('chooser metadata request projects only public website fields and does not use an owner session',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage,oldLocation=globalThis.location;
 globalThis.location={href:'https://ccu.madebyvale.com/index.html'};globalThis.localStorage={setItem(){}};
 const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>calls.length===1?{url:'https://example.supabase.co',key:'sb_publishable_public_test_connection_key',planId:'17a04ead-16cc-459e-a44c-8c504684b6f6'}:[{siteSettings:{schoolName:'Coral Reef'},schoolDirectory:[]}]};};
 try{
  const result=await loadSchoolDirectory();assert.equal(result.schoolDirectory[0].name,'Coral Reef');
  const url=new URL(calls[1].url);assert.equal(url.searchParams.get('select'),'siteSettings:state->siteSettings,schoolDirectory:state->schoolDirectory');
  assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.headers.Authorization,undefined);assert.equal(calls.length,2);
 }finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;globalThis.location=oldLocation;}
});
