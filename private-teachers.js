// Owner-browser notes are deliberately separate from shared plan state and exports.
export const PRIVATE_TEACHERS_KEY='cuped-owner-declined-teachers-v1';
export function cleanPrivateTeacher(value){
 if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>160)throw Error('Enter a teacher name.');
 const date=typeof value.date==='string'?value.date:'';
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid response date.');
 return {name:value.name.trim(),date,notes:typeof value.notes==='string'?value.notes.slice(0,2000):''};
}
export function setupPrivateTeachers({authorized,isAuthorized=()=>false}={}){
 if(!authorized||!isAuthorized())return null;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let records=[];try{const stored=JSON.parse(localStorage.getItem(PRIVATE_TEACHERS_KEY));if(Array.isArray(stored))records=stored.map(cleanPrivateTeacher);}catch{}
 const button=document.createElement('button');button.dataset.tab='private-teachers';button.textContent='◈  Teachers who declined';document.querySelector('aside nav').append(button);
 const panel=document.createElement('section');panel.id='private-teachers';panel.className='tab';panel.hidden=true;
 panel.innerHTML=`<div class="section-bar"><div><h2>Teachers who declined presentations</h2><p>Owner only · Please respect each teacher’s response.</p></div></div><p class="private-storage-note">Saved only in this browser, separate from the shared calendar. These notes do not sync to other devices or appear in student views, shared links, calendar updates, or calendar backups. Use a personal device; clearing browser storage removes this list.</p><form id="private-teacher-form" class="panel"><input name="originalName" type="hidden"><div class="form-grid"><label>Teacher name<input name="name" required maxlength="160" autocomplete="off"></label><label>Response date<input name="date" type="date"></label></div><label>Private note<textarea name="notes" maxlength="2000" rows="3" placeholder="Record the response without including unnecessary personal information."></textarea></label><button class="primary" type="submit">Save private record</button><button class="quiet" type="button" id="private-teacher-reset">Clear form</button><p id="private-teacher-status" role="status"></p></form><div id="private-teacher-list" class="teacher-grid"></div>`;
 document.querySelector('main').append(panel);
 const form=panel.querySelector('form'),status=panel.querySelector('#private-teacher-status');
 function render(){
  if(!isAuthorized())return;
  panel.querySelector('#private-teacher-list').innerHTML=records.map((record,index)=>`<article class="panel declined-teacher-card"><span class="badge">DECLINED · DO NOT SCHEDULE</span><h3>${esc(record.name)}</h3><p>${esc(record.date||'Response date not recorded')}</p><p class="private-teacher-note">${esc(record.notes)}</p><button class="secondary" type="button" data-private-edit="${index}">Edit</button><button class="quiet" type="button" data-private-remove="${index}">Remove</button></article>`).join('')||'<p>No declined teachers recorded in this browser.</p>';
  panel.querySelectorAll('[data-private-edit]').forEach(b=>b.onclick=()=>{if(!isAuthorized())return;const record=records[Number(b.dataset.privateEdit)];for(const key of ['name','date','notes'])form.elements[key].value=record[key];form.elements.originalName.value=record.name;form.elements.name.focus();});
  panel.querySelectorAll('[data-private-remove]').forEach(b=>b.onclick=()=>{if(!isAuthorized()||!confirm('Remove this private declined-teacher record?'))return;persist(records.filter((_,i)=>i!==Number(b.dataset.privateRemove)));});
 }
 function persist(next){
  if(!isAuthorized())return false;
  try{localStorage.setItem(PRIVATE_TEACHERS_KEY,JSON.stringify(next));records=next;status.textContent='Private list saved in this browser.';render();return true;}catch{status.textContent='Could not save private notes. Browser storage may be unavailable. Please keep a separate private record.';return false;}
 }
 form.onsubmit=event=>{event.preventDefault();if(!isAuthorized())return;try{const record=cleanPrivateTeacher(Object.fromEntries(new FormData(form)));const old=form.elements.originalName.value;const next=records.filter(r=>r.name.toLowerCase()!==record.name.toLowerCase()&&r.name!==old);if(persist([...next,record]))form.reset();}catch(error){status.textContent=error.message;}};
 panel.querySelector('#private-teacher-reset').onclick=()=>form.reset();
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(fragment.has('private-teacher')){
  try{const record=cleanPrivateTeacher(JSON.parse(fragment.get('private-teacher')));const next=[...records.filter(r=>r.name.toLowerCase()!==record.name.toLowerCase()),record];if(persist(next)){fragment.delete('private-teacher');history.replaceState(null,'',location.pathname+location.search+(fragment.size?'#'+fragment.toString():''));}}catch{status.textContent='Could not read the private record link. Add the teacher using the form.';}
 }
 render();
 return {hasDeclined:name=>isAuthorized()&&records.some(record=>record.name.toLowerCase()===name.trim().toLowerCase()),destroy(){records=[];form.reset();panel.remove();button.remove();}};
}
