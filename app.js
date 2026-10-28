import {normalizeAssignments,validateAssignment,assignmentStatuses} from './assignments.js';
import {setupSync} from './sync-ui.js';
import {shareUrl,readSharedPlan} from './sharing.js';
import {initialState,roles,validateVisit,emailDraft,validState,applyFirstWeekPlan,confirmedDays,enrichTeachers,visitWarnings,internLunchOverlap} from './model.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], key='cuped-planner-v1';
const readOnly=new URLSearchParams(location.search).get('view')==='1'||location.pathname.endsWith('/view.html');
let shared=null,shareError=false;
if(readOnly)try{shared=await readSharedPlan(location.hash);}catch{shareError=true;}
let state=shared?.state||initialState();if(!readOnly)try{const saved=JSON.parse(localStorage.getItem(key));if(validState(saved))state=saved;}catch{}
normalizeAssignments(state);
let sync=null,cloudLoaded=false;
if(!shared)state=enrichTeachers(applyFirstWeekPlan(state));if(!readOnly)try{localStorage.setItem(key,JSON.stringify(state));}catch{}
let week=new Date(2026,9,26), filter='All',rotationId=state.rotations.at(-1).id;
if(shared)week=new Date(shared.week+'T12:00:00');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
function notice(t){$('#message').textContent=t;setTimeout(()=>$('#message').textContent='',5000);}
function save(){if(readOnly)return;try{localStorage.setItem(key,JSON.stringify(state));}catch{notice('Browser storage is unavailable. Export a backup to keep your changes.');}render();sync?.queueSave(state);}
function render(){
 $('#student-count').innerHTML=`${state.students.length} <small>across A & B days</small>`;
 $('#presenter-count').innerHTML=`${state.presenters.length} <small>ready for the next rotation</small>`;
 $('#teacher-count').innerHTML=`${state.teachers.length} <small>classrooms to connect with</small>`;
 $('#confirmed-count').innerHTML=`${state.visits.filter(v=>v.status==='Confirmed').length} <small>teacher confirmed</small>`;
 const saturday=new Date(week);saturday.setDate(week.getDate()+5);const sunday=new Date(week);sunday.setDate(week.getDate()+6);const hasWeekend=[...state.visits,...state.assignments].some(item=>item.date>=iso(saturday)&&item.date<=iso(sunday));const dayCount=hasWeekend?7:5;$('#calendar').style.gridTemplateColumns=`repeat(${dayCount},1fr)`;
 const friday=new Date(week);friday.setDate(week.getDate()+dayCount-1);$('#week-label').textContent=`${fmt(week)} – ${fmt(friday)}, ${week.getFullYear()}`;
 $('#calendar').innerHTML=Array.from({length:dayCount},(_,i)=>{
  const d=new Date(week);d.setDate(d.getDate()+i);
  const visits=state.visits.filter(v=>v.date===iso(d)&&(filter==='All'||v.day===filter)).sort((a,b)=>a.start.localeCompare(b.start));
  const assignments=state.assignments.filter(a=>a.date===iso(d)&&(filter==='All'||a.assignees.some(n=>state.students.some(s=>s.name===n&&s.day===filter))));
  const visitCards=visits.map(v=>`<button class="visit-card ${v.day==='B'?'b-day':''}" data-visit="${esc(v.id)}"><span class="badge">${esc(v.day)}-DAY · ${esc(v.status)}</span><b>${esc(v.teacher)}</b><span>${esc(v.start)}–${esc(v.end)}${v.room?' · '+esc(v.room):''}</span><p>${v.presenters.map(esc).join('<br>')}</p>${visitWarnings(v,state).map(w=>`<small class="lunch-warning">${esc(w)}</small>`).join('')}</button>`).join('');
  const taskCards=assignments.map(a=>`<button class="visit-card assignment-card ${a.status==='Done'?'assignment-done':''}" data-assignment="${esc(a.id)}"><span class="badge">WORK ASSIGNMENT · ${esc(a.status||'Planned')}</span><b>${esc(a.role)}</b><span>${a.assignees.map(esc).join(', ')}</span><p class="assignment-description">${esc(a.description)}</p></button>`).join('');
  return `<div class="calendar-day"><div class="day-heading"><span>${d.toLocaleDateString('en-US',{weekday:'short'})}</span><strong>${d.getDate()}${confirmedDays[iso(d)]?' · '+confirmedDays[iso(d)]+'-Day':''}</strong></div>${visitCards}${taskCards}${!visits.length&&!assignments.length?`<div class="empty-day-wrap">${readOnly?'<p class="empty-copy">Nothing scheduled</p>':`<button class="empty-day" data-date="${iso(d)}"><span>＋</span>Add a classroom visit</button><button class="empty-assignment quiet" data-assignment-date="${iso(d)}">＋ Assign work</button>`}</div>`:''}</div>`;
 }).join('');
 $$('#calendar [data-date]').forEach(b=>b.onclick=()=>openVisit(null,b.dataset.date));
 $$('[data-visit]').forEach(b=>b.onclick=()=>openVisit(state.visits.find(v=>v.id===b.dataset.visit)));
 $$('[data-assignment]').forEach(b=>b.onclick=()=>openAssignment(state.assignments.find(a=>a.id===b.dataset.assignment)));
 $$('[data-assignment-date]').forEach(b=>b.onclick=()=>openAssignment(null,b.dataset.assignmentDate));
 $('#presenter-teams').innerHTML=['A','B'].map(day=>`<div><h3><span class="day-dot ${day==='B'?'purple':''}"></span>${day}-Day <small>${state.students.filter(s=>s.day===day&&state.presenters.includes(s.name)).length} presenters</small></h3>${state.students.filter(s=>s.day===day&&state.presenters.includes(s.name)).map(s=>`<div class="person"><span class="mini-avatar">${esc(s.name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span>${esc(s.name)}</div>`).join('')}</div>`).join('');
 $('#rotation-select').innerHTML=state.rotations.map(r=>`<option value="${esc(r.id)}">${esc(r.start)} → ${esc(r.end)}</option>`).join('');$('#rotation-select').value=rotationId;
 const rotation=state.rotations.find(r=>r.id===rotationId)||state.rotations[0];
 $('#student-rows').innerHTML=state.students.map((s,i)=>`<tr><td>${esc(s.name)}</td><td><select aria-label="School day for ${esc(s.name)}" data-day="${i}">${['A','B'].map(d=>`<option ${s.day===d?'selected':''}>${d}</option>`).join('')}</select></td><td><select aria-label="Role for ${esc(s.name)}" data-role="${i}">${roles.map(r=>`<option ${rotation.assignments[s.name]===r?'selected':''}>${r}</option>`).join('')}</select></td><td><input type="checkbox" aria-label="Proposed presenter ${esc(s.name)}" data-presenter="${i}" ${state.presenters.includes(s.name)?'checked':''}></td></tr>`).join('');
 $$('[data-role]').forEach(x=>x.onchange=()=>{rotation.assignments[state.students[x.dataset.role].name]=x.value;save();});
 $$('[data-day]').forEach(x=>x.onchange=()=>{const s=state.students[x.dataset.day];if(state.visits.some(v=>v.presenters.includes(s.name)&&v.day!==x.value&&v.status!=='Cancelled')){notice('Update this student’s scheduled visits before changing their school day.');render();return;}s.day=x.value;save();});
 $$('[data-presenter]').forEach(x=>x.onchange=()=>{const name=state.students[x.dataset.presenter].name;state.presenters=x.checked?[...new Set([...state.presenters,name])]:state.presenters.filter(n=>n!==name);save();});
 $('#teacher-cards').innerHTML=state.teachers.map((t,i)=>`<article class="panel"><span class="badge">CLASSROOM PARTNER</span><h3>${esc(t.name)}</h3><p>${esc(t.fullName||'Identity unconfirmed')}<br>${esc(t.department||'Department unconfirmed')}</p><label>Email address<input data-email="${i}" type="email" value="${esc(t.email)}" placeholder="Add email address"></label><div class="form-grid">${['A','B'].map(day=>`<label>${day}-Day class lunch<select data-lunch="${i}" data-school-day="${day}">${[['unknown','Unconfirmed'],['first','First · 10:35–11:15'],['second','Second · 11:35–12:15']].map(([value,label])=>`<option value="${value}" ${t.lunch?.[day]===value?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div><small>${state.visits.filter(v=>v.teacher===t.name).length} visits planned</small></article>`).join('');$$('[data-email]').forEach(x=>x.onchange=()=>{if(!x.checkValidity()){x.reportValidity();return;}state.teachers[x.dataset.email].email=x.value.trim();save();notice('Teacher email saved.');});$$('[data-lunch]').forEach(x=>x.onchange=()=>{state.teachers[x.dataset.lunch].lunch[x.dataset.schoolDay]=x.value;save();notice('Lunch updated. Check existing visits for any conflicts.');});
 $('#email-authorization').hidden=!readOnly;$('#draft-list').hidden=readOnly;
 $('#draft-list').innerHTML=readOnly?'':state.visits.filter(v=>v.status!=='Cancelled').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).map(v=>`<article class="panel"><span class="badge">${esc(v.day)}-DAY · ${esc(v.date)}</span><h3>${esc(v.teacher)}</h3><p>${esc(v.start)}–${esc(v.end)} · ${v.presenters.map(esc).join(', ')}</p><button class="primary" data-draft="${esc(v.id)}">View email draft</button></article>`).join('')||'<p>No visits yet. Schedule a visit to prepare an email draft.</p>';
 $$('[data-draft]').forEach(b=>b.onclick=()=>openEmail(state.visits.find(v=>v.id===b.dataset.draft)));
 if(readOnly){$$('#student-rows input, #student-rows select, #teacher-cards input, #teacher-cards select').forEach(x=>x.disabled=true);$$('.empty-day').forEach(x=>{x.disabled=true;x.innerHTML='No visits scheduled';});}
}
function presenterOptions(selected=[]){const day=$('#visit-form').elements.day.value;$('#presenter-options').innerHTML=state.students.filter(s=>s.day===day).map(s=>`<label class="check-option"><input type="checkbox" name="presenter" value="${esc(s.name)}" ${selected.includes(s.name)?'checked':''}>${esc(s.name)}${state.presenters.includes(s.name)?' <small>proposed</small>':''}</label>`).join('');}
function openVisit(v,date){if(readOnly&&!v)return;const f=$('#visit-form');f.reset();$('#form-error').textContent='';$('#visit-teacher').innerHTML='<option value="">Select a teacher</option>'+state.teachers.map(t=>`<option>${esc(t.name)}</option>`).join('');f.elements.id.value=v?.id||'';f.elements.date.value=v?.date||date||'';for(const k of ['day','start','end','teacher','room','status','notes'])if(v)f.elements[k].value=v[k]||'';if(!v&&confirmedDays[f.elements.date.value])f.elements.day.value=confirmedDays[f.elements.date.value];presenterOptions(v?.presenters||state.presenters);f.elements.lunchAcknowledged.checked=!!v?.lunchAcknowledged;updateLunchWarnings();$('#dialog-title').textContent=v?'Edit classroom visit':'Schedule a visit';$('#delete-visit').hidden=!v;$('#email-visit').hidden=readOnly||!v;if(readOnly){$('#dialog-title').textContent='Classroom visit details';$$('#visit-form input, #visit-form select, #visit-form textarea').forEach(x=>x.disabled=true);$('#delete-visit').hidden=true;$('#email-visit').hidden=readOnly||!v;$('#visit-form [type=submit]').hidden=true;$('#close-dialog').textContent='Close';}$('#visit-dialog').showModal();}
$('#visit-form').elements.date.onchange=()=>{const day=confirmedDays[$('#visit-form').elements.date.value];if(day){$('#visit-form').elements.day.value=day;presenterOptions(state.presenters);}};
$('#visit-form').elements.day.onchange=()=>presenterOptions(state.presenters);
$('#visit-form').onsubmit=e=>{e.preventDefault();if(readOnly)return;const f=e.target;const v=Object.fromEntries(new FormData(f));v.presenters=new FormData(f).getAll('presenter');delete v.presenter;v.lunchAcknowledged=f.elements.lunchAcknowledged.checked;const error=validateVisit(v,state,v.id);if(error){$('#form-error').textContent=error;return;}v.id=v.id||crypto.randomUUID();const i=state.visits.findIndex(x=>x.id===v.id);if(i<0)state.visits.push(v);else state.visits[i]=v;const d=new Date(v.date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));week=d;save();$('#visit-dialog').close();notice('Classroom visit saved.');};
$('#delete-visit').onclick=()=>{if(readOnly)return;if(!confirm('Delete this classroom visit?'))return;state.visits=state.visits.filter(v=>v.id!==$('#visit-form').elements.id.value);save();$('#visit-dialog').close();};
function openEmail(v){if(readOnly||!v)return;$('#email-recipient').value=state.teachers.find(t=>t.name===v.teacher)?.email||'';$('#email-body').value=emailDraft(v);$('#copy-email').textContent='Copy draft';$('#email-dialog').showModal();}
$('#email-visit').onclick=()=>openEmail(state.visits.find(v=>v.id===$('#visit-form').elements.id.value));
$('#open-email').onclick=()=>{if(readOnly)return;const input=$('#email-recipient');if(!input.value||!input.checkValidity()){input.required=true;input.reportValidity();return;}location.href=`mailto:${encodeURIComponent(input.value)}?subject=${encodeURIComponent('CCU CUPED classroom visit confirmation')}&body=${encodeURIComponent($('#email-body').value)}`;};
$('#close-email').onclick=()=>$('#email-dialog').close();$('#close-dialog').onclick=()=>$('#visit-dialog').close();$('#add-visit').onclick=()=>openVisit();
$('#prev').onclick=()=>{week.setDate(week.getDate()-7);render();};$('#next').onclick=()=>{week.setDate(week.getDate()+7);render();};
 $$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('.tab').forEach(t=>t.hidden=t.id!==b.dataset.tab);$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#breadcrumb').textContent=b.textContent.slice(3).trim();$('#title').innerHTML=b.dataset.tab==='schedule'?'Your CCU Schedule, Simplified.':b.dataset.tab==='team'?'Everyone has a part.<br>Give them a place.':b.dataset.tab==='emails'?(readOnly?'Email drafts.<br>Authorization required.':'Your next visit.<br>One email away.'):'Good connections.<br>Great classrooms.';});
$('#rotation-select').onchange=e=>{rotationId=e.target.value;render();};
$('#add-rotation').onclick=()=>{const f=$('#rotation-form');const last=state.rotations.at(-1);const start=new Date(last.end+'T12:00:00');start.setDate(start.getDate()+3);f.elements.start.value=iso(start);const end=new Date(start);end.setDate(end.getDate()+11);f.elements.end.value=iso(end);$('#rotation-error').textContent='';$('#rotation-dialog').showModal();};
$('#close-rotation').onclick=()=>$('#rotation-dialog').close();$('#rotation-form').onsubmit=e=>{e.preventDefault();if(readOnly)return;const f=e.target,start=f.elements.start.value,end=f.elements.end.value;if(end<start||state.rotations.some(r=>r.start<=end&&r.end>=start)){$('#rotation-error').textContent='Choose an end after the start, without overlapping an existing rotation.';return;}const previous=[...state.rotations].filter(r=>r.end<start).sort((a,b)=>b.end.localeCompare(a.end))[0]||state.rotations[0];const r={id:crypto.randomUUID(),start,end,assignments:{...previous.assignments}};state.rotations.push(r);state.rotations.sort((a,b)=>a.start.localeCompare(b.start));rotationId=r.id;save();$('#rotation-dialog').close();};
$('#print').onclick=()=>window.print();$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cuped-schedule.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{try{const incoming=JSON.parse(await e.target.files[0].text());if(!validState(incoming))throw Error('Invalid schedule');if(!confirm('Replace the plan in this browser with this backup? Export your current plan first if needed.'))return;state=normalizeAssignments(enrichTeachers(incoming));rotationId=state.rotations.at(-1).id;save();notice('Schedule imported.');}catch{notice('Could not import this file. Choose a CUPED JSON backup.');}e.target.value='';};render();

function updateLunchWarnings(){
 const f=$('#visit-form');const v={date:f.elements.date.value,day:f.elements.day.value,teacher:f.elements.teacher.value,start:f.elements.start.value,end:f.elements.end.value,room:f.elements.room.value};
 $('#lunch-warnings').textContent=visitWarnings(v,state).join(' ');
 $('#lunch-ack-label').hidden=!internLunchOverlap(v);
}
for(const field of ['date','day','teacher','start','end','room'])$('#visit-form').elements[field].addEventListener('change',updateLunchWarnings);

$('#share').onclick=async()=>{
 $('#copy-share').textContent='Copy link';await sync?.flush();const live=sync?.getLiveConfig();$('#share-mode').textContent=live?'Live link: viewers see saved changes automatically, usually within 15 seconds.':'Snapshot link: live syncing is not connected or has unsaved changes. This copy will not update; open Live sync to connect.';$('#share-link').value=live?liveUrl(live):await shareUrl(location.href,state,iso(week));$('#open-shared').href=$('#share-link').value;$('#share-dialog').showModal();
};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#copy-share').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-link').value);$('#copy-share').textContent='Copied!';}catch{$('#share-link').select();notice('Select and copy the link from the box.');}};
if(readOnly){
 $('[data-tab=emails]').hidden=false;$('[data-tab=emails]').disabled=false;$('#emails').hidden=true;$('#email-dialog').hidden=true;$('#email-recipient').value='';$('#email-body').value='';
 $('.warm .text-link').textContent='Teacher confirmations are managed by the project lead.';$('.warm small').textContent='Open Email drafts to see how to request authorization.';$('#emails .section-bar p').textContent='Access to teacher email drafts requires authorization from the project lead.';
 for(const selector of ['#add-assignment','#sync-settings','#add-visit','#add-rotation','#import','#export','#share'])$(selector).hidden=true;
 $('.storage-note').textContent='View-only schedule • This copy reflects the plan when its link was created. Ask Valerie for a new link after updates.';
 $('footer').innerHTML='<span class="badge">VIEW-ONLY SCHEDULE</span>';
 $('#view-banner').hidden=false;
 if(shareError){$('#view-banner').textContent='This shared link is invalid. Showing the original proposed schedule; ask Valerie for a new link.';}
}

$('#copy-email').onclick=async()=>{if(readOnly)return;try{await navigator.clipboard.writeText($('#email-body').value);$('#copy-email').textContent='Copied!';}catch{$('#email-body').select();notice('Select and copy the draft text.');}};

function liveUrl(config){
 const url=new URL(location.href);url.pathname=url.pathname.replace(/[^/]*$/,'')+'view.html';url.search='';url.hash=new URLSearchParams({live:JSON.stringify({url:config.url,key:config.key,planId:config.planId})}).toString();return url.href;
}
function openAssignment(a,date){
 if(readOnly&&!a)return;
 const f=$('#assignment-form');f.reset();$('#assignment-error').textContent='';
 f.elements.id.value=a?.id||'';f.elements.date.value=a?.date||date||'';
 f.elements.role.innerHTML='<option value="">Choose a role</option>'+roles.map(r=>`<option>${esc(r)}</option>`).join('');
 f.elements.status.innerHTML=assignmentStatuses.map(status=>`<option>${esc(status)}</option>`).join('');
 if(a)for(const field of ['role','description','status'])f.elements[field].value=a[field]||'Planned';
 $('#assignment-assignees').innerHTML=state.students.map(student=>`<label class="check-option"><input type="checkbox" name="assignee" value="${esc(student.name)}" ${a?.assignees.includes(student.name)?'checked':''}>${esc(student.name)} <small>${esc(student.day)}-Day</small></label>`).join('');
 $$('#assignment-form input, #assignment-form select, #assignment-form textarea').forEach(x=>x.disabled=readOnly);
 $('#assignment-title').textContent=readOnly?'Work assignment':a?'Edit work assignment':'Assign work';
 $('#delete-assignment').hidden=readOnly||!a;$('#assignment-form [type=submit]').hidden=readOnly;
 $('#assignment-dialog').showModal();
}
$('#add-assignment').onclick=()=>openAssignment();
$('#close-assignment').onclick=()=>$('#assignment-dialog').close();
$('#assignment-form').onsubmit=e=>{
 e.preventDefault();if(readOnly)return;
 const data=new FormData(e.target);const assignment=Object.fromEntries(data);delete assignment.assignee;
 assignment.assignees=data.getAll('assignee');assignment.description=assignment.description.trim();
 const error=validateAssignment(assignment,state);if(error){$('#assignment-error').textContent=error;return;}
 assignment.id=assignment.id||crypto.randomUUID();
 const i=state.assignments.findIndex(a=>a.id===assignment.id);if(i<0)state.assignments.push(assignment);else state.assignments[i]=assignment;
 const d=new Date(assignment.date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));week=d;
 save();$('#assignment-dialog').close();notice('Work assignment saved.');
};
$('#delete-assignment').onclick=()=>{
 if(readOnly||!confirm('Delete this work assignment?'))return;
 state.assignments=state.assignments.filter(a=>a.id!==$('#assignment-form').elements.id.value);save();$('#assignment-dialog').close();
};
sync=await setupSync({readOnly,getState:()=>structuredClone(state),applyState:incoming=>{
 if(!validState(incoming))throw Error('The shared schedule has an unsupported format.');cloudLoaded=true;
 state=normalizeAssignments(incoming);if(!state.rotations.some(r=>r.id===rotationId))rotationId=state.rotations.at(-1).id;
 if(!readOnly)try{localStorage.setItem(key,JSON.stringify(state));}catch{}
 render();
},onStatus:text=>{$('#sync-status').textContent=text;
 if(!readOnly)$('.storage-note').textContent=text+' · Export a backup to keep a separate copy.';
 if(readOnly&&(new URLSearchParams(location.hash.slice(1)).has('live')||/^(Loading shared calendar|Live view|Could not load shared calendar)/.test(text))){$('.storage-note').textContent=text;$('#view-banner').textContent='View-only live calendar · '+text;$('#calendar').hidden=!cloudLoaded;}
}});
