import {publicWebsiteData,publicSettingsCache,applyWebsiteSettings,websiteDefaults,cacheWebsiteData} from './website-settings.js?v=44';
import {validateCloudConfig} from './cloud.js?v=15';
export async function loadSchoolDirectory(){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const configResponse=await fetch('sync-config.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!configResponse.ok)throw Error('School directory setup is unavailable.');
  const config=validateCloudConfig(await configResponse.json());
  const url=new URL(config.url+'/rest/v1/plans');
  url.searchParams.set('id','eq.'+config.planId);
  // Read public school/branding metadata only, never the calendar's student records.
  url.searchParams.set('select','siteSettings:state->siteSettings,schoolDirectory:state->schoolDirectory');
  const response=await fetch(url.href,{headers:{apikey:config.key},credentials:'omit',cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('School links could not be loaded.');
  const rows=await response.json();if(!Array.isArray(rows)||!rows[0])throw Error('School links were not found.');
  const result=publicWebsiteData(rows[0]);cacheWebsiteData(result);return result;
 }finally{clearTimeout(timeout);}
}
export function requireSchoolSelection(){
 const hash=new URLSearchParams(location.hash.slice(1));
 // Direct live/snapshot links already identify the destination calendar.
 if(hash.has('live')||hash.has('plan')||hash.has('packed'))return Promise.resolve({id:'coral-reef',name:websiteDefaults.schoolName});
 let data=publicWebsiteData();try{const cached=JSON.parse(localStorage.getItem(publicSettingsCache));if(cached)data=publicWebsiteData(cached);}catch{}
 document.querySelector('#auth-loading')?.setAttribute('hidden','');
 const shell=document.querySelector('#planner-shell');if(shell){shell.hidden=true;shell.inert=true;}
 const screen=document.createElement('section');screen.className='signin-screen school-portal';screen.id='school-portal';
 screen.innerHTML='<a class="secondary owner-login intern-owner-login" href="index.html?owner=1">Owner login</a><div class="signin-card"><img class="portal-logo" src="assets/cuped-logo.png" alt="CUPED"><p class="eyebrow">CUPED · SCHOOL DIRECTORY</p><h1 id="portal-heading">Choose your CUPED school</h1><p>Select your school to open its intern website.</p><form><label>Your school<select name="school" required></select></label><button class="primary" type="submit">Continue to school</button></form><p id="portal-status" role="status">Loading school links…</p><p><small>Coral Reef opens its access-code screen next. Other school links open that school’s website.</small></p></div>';
 document.body.append(screen);
 const form=screen.querySelector('form'),status=screen.querySelector('#portal-status');
 function render(){
  const current=form.elements.school.value;
  form.elements.school.replaceChildren();
  for(const school of data.schoolDirectory){const option=document.createElement('option');option.value=school.id;option.textContent=school.name;form.elements.school.append(option);}
  if(data.schoolDirectory.some(s=>s.id===current))form.elements.school.value=current;
  screen.querySelector('#portal-heading').textContent=data.siteSettings.portalTitle;
  applyWebsiteSettings(data);
 }
 render();
 loadSchoolDirectory().then(result=>{if(!screen.isConnected)return;data=result;render();status.textContent='Choose your school to continue.';}).catch(()=>{if(screen.isConnected)status.textContent='Showing available school links. Additional links could not load; you can still open Coral Reef.';});
 return new Promise(resolve=>{
  form.onsubmit=event=>{
   event.preventDefault();const school=data.schoolDirectory.find(s=>s.id===form.elements.school.value);if(!school)return;
   if(school.current){screen.remove();resolve({id:school.id,name:school.name,siteSettings:data.siteSettings});}
   else{status.textContent='Opening '+school.name+'…';location.assign(school.url);}
  };
  form.elements.school.focus();
 });
}
