import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudCalendar} from '../cloud.js';
import {OWNER_PROJECT_URL,OWNER_USER_ID,validateAuthConfig,verifyOwner,authenticateOwner,ownerAuthError,requireOwnerAccess} from '../owner-auth.js';
const key='sb_publishable_public_connection_key_example';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function session(userId=OWNER_USER_ID){return {access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,project_url:OWNER_PROJECT_URL,user:{id:userId}};}

test('auth setup pins the project and owner while permitting a missing public key during setup',()=>{
 assert.deepEqual(validateAuthConfig({url:OWNER_PROJECT_URL,ownerId:OWNER_USER_ID,key:''}),{url:OWNER_PROJECT_URL,ownerId:OWNER_USER_ID,key:''});
 assert.equal(validateAuthConfig({url:OWNER_PROJECT_URL,ownerId:OWNER_USER_ID,key}).key,key);
 for(const config of [{url:'https://other.supabase.co',ownerId:OWNER_USER_ID,key},{url:OWNER_PROJECT_URL,ownerId:'attacker',key},{url:OWNER_PROJECT_URL,ownerId:OWNER_USER_ID,key:'sb_secret_never_in_browser'}])assert.throws(()=>validateAuthConfig(config));
});
test('owner access trusts server verification rather than the user claim saved in a session',async()=>{
 let signedOut=false;
 const client=new CloudCalendar({url:OWNER_PROJECT_URL,key},async(url)=>url.endsWith('/auth/v1/user')?reply({id:'different-valid-user'}):reply({}));
 client.restoreSession(session());
 const original=client.signOut.bind(client);client.signOut=async()=>{signedOut=true;await original();};
 await assert.rejects(()=>verifyOwner(client),/not authorized/);
 assert.equal(signedOut,true);assert.equal(client.session,null);
});
test('a verified canonical owner can sign in with the real password flow',async()=>{
 const calls=[];
 const client=new CloudCalendar({url:OWNER_PROJECT_URL,key},async(url,options)=>{
  calls.push({url,options});
  if(url.includes('grant_type=password'))return reply({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'do-not-trust-claims'}});
  return reply({id:OWNER_USER_ID,email:'owner@example.com'});
 });
 const user=await authenticateOwner(client,' owner@example.com ','fixture-password');
 assert.equal(user.id,OWNER_USER_ID);
 assert.equal(JSON.parse(calls[0].options.body).email,'owner@example.com');
 assert.ok(calls.filter(call=>call.url.endsWith('/auth/v1/user')).length>=1);
});
test('bad password and network failure never produce an authorized owner',async()=>{
 const denied=new CloudCalendar({url:OWNER_PROJECT_URL,key},async()=>reply({error_description:'Invalid login credentials'},400));
 await assert.rejects(()=>authenticateOwner(denied,'owner@example.com','wrong-fixture-password'),/Invalid login credentials/);
 const offline=new CloudCalendar({url:OWNER_PROJECT_URL,key},async()=>{throw Error('offline');});offline.restoreSession(session());
 await assert.rejects(()=>verifyOwner(offline),/connection/);
});
test('public view-only access skips the owner login without browser storage or DOM access',async()=>{
 assert.equal(await requireOwnerAccess({readOnly:true}),null);
});
test('login messages distinguish public-key setup, unconfirmed account, and invalid password',()=>{
 assert.match(ownerAuthError(Error('Use the public publishable or anon key.')),/complete public publishable/);
 assert.match(ownerAuthError(Error('Email not confirmed')),/Confirm the owner user/);
 assert.match(ownerAuthError(Error('Invalid login credentials')),/email or password did not match/);
 assert.match(ownerAuthError(Error('Could not reach shared calendar')),/planner stays locked/);
});

test('previously configured account cannot open the planner after owner correction',async()=>{
 const oldOwner='65d59e40-fcd4-477b-aa11-32810222f345';
 const client=new CloudCalendar({url:OWNER_PROJECT_URL,key},async(url)=>url.includes('/logout')?reply({}):reply({id:oldOwner}));
 client.restoreSession(session(oldOwner));
 await assert.rejects(()=>verifyOwner(client),/not authorized/);
 assert.equal(client.session,null);
});
