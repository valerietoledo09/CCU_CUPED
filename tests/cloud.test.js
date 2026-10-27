import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudCalendar,CloudConflictError,validateCloudConfig} from '../cloud.js';
const config={url:'https://school-example.supabase.co',key:'sb_publishable_example_public_browser_key',planId:'123e4567-e89b-42d3-a456-426614174000'};
const owner='123e4567-e89b-42d3-a456-426614174001';
function session(extra={}){return {access_token:'owner-session',refresh_token:'owner-refresh',expires_at:Math.floor(Date.now()/1000)+3600,project_url:config.url,user:{id:owner},...extra};}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
function row(revision=1){return {id:config.planId,owner_id:owner,state:{version:1,visits:[]},revision,updated_at:'2026-10-27T00:00:00Z'};}
test('configuration accepts public browser keys and rejects secret keys, unsafe URLs, and invalid IDs',()=>{
 assert.deepEqual(validateCloudConfig({...config,url:config.url+'/'}),config);
 const jwt=payload=>'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify(payload))+'.signature';
 assert.equal(validateCloudConfig({...config,key:jwt({role:'anon'})}).key,jwt({role:'anon'}));
 for(const key of ['sb_secret_do_not_use_in_browser',jwt({role:'service_role'}),jwt({role:'authenticated'}),'arbitrary-password'])assert.throws(()=>validateCloudConfig({...config,key}),/public/);
 for(const url of ['http://school-example.supabase.co','https://user:pass@school-example.supabase.co','https://school-example.supabase.co/path','https://school-example.supabase.co?x=1'])assert.throws(()=>validateCloudConfig({...config,url}),/HTTPS/);
 assert.throws(()=>validateCloudConfig({...config,planId:'x&select=*'}),/ID/);
});
test('public viewer reads contain no owner authentication and reject redirection',async()=>{
 let call;
 const client=new CloudCalendar(config,async(url,options)=>{call={url,options};return reply([row()]);});
 assert.deepEqual(await client.load(),row());
 assert.equal(call.options.headers.apikey,config.key);assert.equal(call.options.headers.Authorization,undefined);
 assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');
 assert.equal(new URL(call.url).origin,config.url);assert.equal(new URL(call.url).searchParams.get('id'),'eq.'+config.planId);
});
test('writes require sign-in; refresh credentials are limited to the same project',async()=>{
 let requests=0;const client=new CloudCalendar(config,async()=>{requests++;return reply([]);});
 await assert.rejects(()=>client.save({},1),/Sign in/);assert.equal(requests,0);
 assert.throws(()=>client.restoreSession(session({project_url:'https://other.supabase.co'})),/different/);
});
test('owner saves use conditional revision and owner filters, preserving other browser changes',async()=>{
 const calls=[];
 const client=new CloudCalendar(config,async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/v1/user'))return reply({id:owner});return reply([]);});
 client.restoreSession(session());
 await assert.rejects(()=>client.save({notes:'my edit'},2),CloudConflictError);
 const patch=calls.find(c=>c.options.method==='PATCH');const url=new URL(patch.url);
 assert.equal(url.searchParams.get('revision'),'eq.2');assert.equal(url.searchParams.get('owner_id'),'eq.'+owner);
 assert.equal(patch.options.headers.Authorization,'Bearer owner-session');assert.equal(JSON.parse(patch.options.body).revision,3);
});
test('expired owner sign-in refreshes before saving and reports the updated session',async()=>{
 const calls=[];let notified;
 const client=new CloudCalendar(config,async(url,options)=>{calls.push({url,options});if(url.includes('grant_type=refresh_token'))return reply({access_token:'fresh-session',refresh_token:'fresh-refresh',expires_in:3600,user:{id:owner}});if(url.endsWith('/auth/v1/user'))return reply({id:owner});return reply([row(2)]);});
 client.restoreSession(session({expires_at:0}));client.onSession=s=>{notified=s;};
 assert.equal((await client.save({notes:'updated'},1)).revision,2);
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(JSON.parse(calls[0].options.body).refresh_token,'owner-refresh');
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer fresh-session');assert.equal(notified.project_url,config.url);
});
test('creating a plan verifies the owner with Supabase and then records only that identity',async()=>{
 const calls=[];const client=new CloudCalendar(config,async(url,options)=>{calls.push({url,options});if(url.includes('grant_type=password'))return reply({access_token:'login-session',refresh_token:'login-refresh',expires_in:3600,user:{id:'untrusted-claim'}});if(url.endsWith('/auth/v1/user'))return reply({id:owner});return reply([row()]);});
 await client.signIn('owner@example.com','example-test-password');await client.createPlan({visits:[]});
 assert.equal(JSON.parse(calls.at(-1).options.body).owner_id,owner);
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer login-session');
 await client.signOut();assert.equal(client.session,null);
});
test('forbidden edits and unavailable database are surfaced without clearing the local plan',async()=>{
 const denied=new CloudCalendar(config,async(url)=>url.endsWith('/auth/v1/user')?reply({id:owner}):reply({message:'denied'},403));denied.restoreSession(session());await assert.rejects(()=>denied.save({notes:'keep my work'},1),/cannot edit/);
 const offline=new CloudCalendar(config,async()=>{throw new Error('network unavailable');});await assert.rejects(()=>offline.load(),/connection/);
});
test('requests use the global fetch receiver required by browsers',async()=>{
 const client=new CloudCalendar(config,async function(){assert.equal(this,globalThis);return reply([row()]);});
 assert.equal((await client.load()).revision,1);
});
