import {websiteDefaults,normalizeWebsiteSettings,validateWebsiteSettings,normalizeSchoolDirectory,applyWebsiteSettings,cacheWebsiteData} from './website-settings.js?v=44';
import {fileToTeamPhoto} from './team-photo.js';
const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupSiteManager({authorized,isAuthorized=()=>false,getState,onSave}={}){
 if(!authorized||!isAuthorized())return null;
 const nav=document.createElement('button');nav.dataset.tab='manage-website';nav.textContent='⚙  Manage website';document.querySelector('aside nav').append(nav);
 const panel=document.createElement('section');panel.id='manage-website';panel.className='tab';panel.hidden=true;
 panel.innerHTML='<div class="section-bar"><div><h2>Manage website</h2><p>Edit your public website here. Preview first, then save to share changes through live sync.</p></div></div><form id="website-settings-form" class="panel"><h3>Website text</h3><div class="form-grid"><label>School chooser heading<input name="portalTitle" maxlength="100" required></label><label>Current school name<input name="schoolName" maxlength="120" required></label><label>Browser tab title<input name="tabTitle" maxlength="80" required></label><label>Home heading<input name="homeHeading" maxlength="140" required></label></div><label>Home description<textarea name="subtitle" rows="2" maxlength="300"></textarea></label><label>Calendar announcement<textarea name="announcement" rows="3" maxlength="1000"></textarea></label><label>Sidebar message<input name="sidebarMessage" maxlength="100"></label><h3>Design</h3><div class="form-grid"><label>Primary button color<input name="primaryColor" type="color"></label><label>Page background<input name="backgroundColor" type="color"></label><label>Font<select name="font"><option>DM Sans</option><option>Arial</option><option>Georgia</option></select></label><label>Logo image<input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG, or WebP · Up to 2 MB · Visible to everyone.</small></label></div><img id="manager-logo-preview" class="manager-logo-preview" alt="Current website logo"><button id="use-default-logo" class="secondary" type="button">Use original CUPED logo</button><h3>School links</h3><p>The current school opens its existing calendar. Add links only for schools that already have their own websites. Adding a link does not create a separate calendar or give anyone admin access.</p><div id="manager-school-links"></div><button id="add-school-link" class="secondary" type="button">Add school link</button><div class="dialog-actions"><button id="preview-website" class="secondary" type="button">Preview changes</button><button id="discard-website-preview" class="quiet" type="button">Reload saved settings</button><button class="primary" type="submit">Save website settings</button></div><p id="website-settings-status" role="status"></p></form><article class="panel"><h3>What you can manage without chat</h3><p>Use this section for branding, text, and school links. Use the other Owner tabs for teachers, visits, assignments, rotations, and feedback resources.</p><p>New school accounts, private workspaces, domain setup, and completely new features still need separate setup. Each school should have its own calendar and permissions before its link is added here.</p><a class="secondary" href="index.html?chooseSchool=1">Open school chooser</a></article>';
 document.querySelector('main').append(panel);
 const form=panel.querySelector('form'),status=panel.querySelector('#website-settings-status');let logo=null,dirty=false,signature='',previewData=null;
 function markDirty(){dirty=true;status.textContent='Unsaved changes. Preview them or save when ready.';}
 form.addEventListener('input',markDirty);
 function schoolRows(){
  return [...panel.querySelectorAll('.school-link-row')].map(row=>({id:row.dataset.schoolId,name:row.querySelector('[name=schoolLinkName]').value,url:row.querySelector('[name=schoolLinkUrl]').value}));
 }
 function renderRows(rows){
  panel.querySelector('#manager-school-links').innerHTML=rows.map(entry=>'<div class="school-link-row" data-school-id="'+esc(entry.id)+'"><label>School name<input name="schoolLinkName" value="'+esc(entry.name)+'" maxlength="120" required></label><label>School website<input name="schoolLinkUrl" value="'+esc(entry.url)+'" type="url" placeholder="https://…" required></label><button class="quiet" data-remove-school type="button">Remove link</button></div>').join('');
  panel.querySelectorAll('[data-remove-school]').forEach(button=>button.onclick=()=>{button.closest('.school-link-row').remove();markDirty();});
 }
 function fill(){
  const state=getState(),settings=normalizeWebsiteSettings(state.siteSettings);
  for(const key of Object.keys(websiteDefaults))form.elements[key].value=settings[key];
  logo=settings.logo;panel.querySelector('#manager-logo-preview').src=logo?logo.dataUrl:'assets/cuped-logo.png';
  let rows=[];try{rows=normalizeSchoolDirectory(state.schoolDirectory,settings).filter(entry=>!entry.current);}catch{}
  renderRows(rows);signature=JSON.stringify([state.siteSettings,state.schoolDirectory]);dirty=false;
 }
 function read(){
  const raw=Object.fromEntries(new FormData(form));const settings=normalizeWebsiteSettings({...raw,logo});
  validateWebsiteSettings(settings);return {siteSettings:settings,schoolDirectory:normalizeSchoolDirectory(schoolRows(),settings)};
 }
 panel.querySelector('#add-school-link').onclick=()=>{if(!isAuthorized())return;renderRows([...schoolRows(),{id:crypto.randomUUID(),name:'',url:''}]);markDirty();};
 panel.querySelector('#use-default-logo').onclick=()=>{if(!isAuthorized())return;logo=null;form.elements.logoFile.value='';panel.querySelector('#manager-logo-preview').src='assets/cuped-logo.png';markDirty();};
 form.elements.logoFile.onchange=async()=>{
  if(!isAuthorized())return;const file=form.elements.logoFile.files[0];if(!file)return;
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{const next=await fileToTeamPhoto(file);if(!isAuthorized())return;next.alt='CUPED school logo';logo=next;panel.querySelector('#manager-logo-preview').src=next.dataUrl;markDirty();}catch(error){status.textContent=error.message;}finally{if(isAuthorized())submit.disabled=false;}
 };
 panel.querySelector('#preview-website').onclick=()=>{if(!isAuthorized()||!form.reportValidity())return;try{const data=read();previewData=data;applyWebsiteSettings(data);status.textContent='Preview only. Use the calendar tab to inspect it, then return here to save. Your students still see the saved version.';}catch(error){status.textContent=error.message;}};
 panel.querySelector('#discard-website-preview').onclick=()=>{if(!isAuthorized())return;previewData=null;fill();applyWebsiteSettings(getState());status.textContent='Reloaded saved settings.';};
 form.onsubmit=event=>{
  event.preventDefault();if(!isAuthorized())return;
  try{
   const data=read(),state=getState();previewData=null;state.siteSettings=data.siteSettings;state.schoolDirectory=data.schoolDirectory;
   signature=JSON.stringify([state.siteSettings,state.schoolDirectory]);dirty=false;cacheWebsiteData(state);
   const saved=onSave();applyWebsiteSettings(state);
   status.textContent=saved===false?'Changes are applied here, but browser storage is unavailable. Check Live sync before leaving.':'Website settings saved here and queued for live sync. Wait for Shared calendar saved before leaving.';
  }catch(error){status.textContent=error.message;}
 };
 fill();
 return {currentState(){return previewData||getState();},refresh(){if(!isAuthorized())return;const next=JSON.stringify([getState().siteSettings,getState().schoolDirectory]);if(next!==signature&&!dirty)fill();},destroy(){previewData=null;applyWebsiteSettings(getState());logo=null;form.reset();panel.remove();nav.remove();}};
}
