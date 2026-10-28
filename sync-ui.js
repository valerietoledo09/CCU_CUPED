import {CloudCalendar,CloudConflictError,validateCloudConfig} from './cloud.js?v=15';
import {validState} from './model.js?v=15';
import {mergePlanStates} from './sync-state.js?v=15';
import {createSyncJournal} from './sync-journal.js?v=15';
const CONFIG='cuped-cloud-config',SESSION='cuped-cloud-session',LAST='cuped-cloud-last-state',BACKUP='cuped-before-cloud-reload';
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function setupSync({readOnly,ownerClient=null,getState,applyState,hasLocalPlan=true,localSavedAt=0,writerId=null,localWriterId=null,onStatus=()=>{}}){
 const ownerMode=!readOnly&&!!ownerClient;
 const ownerConfig=ownerMode?validateCloudConfig(ownerClient.config):null;
 const verifiedOwnerId=ownerMode?ownerClient.session?.user?.id:null;
 let client=null,revision=null,pending=null,busy=false,paused=false,disposed=false,saveTimer=null,refreshBusy=false;
 let conflictRemote=null,baseState=null,operation=null,journal=null,drafts=[],conflicts=[],retryDelay=1000;
 let editGeneration=0,initialLoad=true,journalError='',journalWrites=Promise.resolve();
 const tabId=writerId||crypto.randomUUID();
 const statusNode=document.querySelector('#sync-status');
 const status=(text)=>{if(disposed)return;if(journalError)text+=' · '+journalError;if(statusNode)statusNode.textContent=text;onStatus(text);};
 const savedStatus=()=>status(readOnly?'Live view · updates every 15 seconds':'Shared calendar saved · viewers update within 15 seconds');
 const setLast=(state)=>{if(!readOnly&&!disposed)write(LAST,{url:client.config.url,planId:client.config.planId,revision,state});};
 const loaded=(row)=>{if(!validState(row.state))throw Error('The shared calendar data is invalid. Your local plan has not been changed.');return row;};
 const backup=()=>{if(disposed)return;try{localStorage.setItem(BACKUP,JSON.stringify({savedAt:new Date().toISOString(),state:structuredClone(getState())}));}catch{throw Error('Browser storage is full, so this plan could not be backed up. Export a backup file before replacing it. Your current plan has been kept.');}};
 const persistClient=()=>{
  if(readOnly||!client||disposed)return;
  const activeClient=client;
  write(CONFIG,client.config);write(SESSION,client.session);
  client.onSession=(session)=>{if(!disposed&&client===activeClient)write(SESSION,session);};
 };
 const persistPending=()=>{
  if(!journal||!pending||disposed)return;
  const record={id:tabId,token:crypto.randomUUID(),baseState:structuredClone(baseState),baseRevision:revision,state:structuredClone(pending),updatedAt:Date.now(),conflicts:[...conflicts]};
  drafts=drafts.filter(d=>d.id!==tabId);drafts.push(record);
  const activeJournal=journal;
  journalWrites=journalWrites.catch(()=>{}).then(()=>activeJournal.put(record)).then(()=>{journalError='';}).catch(()=>{journalError='Recovery storage unavailable; export a backup before closing.';status('Changes are not confirmed in recovery storage');});
 };
 const clearDrafts=async records=>{
  const activeJournal=journal;
  await journalWrites;
  for(const record of records)try{await activeJournal?.remove(record.id,record.token);}catch{journalError='Could not clear a recovery copy; keep a backup.';}
  drafts=drafts.filter(d=>!records.some(r=>r.id===d.id&&r.token===d.token));
 };
 function scheduleSave(delay=600){clearTimeout(saveTimer);if(!disposed&&!paused&&pending)saveTimer=setTimeout(()=>flush(),delay);}
 function showConflicts(){
  const panel=document.querySelector('#cloud-conflict');
  if(panel)panel.hidden=!paused;
  const detail=document.querySelector('#cloud-conflict-details');
  if(detail)detail.textContent=conflicts.length?'Both versions changed: '+conflicts.join(', '):'';
 }
 function accept(row){
  if(disposed||revision!==null&&row.revision<revision)return;
  revision=row.revision;baseState=structuredClone(row.state);applyState(structuredClone(row.state));setLast(row.state);paused=false;pending=null;conflicts=[];initialLoad=false;showConflicts();savedStatus();
 }
 function reconcile(row){
  if(revision!==null&&row.revision<revision)return;
  let local=getState(),ancestor=baseState,authoritativeDraft=null;
  if(initialLoad&&!editGeneration){
   const newest=drafts.filter(d=>d.id!==localWriterId||d.updatedAt>=localSavedAt).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
   if(newest&&(!hasLocalPlan||newest.updatedAt>=localSavedAt)){local=structuredClone(newest.state);ancestor=newest.baseState;authoritativeDraft=newest;}
  }
  let result=initialLoad&&!hasLocalPlan&&!editGeneration&&!authoritativeDraft?{state:structuredClone(row.state),conflicts:[]}:mergePlanStates(ancestor,local,row.state);
  for(const draft of drafts){
   // This tab's main saved plan is newer than its last queued recovery write.
   if(draft===authoritativeDraft||draft.id===tabId&&editGeneration>0||draft.id===localWriterId&&hasLocalPlan&&localSavedAt>draft.updatedAt){result.conflicts.push(...(draft.conflicts||[]));continue;}
   const recovered=mergePlanStates(draft.baseState,result.state,draft.state);
   result={state:recovered.state,conflicts:[...result.conflicts,...recovered.conflicts,...(draft.conflicts||[])]};
  }
  revision=row.revision;initialLoad=false;
  if(!result.conflicts.length){baseState=structuredClone(row.state);setLast(row.state);conflictRemote=null;}else conflictRemote=structuredClone(row);
  if(!same(getState(),result.state))applyState(structuredClone(result.state));
  conflicts=[...new Set(result.conflicts)];paused=conflicts.length>0;
  if(same(result.state,row.state)&&!paused){pending=null;clearDrafts([...drafts]);showConflicts();savedStatus();}
  else{
   pending=structuredClone(result.state);persistPending();showConflicts();
   if(paused)status('Two versions changed the same detail. Your edits are kept. Open Live sync to review.');
   else{status('Recovered changes kept on this device · syncing…');scheduleSave(0);}
  }
 }
 async function refresh({replace=false}={}){
  if(disposed||!client?.config.planId)return;
  if(operation){await operation;if(replace&&!disposed)return refresh({replace:true});return;}
  if(paused&&!replace)return;
  refreshBusy=true;const activeClient=client,readGeneration=editGeneration;
  const run=(async()=>{
   try{
    const received=!replace&&!initialLoad&&revision!==null&&typeof activeClient.loadIfChanged==='function'?await activeClient.loadIfChanged(revision):await activeClient.load();
    if(disposed||client!==activeClient)return;
    if(!received){if(pending)scheduleSave(0);else savedStatus();return;}
    const row=loaded(received);
    if(revision!==null&&row.revision<revision)return;
    if(readOnly){if(revision!==row.revision)accept(row);else savedStatus();return row;}
    if(row.owner_id!==verifiedOwnerId&&ownerMode)throw Error('This is not your editable calendar.');
    if(replace){if(editGeneration!==readGeneration)throw Error('New edits were added while loading. Your current work was kept; review it before choosing a version.');backup();const oldDrafts=[...drafts];accept(row);await clearDrafts(oldDrafts);}
    else reconcile(row);
    return row;
   }catch(error){if(!disposed){status('Could not load shared calendar · '+error.message);if(pending)scheduleSave(retryDelay);retryDelay=Math.min(retryDelay*2,15000);}throw error;}
  })();
  operation=run;
  try{return await run;}finally{if(operation===run)operation=null;refreshBusy=false;}
 }
 async function flush(){
  clearTimeout(saveTimer);
  while(operation)await operation.catch(()=>{});
  if(disposed||paused||!pending||!client?.config.planId)return;
  if(!client.session){status('Changes kept on this device · sign in again to update viewers.');return;}
  if(revision===null){try{await refresh();}catch{}if(revision===null||paused)return;return flush();}
  busy=true;const activeClient=client,snapshot=structuredClone(pending),generation=editGeneration,savedDrafts=[...drafts];
  status('Saving shared calendar…');
  const run=(async()=>{
   try{
    await journalWrites;
    const row=loaded(await activeClient.save(snapshot,revision));
    if(disposed||client!==activeClient)return;
    revision=row.revision;baseState=structuredClone(snapshot);setLast(snapshot);retryDelay=1000;
    if(editGeneration===generation&&same(getState(),snapshot)){pending=null;await clearDrafts(savedDrafts);if(pending){status('Saving newer changes…');scheduleSave(0);}else savedStatus();}
    else{pending=structuredClone(getState());persistPending();status('Saving newer changes…');scheduleSave(0);}
   }catch(error){
    if(disposed||client!==activeClient)return;
    pending=structuredClone(getState());persistPending();
    if(error instanceof CloudConflictError){revision=null;status('Another device saved changes · combining both versions…');scheduleSave(0);}
    else{status('Not synced yet · your edits are kept on this device and will retry. '+error.message);scheduleSave(retryDelay);retryDelay=Math.min(retryDelay*2,15000);}
   }
  })();
  operation=run;
  try{await run;}finally{if(operation===run)operation=null;busy=false;}
 }
 function queueSave(state){
  if(readOnly||disposed)return;
  editGeneration++;pending=structuredClone(state);persistPending();
  if(!client?.config.planId){status('Saved on this device · connect Live sync to update viewers automatically.');return;}
  if(paused){status('Your edits are kept · open Live sync to resolve changes to the same detail.');return;}
  status('Changes kept on this device · syncing…');scheduleSave();
 }
 let viewerRequested=false;
 const linkParams=new URLSearchParams(location.hash.slice(1));
 let defaultConfig=null;
 const localConfig=readOnly?null:read(CONFIG);
 let deployment=null;
 if(!linkParams.has('packed')&&!linkParams.has('plan')){
  try{const response=await fetch('./sync-config.json',{cache:'no-store',credentials:'omit',redirect:'error'});if(response.ok){const candidate=await response.json();if(candidate?.url&&candidate?.key&&candidate?.planId){defaultConfig=validateCloudConfig(candidate);deployment=candidate;}}}catch{}
 }
 const useCurrentCalendar=config=>{
  if(defaultConfig&&config?.url===defaultConfig.url&&deployment?.legacyPlanIds?.includes(config.planId))return {...defaultConfig};
  return config;
 };
 if(readOnly){
  const raw=linkParams.get('live');viewerRequested=!!raw||!!defaultConfig;
  if(raw){try{client=new CloudCalendar(useCurrentCalendar(validateCloudConfig(JSON.parse(raw))));}catch(error){status('Invalid live calendar link · '+error.message);}}
  else if(defaultConfig)client=new CloudCalendar(defaultConfig);
 }else if(ownerMode){
  client=ownerClient;
  if(localConfig?.url===ownerConfig.url&&localConfig?.key===ownerConfig.key)try{client.config.planId=useCurrentCalendar(validateCloudConfig(localConfig)).planId;}catch{}
  if(!client.config.planId&&defaultConfig?.url===ownerConfig.url)client.config.planId=defaultConfig.planId;
  persistClient();
 }else{
  const config=localConfig||defaultConfig;
  if(config)try{client=new CloudCalendar(config);const session=read(SESSION);if(session)try{client.restoreSession(session);}catch{write(SESSION,null);}persistClient();}catch{status('Live sync needs setup. Your local calendar is still available.');}
 }
 if(!readOnly&&client?.config.planId){
  const last=read(LAST);
  if(last?.url===client.config.url&&(last.planId===client.config.planId||deployment?.legacyPlanIds?.includes(last.planId))&&validState(last.state)){
   baseState=structuredClone(last.state);
   if(last.planId===client.config.planId&&Number.isInteger(last.revision))revision=last.revision;
  }
  journal=createSyncJournal(client.config);
  try{drafts=(await journal.list()).filter(d=>validState(d.state)&&(!d.baseState||validState(d.baseState)));}catch{journalError='Recovery storage unavailable; export a backup before closing.';}
 }
 let showSettings=null;
 const dialog=document.createElement('dialog');dialog.id='sync-dialog';
 dialog.innerHTML=`<h2>Connect your live calendar</h2><p>Once connected, your edits save automatically and the view-only link refreshes within 15 seconds. Only your signed-in owner account can change the shared plan.</p>
 <details><summary>First-time setup · follow these steps</summary><ol><li>At <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">Supabase</a>, create a free project. Keep its database password private.</li><li>Open your project's <strong>SQL Editor</strong>. Open <a href="supabase-setup.sql" target="_blank" rel="noopener">the setup SQL</a>, copy it into a new query, and click <strong>Run</strong>.</li><li>Under <strong>Authentication → Users → Add user</strong>, create your owner account with your email and a password. Confirm the user. These are the credentials you use below, separate from the database password. Disable public sign-ups in Authentication settings if you do not need them.</li><li>Find the <strong>Project URL</strong> and <strong>publishable key</strong> in your project's Connect dialog or API settings. Enter those public settings below. Never use a secret key or service-role key.</li><li>Leave Calendar ID blank to share this device's plan for the first time. Sign in and connect, then use <strong>Share view-only link</strong> in the planner.</li></ol><p>For a new domain, connect the same project and Calendar ID there. Your shared calendar does not depend on the GitHub address.</p></details>
 <form id="cloud-form"><label>Supabase Project URL<input name="url" type="url" required placeholder="https://your-project.supabase.co" autocomplete="url"></label><label>Public publishable / anon key<input name="key" required placeholder="sb_publishable_…" autocomplete="off"></label><label>Calendar ID <small>Blank for a new calendar; use an existing ID to connect another device or domain.</small><input name="planId" placeholder="Leave blank the first time" autocomplete="off"></label><div class="form-grid"><label>Owner email<input name="email" type="email" required autocomplete="username"></label><label>Owner password<input name="password" type="password" required autocomplete="current-password"></label></div><p id="cloud-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cloud-close" class="quiet">Close</button><button type="submit" class="primary">Sign in & connect</button></div></form>
 <section id="cloud-conflict" class="notice" hidden><h3>Choose which edits to keep</h3><p>Your work has been kept. Changes to different tasks combine automatically. These details were changed in both versions:</p><p id="cloud-conflict-details"></p><button id="cloud-keep-local" class="primary" type="button">Keep my edits for these details</button><p>Use Export backup to keep a file before choosing. Use shared version below only if you want to discard these local edits.</p></section>
 <div class="dialog-actions"><button id="cloud-retry" class="secondary" type="button">Retry saving</button><button id="cloud-reload" class="secondary" type="button">Use shared version…</button><button id="cloud-signout" class="quiet" type="button">Sign out</button></div><p id="cloud-connection" class="notice"></p><p>Unsent changes have a recovery copy on this device. Choosing the shared version replaces your unsent edits after confirmation. You can also use Export backup in the planner. Do not include student IDs, phone numbers, or private notes in a public shared schedule.</p>`;
 if(!readOnly){document.body.append(dialog);const form=dialog.querySelector('form'),error=dialog.querySelector('#cloud-error');
  const show=()=>{if(disposed)return;error.textContent='';form.elements.password.required=!client?.session;form.querySelector('[type=submit]').textContent=client?.session?'Connect calendar':'Sign in & connect';if(ownerMode){form.elements.url.readOnly=true;form.elements.key.readOnly=true;for(const name of ['email','password']){form.elements[name].required=false;form.elements[name].closest('label').hidden=true;}form.querySelector('[type=submit]').textContent='Connect calendar';}if(client){for(const name of ['url','key','planId'])form.elements[name].value=client.config[name]||'';form.elements.email.value=client.session?.user?.email||'';}dialog.querySelector('#cloud-connection').textContent=client?.config.planId?'Connected calendar ID: '+client.config.planId:'Not connected yet. Your current plan stays on this device.';showConflicts();dialog.showModal();};
  showSettings=show;document.querySelector('#sync-settings')?.addEventListener('click',showSettings);
  dialog.querySelector('#cloud-close').onclick=()=>{form.elements.password.value='';dialog.close();};
  form.onsubmit=async e=>{
   e.preventDefault();if(disposed)return;error.textContent='';const submit=form.querySelector('[type=submit]');submit.disabled=true;const oldClient=client;const originalPlanId=client?.config.planId;const wasPaused=paused,connectGeneration=editGeneration;let connected=false;
   if(busy||refreshBusy){error.textContent='Wait for the current calendar request to finish, then connect.';submit.disabled=false;return;}
   paused=true;clearTimeout(saveTimer);
   try{
    const config=validateCloudConfig({url:form.elements.url.value.trim(),key:form.elements.key.value.trim(),planId:form.elements.planId.value.trim()||null});
    let next;const password=form.elements.password.value;const storedSession=read(SESSION);
    if(ownerMode){
     if(config.url!==ownerConfig.url||config.key!==ownerConfig.key)throw Error('Use the project already verified by your owner sign-in.');
     next=ownerClient;const user=await next.getUser();if(disposed)return;
     if(!verifiedOwnerId||user.id!==verifiedOwnerId)throw Error('Your owner sign-in changed. Sign out and sign in again.');
     next.config.planId=config.planId;
    }else{
     next=new CloudCalendar(config);
     if(!password&&storedSession?.project_url===config.url){next.restoreSession(storedSession);await next.getUser();}
     else{if(!password)throw Error('Sign in with your owner password for this project.');await next.signIn(form.elements.email.value.trim(),password);}
    }
    if(disposed)return;
    let row,createdState=null;
    if(config.planId===originalPlanId&&config.planId){
     client=next;paused=wasPaused;await refresh();connected=true;dialog.close();return;
    }
    if(config.planId){row=loaded(await next.load());if(disposed)return;const user=await next.getUser();if(disposed)return;if(row.owner_id!==user.id)throw Error('This user is not the calendar owner. Choose the account that created it.');
     if(!same(getState(),row.state)&&!confirm('Connect to this shared calendar? Your current device plan will be backed up, then replaced with the shared plan.'))return;
     if(editGeneration!==connectGeneration)throw Error('Your plan changed while connecting. Your edits were kept. Try connecting again.');
     backup();
    }else{
     if(!confirm('Create a public view-only calendar from your current plan? Anyone with its link can view it. Only your owner sign-in can save changes.'))return;
     createdState=structuredClone(getState());row=loaded(await next.createPlan(createdState));if(disposed)return;
    }
    if(disposed)return;client=next;persistClient();journal=createSyncJournal(client.config);const previousDrafts=[...drafts];if(createdState&&editGeneration!==connectGeneration){revision=row.revision;baseState=createdState;pending=structuredClone(getState());paused=false;persistPending();scheduleSave(0);}else{revision=null;accept(row);await clearDrafts(previousDrafts);}connected=true;form.elements.planId.value=client.config.planId;dialog.close();
   }catch(err){if(!disposed){client=oldClient;error.textContent=err.message;}}
   finally{if(!connected&&!disposed){if(ownerMode)ownerClient.config.planId=originalPlanId;paused=wasPaused;}form.elements.password.value='';submit.disabled=false;}
  };
  dialog.querySelector('#cloud-retry').onclick=async()=>{if(disposed)return;error.textContent='';if(paused){error.textContent='Choose which conflicting edits to keep below. Your work is still on this device.';return;}await flush();};
  dialog.querySelector('#cloud-reload').onclick=async()=>{if(disposed)return;error.textContent='';if(!client?.config.planId){error.textContent='Connect a shared calendar first.';return;}if(!confirm('Use the shared version instead of this device’s unsent edits? This discards those local edits from the calendar. Export a backup first if you want a file copy.'))return;try{await refresh({replace:true});if(!disposed)dialog.close();}catch(err){if(!disposed)error.textContent=err.message;}};
  dialog.querySelector('#cloud-keep-local').onclick=async()=>{if(disposed||!paused)return;if(!confirm('Keep your version of the conflicting details? Other shared changes will be preserved.'))return;paused=false;conflicts=[];if(conflictRemote){baseState=structuredClone(conflictRemote.state);revision=conflictRemote.revision;setLast(baseState);conflictRemote=null;}showConflicts();pending=structuredClone(getState());editGeneration++;persistPending();await flush();if(!paused&&!pending&&!disposed)dialog.close();};
  dialog.querySelector('#cloud-signout').onclick=async()=>{if(disposed)return;error.textContent='';const signingOutClient=client;write(SESSION,null);window.dispatchEvent(new CustomEvent('owner-session-signed-out'));try{if(!ownerMode)await signingOutClient?.signOut();status('Signed out · sign in again to edit the shared calendar.');}catch(err){if(!disposed)error.textContent=err.message;}};
 }
 if(client?.config.planId){status('Loading shared calendar…');refresh().catch(()=>{});}else if(viewerRequested)status('The live-calendar link could not be opened. Ask Valerie for a new link.');else status(readOnly?'View-only snapshot · does not update automatically':'Saved on this device · connect Live sync to update viewers automatically.');
 const retry=()=>{if(disposed||document.hidden)return;if(pending&&!paused)flush();else refresh().catch(()=>{});};
 const interval=setInterval(retry,15000);
 const focus=retry;
 const leave=event=>{if(!readOnly&&(pending||busy||paused)){event.preventDefault();event.returnValue='';}};
 const pagehide=()=>{if(pending)persistPending();};
 document.addEventListener('visibilitychange',focus);window.addEventListener('focus',focus);window.addEventListener('online',retry);
 if(!readOnly){window.addEventListener('beforeunload',leave);window.addEventListener('pagehide',pagehide);}
 return {
  queueSave,flush,refresh,
  getLiveConfig(){return !disposed&&client?.config.planId?{...client.config}:null;},
  isSaved(){return !pending&&!busy&&!paused&&revision!==null;},
  destroy(){disposed=true;clearInterval(interval);clearTimeout(saveTimer);if(client)client.onSession=null;if(showSettings)document.querySelector('#sync-settings')?.removeEventListener('click',showSettings);dialog.remove();document.removeEventListener('visibilitychange',focus);window.removeEventListener('focus',focus);window.removeEventListener('online',retry);window.removeEventListener('beforeunload',leave);window.removeEventListener('pagehide',pagehide);}
 };
}
