import {CloudCalendar,CloudConflictError,validateCloudConfig} from './cloud.js';
import {validState} from './model.js';
const CONFIG='cuped-cloud-config',SESSION='cuped-cloud-session',LAST='cuped-cloud-last-state',BACKUP='cuped-before-cloud-reload';
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function setupSync({readOnly,getState,applyState,onStatus=()=>{}}){
 let client=null,revision=null,pending=null,busy=false,paused=false,disposed=false,saveTimer=null,refreshBusy=false;
 const statusNode=document.querySelector('#sync-status');
 const status=(text)=>{if(disposed)return;if(statusNode)statusNode.textContent=text;onStatus(text);};
 const setLast=(state)=>{if(!readOnly)write(LAST,{url:client.config.url,planId:client.config.planId,state});};
 const loaded=(row)=>{if(!validState(row.state))throw Error('The shared calendar data is invalid. Your local plan has not been changed.');return row;};
 const backup=()=>write(BACKUP,{savedAt:new Date().toISOString(),state:structuredClone(getState())});
 const persistClient=()=>{
  if(readOnly||!client)return;
  write(CONFIG,client.config);write(SESSION,client.session);
  client.onSession=(session)=>write(SESSION,session);
 };
 function accept(row){revision=row.revision;applyState(structuredClone(row.state));setLast(row.state);paused=false;pending=null;status(readOnly?'Live view · updates every 15 seconds':'Shared calendar saved · viewers update within 15 seconds');}
 async function refresh({replace=false}={}){
  if(!client?.config.planId||busy||refreshBusy||disposed)return;
  if(!replace&&(pending||paused))return;
  refreshBusy=true;
  try{
   const row=loaded(await client.load());
   if(readOnly){if(revision!==row.revision)accept(row);else status('Live view · updates every 15 seconds');return row;}
   const local=getState();const last=read(LAST);const clean=last?.url===client.config.url&&last?.planId===client.config.planId&&same(last.state,local);
   if(replace){backup();accept(row);}
   else if(same(local,row.state)||clean)accept(row);
   else{revision=row.revision;paused=true;pending=structuredClone(local);status('Local and shared plans differ. Open Live sync to reload the shared plan; your local changes are kept.');}
   return row;
  }catch(error){status('Could not load shared calendar · '+error.message);throw error;}finally{refreshBusy=false;}
 }
 async function flush(){
  clearTimeout(saveTimer);
  if(busy||paused||!pending||!client?.config.planId)return;
  if(!client.session){status('Changes saved on this device · sign in through Live sync to update viewers.');return;}
  busy=true;let failed=false;const snapshot=pending;pending=null;status('Saving shared calendar…');
  try{const row=loaded(await client.save(snapshot,revision));revision=row.revision;setLast(snapshot);status(pending?'Saving newer changes…':'Shared calendar saved · viewers update within 15 seconds');}
  catch(error){failed=true;if(!pending)pending=snapshot;paused=error instanceof CloudConflictError;status(paused?'Shared plan changed elsewhere. Your local edits are kept; export a backup and reload through Live sync.':'Not synced · your edits are saved on this device. '+error.message);}
  finally{busy=false;if(pending&&!failed&&!paused&&client?.session)saveTimer=setTimeout(()=>flush(),3000);}
 }
 function queueSave(state){
  if(readOnly)return;
  if(!client?.config.planId){status('Saved on this device · connect Live sync to update viewers automatically.');return;}
  pending=structuredClone(state);clearTimeout(saveTimer);
  if(paused){status('Local edits kept · resolve the shared-calendar conflict in Live sync.');return;}
  status(client.session?'Changes saved locally · syncing…':'Saved on this device · sign in through Live sync to update viewers.');
  saveTimer=setTimeout(()=>flush(),600);
 }
 let viewerRequested=false;
 const linkParams=new URLSearchParams(location.hash.slice(1));
 let defaultConfig=null;
 const localConfig=readOnly?null:read(CONFIG);
 if(!linkParams.has('live')&&!linkParams.has('packed')&&!linkParams.has('plan')&&!localConfig){
  try{const response=await fetch('./sync-config.json',{cache:'no-store',credentials:'omit',redirect:'error'});if(response.ok){const candidate=await response.json();if(candidate?.url&&candidate?.key&&candidate?.planId)defaultConfig=validateCloudConfig(candidate);}}catch{}
 }
 if(readOnly){
  const raw=linkParams.get('live');viewerRequested=!!raw||!!defaultConfig;
  if(raw){try{client=new CloudCalendar(validateCloudConfig(JSON.parse(raw)));}catch(error){status('Invalid live calendar link · '+error.message);}}
  else if(defaultConfig)client=new CloudCalendar(defaultConfig);
 }else{
  const config=localConfig||defaultConfig;
  if(config)try{client=new CloudCalendar(config);const session=read(SESSION);if(session)try{client.restoreSession(session);}catch{write(SESSION,null);}persistClient();}catch{status('Live sync needs setup. Your local calendar is still available.');}
 }
 const dialog=document.createElement('dialog');dialog.id='sync-dialog';
 dialog.innerHTML=`<h2>Connect your live calendar</h2><p>Once connected, your edits save automatically and the view-only link refreshes within 15 seconds. Only your signed-in owner account can change the shared plan.</p>
 <details><summary>First-time setup · follow these steps</summary><ol><li>At <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">Supabase</a>, create a free project. Keep its database password private.</li><li>Open your project's <strong>SQL Editor</strong>. Open <a href="supabase-setup.sql" target="_blank" rel="noopener">the setup SQL</a>, copy it into a new query, and click <strong>Run</strong>.</li><li>Under <strong>Authentication → Users → Add user</strong>, create your owner account with your email and a password. Confirm the user. These are the credentials you use below, separate from the database password. Disable public sign-ups in Authentication settings if you do not need them.</li><li>Find the <strong>Project URL</strong> and <strong>publishable key</strong> in your project's Connect dialog or API settings. Enter those public settings below. Never use a secret key or service-role key.</li><li>Leave Calendar ID blank to share this device's plan for the first time. Sign in and connect, then use <strong>Share view-only link</strong> in the planner.</li></ol><p>For a new domain, connect the same project and Calendar ID there. Your shared calendar does not depend on the GitHub address.</p></details>
 <form id="cloud-form"><label>Supabase Project URL<input name="url" type="url" required placeholder="https://your-project.supabase.co" autocomplete="url"></label><label>Public publishable / anon key<input name="key" required placeholder="sb_publishable_…" autocomplete="off"></label><label>Calendar ID <small>Blank for a new calendar; use an existing ID to connect another device or domain.</small><input name="planId" placeholder="Leave blank the first time" autocomplete="off"></label><div class="form-grid"><label>Owner email<input name="email" type="email" required autocomplete="username"></label><label>Owner password<input name="password" type="password" required autocomplete="current-password"></label></div><p id="cloud-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cloud-close" class="quiet">Close</button><button type="submit" class="primary">Sign in & connect</button></div></form>
 <div class="dialog-actions"><button id="cloud-retry" class="secondary" type="button">Retry saving</button><button id="cloud-reload" class="secondary" type="button">Reload shared plan</button><button id="cloud-signout" class="quiet" type="button">Sign out</button></div><p id="cloud-connection" class="notice"></p><p>Before reloading, your current device plan is backed up locally. You can also use Export backup in the planner. Do not include student IDs, phone numbers, or private notes in a public shared schedule.</p>`;
 if(!readOnly){document.body.append(dialog);const form=dialog.querySelector('form'),error=dialog.querySelector('#cloud-error');
  const show=()=>{error.textContent='';if(client){for(const name of ['url','key','planId'])form.elements[name].value=client.config[name]||'';form.elements.email.value=client.session?.user?.email||'';}dialog.querySelector('#cloud-connection').textContent=client?.config.planId?'Connected calendar ID: '+client.config.planId:'Not connected yet. Your current plan stays on this device.';dialog.showModal();};
  document.querySelector('#sync-settings')?.addEventListener('click',show);
  dialog.querySelector('#cloud-close').onclick=()=>{form.elements.password.value='';dialog.close();};
  form.onsubmit=async e=>{
   e.preventDefault();error.textContent='';const submit=form.querySelector('[type=submit]');submit.disabled=true;const oldClient=client;
   try{
    const config=validateCloudConfig({url:form.elements.url.value.trim(),key:form.elements.key.value.trim(),planId:form.elements.planId.value.trim()||null});
    const next=new CloudCalendar(config);await next.signIn(form.elements.email.value.trim(),form.elements.password.value);
    let row;
    if(config.planId){row=loaded(await next.load());const user=await next.getUser();if(row.owner_id!==user.id)throw Error('This user is not the calendar owner. Choose the account that created it.');
     if(!same(getState(),row.state)&&!confirm('Connect to this shared calendar? Your current device plan will be backed up, then replaced with the shared plan.'))return;
     backup();
    }else{
     if(!confirm('Create a public view-only calendar from your current plan? Anyone with its link can view it. Only your owner sign-in can save changes.'))return;
     row=loaded(await next.createPlan(structuredClone(getState())));
    }
    client=next;persistClient();accept(row);form.elements.planId.value=client.config.planId;dialog.close();
   }catch(err){client=oldClient;error.textContent=err.message;}
   finally{form.elements.password.value='';submit.disabled=false;}
  };
  dialog.querySelector('#cloud-retry').onclick=async()=>{error.textContent='';if(paused){error.textContent='Reload the shared plan before saving again. Export your current plan first to keep a separate copy.';return;}await flush();};
  dialog.querySelector('#cloud-reload').onclick=async()=>{error.textContent='';if(!client?.config.planId){error.textContent='Connect a shared calendar first.';return;}if(!confirm('Load the shared plan and replace this device view? Your current plan will be backed up locally. Export first if you also want a file copy.'))return;try{await refresh({replace:true});dialog.close();}catch(err){error.textContent=err.message;}};
  dialog.querySelector('#cloud-signout').onclick=async()=>{error.textContent='';try{await client?.signOut();status('Signed out · new edits stay on this device until you sign in again.');}catch(err){error.textContent=err.message;}finally{write(SESSION,null);}};
 }
 if(client?.config.planId){status('Loading shared calendar…');refresh().catch(()=>{});}else if(viewerRequested)status('The live-calendar link could not be opened. Ask Valerie for a new link.');else status(readOnly?'View-only snapshot · does not update automatically':'Saved on this device · connect Live sync to update viewers automatically.');
 const interval=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);
 const focus=()=>{if(!document.hidden)refresh().catch(()=>{});};document.addEventListener('visibilitychange',focus);window.addEventListener('focus',focus);
 return {
  queueSave,flush,refresh,
  getLiveConfig(){return client?.config.planId&&revision!==null&&!pending&&!busy&&!paused?{...client.config}:null;},
  destroy(){disposed=true;clearInterval(interval);clearTimeout(saveTimer);dialog.remove();document.removeEventListener('visibilitychange',focus);window.removeEventListener('focus',focus);}
 };
}
