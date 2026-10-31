import {blankRotation,previousRotation} from './rotations.js?v=26';
import {applyNewPresentationTeams,changeSnapshot,recordCalendarChanges,recentUpdates,teacherProgress} from './calendar-updates.js?v=25';
import {moveGornailToPending,pendingVisits} from './pending-visits.js?v=22';
import {learningSchedule,learningOn} from './learning-schedule.js?v=21';
import {schoolDateInfo,calendarRange} from './school-calendar.js';
import {fileToTeamPhoto,isValidTeamPhoto} from './team-photo.js';
import {requireInternAccess} from './intern-access.js?v=23';
import {requireOwnerAccess} from './owner-auth.js?v=23';
import {normalizeAssignments,validateAssignment,assignmentRoles,assignmentStatuses} from './assignments.js?v=20';
import {setupSync} from './sync-ui.js?v=15';
import {shareUrl,readSharedPlan} from './sharing.js?v=15';
import {initialState,roles,validateVisit,emailDraft,validState,applyFirstWeekPlan,enrichTeachers,visitWarnings,internLunchOverlap} from './model.js?v=22';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], key='cuped-planner-v1';
const writerId=crypto.randomUUID();
let localSavedAt=0,localWriterId=null;try{localSavedAt=Number(localStorage.getItem('cuped-planner-saved-at'))||0;localWriterId=localStorage.getItem('cuped-planner-writer');}catch{}
const pageParams=new URLSearchParams(location.search);
const readOnly=pageParams.get('owner')!=='1'||pageParams.get('view')==='1'||location.pathname.endsWith('/view.html');
let sync=null,ownerAccess=null,ownerReady=false,appStarted=false,verifierBusy=false;
const plannerShell=document.querySelector('#planner-shell');
function lockPlanner(){
 ownerReady=false;
 if(plannerShell){plannerShell.hidden=true;plannerShell.inert=true;}
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 sync?.destroy();
}
function unlockPlanner(){
 if(plannerShell){plannerShell.hidden=false;plannerShell.inert=false;}
 document.querySelector('#auth-loading')?.remove();
}
if(readOnly)await requireInternAccess();
ownerAccess=await requireOwnerAccess({readOnly,onLock:lockPlanner,onUnlock:()=>{if(appStarted)location.reload();}});
ownerReady=!!ownerAccess?.isAuthorized();
if(readOnly||ownerReady)unlockPlanner();

let shared=null,shareError=false;
if(readOnly)try{shared=await readSharedPlan(location.hash);}catch{shareError=true;}
let hasLocalPlan=false;
let state=shared?.state||initialState();if(!readOnly)try{const saved=JSON.parse(localStorage.getItem(key));if(validState(saved)){state=saved;hasLocalPlan=true;}}catch{}
normalizeAssignments(state);
let cloudLoaded=false;
if(!shared)state=enrichTeachers(applyFirstWeekPlan(state));if(!readOnly)try{localStorage.setItem(key,JSON.stringify(state));}catch{}
if(!shared)moveGornailToPending(state);
if(!shared)applyNewPresentationTeams(state);
let changeBaseline=changeSnapshot(state);
const updateSeenKey='cuped-seen-calendar-updates-v1';
let seenUpdates=new Set();try{seenUpdates=new Set(JSON.parse(localStorage.getItem(updateSeenKey))||[]);}catch{}
let announcedUpdates=new Set();
let calendarMode='week';
let week=new Date(2026,9,26), filter='All',rotationId=state.rotations.at(-1).id;
if(shared)week=new Date(shared.week+'T12:00:00');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
function notice(t){$('#message').textContent=t;setTimeout(()=>$('#message').textContent='',5000);}
function save(){if(readOnly||!ownerReady)return false;recordCalendarChanges(changeBaseline,state);changeBaseline=changeSnapshot(state);let stored=true;try{localStorage.setItem(key,JSON.stringify(state));localSavedAt=Date.now();localStorage.setItem('cuped-planner-saved-at',String(localSavedAt));localStorage.setItem('cuped-planner-writer',writerId);}catch{stored=false;notice('Browser storage is unavailable. Export a backup to keep your changes.');}render();sync?.queueSave(state);return stored;}
function openLearning(id){
 const event=learningSchedule.find(e=>e.id===id);if(!event)return;
 $('#learning-title').textContent=event.mobile?'Mobile branch & learning':'Learning & opportunities';
 $('#learning-details').innerHTML=`<p><strong>${esc(event.date)} · ${event.day}-Day</strong></p>${event.activities.map(activity=>`<article class="learning-detail"><h3>${esc(activity.title)}</h3><p>${esc(activity.time)}</p></article>`).join('')}${event.mobile?'<p class="mobile-callout">Take advantage of the mobile branch when it visits on your A or B school day. Dates are listed individually; participation or staffing is not assigned here.</p>':''}${event.dayWarning?`<p class="lunch-warning">${esc(event.dayWarning)}</p>`:''}<p>Program learning and opportunities, separate from intern work assignments and teacher visits.</p><p><small>Source: Coral Reef CUPED Tabling/Mobile Branch/FinEd schedule, revised September 17, 2026. FinEd and orientation times are not specified. <a href="assets/cuped-learning-schedule-2026-27.pdf" target="_blank" rel="noopener">View source schedule</a></small></p>`;
 $('#learning-dialog').showModal();
}
$('#close-learning').onclick=()=>$('#learning-dialog').close();
function renderUpdates(){
 const updates=recentUpdates(state);const unread=updates.filter(entry=>!seenUpdates.has(entry.id));
 $('#updates-count').textContent=String(unread.length);
 $('#updates-summary').textContent=unread.length?`${unread.length} new calendar ${unread.length===1?'summary':'summaries'} — open to see what changed`:'Recent calendar changes';
 $('#calendar-update-list').innerHTML=updates.map(entry=>`<li><time>${esc(entry.at.length===10?entry.at:new Date(entry.at).toLocaleString())}</time><ul>${entry.messages.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></li>`).join('')||'<li>New calendar edits will appear here.</li>';
 const fresh=unread.filter(entry=>!announcedUpdates.has(entry.id));
 if(fresh.length){$('#calendar-update-alert').hidden=false;$('#calendar-update-alert-text').textContent=fresh[0].messages[0]+(fresh.length>1?` Plus ${fresh.length-1} more update(s).`:'');}
 updates.forEach(entry=>announcedUpdates.add(entry.id));
}
$('#mark-updates-read').onclick=()=>{recentUpdates(state).forEach(entry=>seenUpdates.add(entry.id));try{localStorage.setItem(updateSeenKey,JSON.stringify([...seenUpdates].slice(-200)));}catch{}$('#calendar-update-alert').hidden=true;renderUpdates();};
$('#dismiss-update-alert').onclick=()=>{$('#calendar-update-alert').hidden=true;};
$('#view-updates').onclick=()=>{setCalendarExpanded(false);$('#calendar-updates').open=true;$('#calendar-updates').scrollIntoView({behavior:'smooth',block:'nearest'});};
function render(){
 renderUpdates();
 renderTeamPhoto();
 const pending=pendingVisits(state,filter);
 $('#pending-visits').hidden=!pending.length;
 $('#pending-visit-list').innerHTML=pending.map(v=>`<button class="visit-card pending-visit" data-pending-visit="${esc(v.id)}"><span class="badge">PENDING · ${esc(v.day)}-DAY · DATE TO BE CONFIRMED</span><b>${esc(v.teacher)}</b><p>${esc(v.notes)}</p><span>${v.presenters.map(esc).join(', ')}</span><small>${readOnly?'Awaiting a new date from the project lead.':'Open to choose a new date and time.'}</small></button>`).join('');
 $$('[data-pending-visit]').forEach(b=>b.onclick=()=>openVisit(state.visits.find(v=>v.id===b.dataset.pendingVisit)));

 $('#student-count').innerHTML=`${state.students.length} <small>across A & B days</small>`;
 $('#presenter-count').innerHTML=`${state.presenters.length} <small>ready for the next rotation</small>`;
 $('#teacher-count').innerHTML=`${state.teachers.length} <small>classrooms to connect with</small>`;
 const confirmed=teacherProgress(state,'Confirmed'),completed=teacherProgress(state,'Completed');
 $('#confirmed-count').innerHTML=`${confirmed.teachers} <small>${confirmed.visits} confirmed visit(s)</small>`;
 $('#completed-count').innerHTML=`${completed.teachers} <small>${completed.visits} completed visit(s)</small>`;
 const saturday=new Date(week);saturday.setDate(week.getDate()+5);const sunday=new Date(week);sunday.setDate(week.getDate()+6);const hasWeekend=[...state.visits,...state.assignments].some(item=>item.date>=iso(saturday)&&item.date<=iso(sunday));const range=calendarRange(week,calendarMode,hasWeekend);const dayCount=range.count;$('#calendar').style.gridTemplateColumns=`repeat(${range.columns},minmax(180px,1fr))`;$('#calendar').classList.toggle('month-calendar',calendarMode==='month');
 const friday=new Date(week);friday.setDate(week.getDate()+dayCount-1);$('#week-label').textContent=calendarMode==='month'?week.toLocaleDateString('en-US',{month:'long',year:'numeric'}):`${fmt(week)} – ${fmt(friday)}, ${week.getFullYear()}`;$('#calendar-date').value=iso(week);
 $('#calendar').innerHTML=Array.from({length:dayCount},(_,i)=>{
  const d=new Date(range.start);d.setDate(d.getDate()+i);const school=schoolDateInfo(iso(d));
  const visits=state.visits.filter(v=>v.date===iso(d)&&(filter==='All'||v.day===filter)).sort((a,b)=>a.start.localeCompare(b.start));
  const assignments=state.assignments.filter(a=>a.date===iso(d)&&(filter==='All'||a.assignees.some(n=>state.students.some(s=>s.name===n&&s.day===filter))));
  const visitCards=visits.map(v=>`<button class="visit-card ${v.day==='B'?'b-day':''}" data-visit="${esc(v.id)}"><span class="badge">${esc(v.day)}-DAY · ${esc(v.status)}</span><b>${esc(v.teacher)}</b><span>${esc(v.start)}–${esc(v.end)}${v.room?' · '+esc(v.room):''}</span><p>${v.presenters.map(esc).join('<br>')}</p>${v.notes?`<p class="expanded-visit-notes">${esc(v.notes)}</p>`:''}${visitWarnings(v,state).map(w=>`<small class="lunch-warning">${esc(w)}</small>`).join('')}</button>`).join('');
  const learning=learningOn(iso(d),filter);
  const learningCards=learning.map(event=>`<button class="visit-card learning-card ${event.mobile?'mobile-opportunity':''}" data-learning="${event.id}"><span class="badge">${event.mobile?'MOBILE BRANCH OPPORTUNITY':'LEARNING & OPPORTUNITIES'}</span>${event.activities.map(activity=>`<b>${esc(activity.title)}</b><span>${esc(activity.time)}</span>`).join('')}${event.mobile?'<p>Make the most of your school day’s mobile branch visit.</p>':''}${event.dayWarning?`<small class="lunch-warning">${esc(event.dayWarning)}</small>`:''}</button>`).join('');
  const taskCards=assignments.map(a=>`<button class="visit-card assignment-card ${a.status==='Done'?'assignment-done':''}" data-assignment="${esc(a.id)}"><span class="badge">WORK ASSIGNMENT · ${esc(a.status||'Planned')}</span><b>${esc(a.role)}</b><span>${a.assignees.map(esc).join(', ')}</span><p class="assignment-description">${esc(a.description)}</p></button>`).join('');
  return `<div class="calendar-day ${school.noSchool?'no-school':''} ${calendarMode==='month'&&d.getMonth()!==week.getMonth()?'outside-month':''}"><div class="day-heading"><span>${d.toLocaleDateString('en-US',{weekday:'short'})}</span><strong>${d.getDate()}${school.day?' · '+school.day+'-Day':''}</strong></div><p class="school-day-label">${esc(school.label)}</p>${learningCards}${visitCards}${taskCards}${!visits.length&&!assignments.length&&!learning.length?`<div class="empty-day-wrap">${readOnly?'<p class="empty-copy">Nothing scheduled</p>':`${school.noSchool?'':`<button class="empty-day" data-date="${iso(d)}"><span>＋</span>Add a classroom visit</button>`}<button class="empty-assignment quiet" data-assignment-date="${iso(d)}">＋ Assign work</button>`}</div>`:''}</div>`;
 }).join('');
 $$('#calendar [data-date]').forEach(b=>b.onclick=()=>openVisit(null,b.dataset.date));
 $$('[data-learning]').forEach(b=>b.onclick=()=>openLearning(b.dataset.learning));
 $$('[data-visit]').forEach(b=>b.onclick=()=>openVisit(state.visits.find(v=>v.id===b.dataset.visit)));
 $$('[data-assignment]').forEach(b=>b.onclick=()=>openAssignment(state.assignments.find(a=>a.id===b.dataset.assignment)));
 $$('[data-assignment-date]').forEach(b=>b.onclick=()=>openAssignment(null,b.dataset.assignmentDate));
 $('#presenter-teams').innerHTML=['A','B'].map(day=>`<div><h3><span class="day-dot ${day==='B'?'purple':''}"></span>${day}-Day <small>${state.students.filter(s=>s.day===day&&state.presenters.includes(s.name)).length} presenters</small></h3>${state.presenters.map(name=>state.students.find(s=>s.name===name&&s.day===day)).filter(Boolean).map(s=>`<div class="person"><span class="mini-avatar">${esc(s.name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span>${esc(s.name)}</div>`).join('')}</div>`).join('');
 $('#rotation-select').innerHTML=state.rotations.map(r=>`<option value="${esc(r.id)}">${esc(r.start)} → ${esc(r.end)}</option>`).join('');$('#rotation-select').value=rotationId;
 const rotation=state.rotations.find(r=>r.id===rotationId)||state.rotations[0];
 const previous=readOnly?null:previousRotation(state.rotations,rotation);
 $('#student-rows').innerHTML=state.students.map((s,i)=>`<tr><td>${esc(s.name)}</td><td><select aria-label="School day for ${esc(s.name)}" data-day="${i}">${['A','B'].map(d=>`<option ${s.day===d?'selected':''}>${d}</option>`).join('')}</select></td><td><select aria-label="Role for ${esc(s.name)}" data-role="${i}"><option value="" ${!rotation.assignments[s.name]?'selected':''}>Unassigned</option>${roles.map(r=>`<option ${rotation.assignments[s.name]===r?'selected':''}>${r}</option>`).join('')}</select>${readOnly?'':`<small class="previous-role">Previous rotation: ${esc(previous?.assignments[s.name]||'Unassigned')}${previous?` <span>(${esc(previous.start)} – ${esc(previous.end)})</span>`:' · No earlier rotation'}</small>`}</td><td><input type="checkbox" aria-label="Proposed presenter ${esc(s.name)}" data-presenter="${i}" ${state.presenters.includes(s.name)?'checked':''}></td></tr>`).join('');
 $$('[data-role]').forEach(x=>x.onchange=()=>{rotation.assignments[state.students[x.dataset.role].name]=x.value;save();});
 $$('[data-day]').forEach(x=>x.onchange=()=>{const s=state.students[x.dataset.day];if(state.visits.some(v=>v.presenters.includes(s.name)&&v.day!==x.value&&v.status!=='Cancelled')){notice('Update this student’s scheduled visits before changing their school day.');render();return;}s.day=x.value;save();});
 $$('[data-presenter]').forEach(x=>x.onchange=()=>{const name=state.students[x.dataset.presenter].name;state.presenters=x.checked?[...new Set([...state.presenters,name])]:state.presenters.filter(n=>n!==name);save();});
 $('#teacher-cards').innerHTML=state.teachers.map((t,i)=>`<article class="panel"><span class="badge">CLASSROOM PARTNER</span><h3>${esc(t.name)}</h3><p>${esc(t.fullName||'Identity unconfirmed')}<br>${esc(t.department||'Department unconfirmed')}</p><label>Email address<input data-email="${i}" type="email" value="${esc(t.email)}" placeholder="Add email address"></label><div class="form-grid">${['A','B'].map(day=>`<label>${day}-Day class lunch<select data-lunch="${i}" data-school-day="${day}">${[['unknown','Unconfirmed'],['first','First · 10:35–11:15'],['second','Second · 11:35–12:15']].map(([value,label])=>`<option value="${value}" ${t.lunch?.[day]===value?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div><small>${state.visits.filter(v=>v.teacher===t.name).length} visits planned</small></article>`).join('');$$('[data-email]').forEach(x=>x.onchange=()=>{if(!x.checkValidity()){x.reportValidity();return;}state.teachers[x.dataset.email].email=x.value.trim();save();notice('Teacher email saved.');});$$('[data-lunch]').forEach(x=>x.onchange=()=>{state.teachers[x.dataset.lunch].lunch[x.dataset.schoolDay]=x.value;save();notice('Lunch updated. Check existing visits for any conflicts.');});
 $('#email-authorization').hidden=!readOnly;$('#draft-list').hidden=readOnly;
 $('#draft-list').innerHTML=readOnly?'':state.visits.filter(v=>v.status!=='Cancelled'&&v.status!=='Pending').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).map(v=>`<article class="panel"><span class="badge">${esc(v.day)}-DAY · ${esc(v.date)}</span><h3>${esc(v.teacher)}</h3><p>${esc(v.start)}–${esc(v.end)} · ${v.presenters.map(esc).join(', ')}</p><button class="primary" data-draft="${esc(v.id)}">View email draft</button></article>`).join('')||'<p>No visits yet. Schedule a visit to prepare an email draft.</p>';
 $$('[data-draft]').forEach(b=>b.onclick=()=>openEmail(state.visits.find(v=>v.id===b.dataset.draft)));
 if(readOnly){$$('#student-rows input, #student-rows select, #teacher-cards input, #teacher-cards select').forEach(x=>x.disabled=true);$$('.empty-day').forEach(x=>{x.disabled=true;x.innerHTML='No visits scheduled';});}
}
function presenterOptions(selected=[]){const day=$('#visit-form').elements.day.value;$('#presenter-options').innerHTML=state.students.filter(s=>s.day===day).map(s=>`<label class="check-option"><input type="checkbox" name="presenter" value="${esc(s.name)}" ${selected.includes(s.name)?'checked':''}>${esc(s.name)}${state.presenters.includes(s.name)?' <small>proposed</small>':''}</label>`).join('');}
function openVisit(v,date){if(!readOnly&&!ownerReady)return;if(readOnly&&!v)return;const f=$('#visit-form');f.reset();$('#form-error').textContent='';$('#visit-teacher').innerHTML='<option value="">Select a teacher</option>'+state.teachers.map(t=>`<option>${esc(t.name)}</option>`).join('');f.elements.id.value=v?.id||'';f.elements.date.value=v?.date||date||'';for(const k of ['day','start','end','teacher','room','status','notes'])if(v)f.elements[k].value=v[k]||'';if(!v&&schoolDateInfo(f.elements.date.value).day)f.elements.day.value=schoolDateInfo(f.elements.date.value).day;presenterOptions(v?.presenters||state.presenters);f.elements.lunchAcknowledged.checked=!!v?.lunchAcknowledged;updateLunchWarnings();$('#dialog-title').textContent=v?'Edit classroom visit':'Schedule a visit';$('#delete-visit').hidden=!v;$('#email-visit').hidden=readOnly||!v||v.status==='Pending';if(readOnly){$('#dialog-title').textContent='Classroom visit details';$$('#visit-form input, #visit-form select, #visit-form textarea').forEach(x=>x.disabled=true);$('#delete-visit').hidden=true;$('#email-visit').hidden=readOnly||!v||v.status==='Pending';$('#visit-form [type=submit]').hidden=true;$('#close-dialog').textContent='Close';}updateVisitRequirements();$('#visit-dialog').showModal();}
$('#visit-form').elements.date.onchange=()=>{const day=schoolDateInfo($('#visit-form').elements.date.value).day;if(day){$('#visit-form').elements.day.value=day;presenterOptions(state.presenters);}};
$('#visit-form').elements.day.onchange=()=>presenterOptions(state.presenters);
$('#visit-form').elements.status.onchange=updateVisitRequirements;
function updateVisitRequirements(){const f=$('#visit-form');for(const name of ['date','start','end'])f.elements[name].required=f.elements.status.value!=='Pending';}

$('#visit-form').onsubmit=e=>{e.preventDefault();if(readOnly||!ownerReady)return;const f=e.target;const v=Object.fromEntries(new FormData(f));v.presenters=new FormData(f).getAll('presenter');delete v.presenter;v.lunchAcknowledged=f.elements.lunchAcknowledged.checked;if(v.status==='Pending'){v.date='';v.start='';v.end='';}const error=validateVisit(v,state,v.id);if(error){$('#form-error').textContent=error;return;}v.id=v.id||crypto.randomUUID();const i=state.visits.findIndex(x=>x.id===v.id);if(i<0)state.visits.push(v);else state.visits[i]=v;if(v.date){const d=new Date(v.date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));week=d;}save();$('#visit-dialog').close();notice('Classroom visit saved.');};
$('#delete-visit').onclick=()=>{if(readOnly||!ownerReady)return;if(!confirm('Delete this classroom visit?'))return;state.visits=state.visits.filter(v=>v.id!==$('#visit-form').elements.id.value);save();$('#visit-dialog').close();};
function openEmail(v){if(readOnly||!ownerReady||!v)return;$('#email-recipient').value=state.teachers.find(t=>t.name===v.teacher)?.email||'';$('#email-body').value=emailDraft(v);$('#copy-email').textContent='Copy draft';$('#email-dialog').showModal();}
$('#email-visit').onclick=()=>openEmail(state.visits.find(v=>v.id===$('#visit-form').elements.id.value));
$('#open-email').onclick=()=>{if(readOnly||!ownerReady)return;const input=$('#email-recipient');if(!input.value||!input.checkValidity()){input.required=true;input.reportValidity();return;}location.href=`mailto:${encodeURIComponent(input.value)}?subject=${encodeURIComponent('CCU CUPED classroom visit confirmation')}&body=${encodeURIComponent($('#email-body').value)}`;};
$('#close-email').onclick=()=>$('#email-dialog').close();$('#close-dialog').onclick=()=>$('#visit-dialog').close();$('#add-visit').onclick=()=>openVisit();
function moveCalendar(direction){if(calendarMode==='month'){week=new Date(week.getFullYear(),week.getMonth()+direction,1,12);}else week.setDate(week.getDate()+direction*7);render();}
$('#prev').onclick=()=>moveCalendar(-1);$('#next').onclick=()=>moveCalendar(1);
$('#calendar-mode').onchange=e=>{calendarMode=e.target.value;if(calendarMode==='week')week.setDate(week.getDate()-((week.getDay()+6)%7));render();};
$('#calendar-date').onchange=e=>{if(!e.target.value)return;week=new Date(e.target.value+'T12:00:00');if(calendarMode==='week')week.setDate(week.getDate()-((week.getDay()+6)%7));render();};
function setCalendarExpanded(expanded){document.body.classList.toggle('calendar-expanded',expanded);$('#expand-calendar').textContent=expanded?'↙ Collapse calendar':'⛶ Expand calendar';$('#expand-calendar').setAttribute('aria-expanded',String(expanded));}
$('#expand-calendar').onclick=()=>setCalendarExpanded(!document.body.classList.contains('calendar-expanded'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setCalendarExpanded(false);});
 $$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('.tab').forEach(t=>t.hidden=t.id!==b.dataset.tab);$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#breadcrumb').textContent=b.textContent.slice(3).trim();$('.page-heading').classList.toggle('team-heading',b.dataset.tab==='team');renderTeamPhoto();$('#title').innerHTML=b.dataset.tab==='schedule'?'Your CCU Schedule, Simplified.':b.dataset.tab==='team'?'Work together.<br>Teach one another.':b.dataset.tab==='emails'?(readOnly?'Email drafts.<br>Authorization required.':'Your next visit.<br>One email away.'):'Good connections.<br>Great classrooms.';});
$('#rotation-select').onchange=e=>{rotationId=e.target.value;render();};
$('#add-rotation').onclick=()=>{const f=$('#rotation-form');const last=state.rotations.at(-1);const start=new Date(last.end+'T12:00:00');start.setDate(start.getDate()+3);f.elements.start.value=iso(start);const end=new Date(start);end.setDate(end.getDate()+11);f.elements.end.value=iso(end);$('#rotation-error').textContent='';$('#rotation-dialog').showModal();};
$('#close-rotation').onclick=()=>$('#rotation-dialog').close();$('#rotation-form').onsubmit=e=>{e.preventDefault();if(readOnly||!ownerReady)return;const f=e.target,start=f.elements.start.value,end=f.elements.end.value;if(end<start||state.rotations.some(r=>r.start<=end&&r.end>=start)){$('#rotation-error').textContent='Choose an end after the start, without overlapping an existing rotation.';return;}const r=blankRotation(state.students,start,end);state.rotations.push(r);state.rotations.sort((a,b)=>a.start.localeCompare(b.start));rotationId=r.id;save();$('#rotation-dialog').close();};
$('#print').onclick=()=>window.print();$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cuped-schedule.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{try{const incoming=JSON.parse(await e.target.files[0].text());if(!validState(incoming))throw Error('Invalid schedule');if(!confirm('Replace the plan in this browser with this backup? Export your current plan first if needed.'))return;state=normalizeAssignments(enrichTeachers(incoming));rotationId=state.rotations.at(-1).id;save();notice('Schedule imported.');}catch{notice('Could not import this file. Choose a CUPED JSON backup.');}e.target.value='';};render();

function updateLunchWarnings(){
 const f=$('#visit-form');const v={date:f.elements.date.value,day:f.elements.day.value,teacher:f.elements.teacher.value,start:f.elements.start.value,end:f.elements.end.value,room:f.elements.room.value};
 $('#lunch-warnings').textContent=visitWarnings(v,state).join(' ');
 $('#lunch-ack-label').hidden=!internLunchOverlap(v);
}
for(const field of ['date','day','teacher','start','end','room'])$('#visit-form').elements[field].addEventListener('change',updateLunchWarnings);

$('#share').onclick=async()=>{
 $('#copy-share').textContent='Copy link';$('#copy-share').disabled=false;$('#open-shared').hidden=false;
 try{
  const live=sync?.getLiveConfig();if(live)sync.flush();
  $('#share-mode').textContent=live?(sync.isSaved()?'Live link: viewers see saved changes automatically, usually within 15 seconds.':'Live link: new edits are still syncing. Keep this page open until Shared calendar saved; viewers currently see the last confirmed save.'):'Snapshot link: live syncing is not connected. This copy will not update; connect Live sync for automatic updates.';
  $('#share-link').value=live?liveUrl(live):await shareUrl(location.href,state,iso(week));$('#open-shared').href=$('#share-link').value;
 }catch(error){$('#share-mode').textContent=error.message;$('#share-link').value='';$('#copy-share').disabled=true;$('#open-shared').hidden=true;}
 $('#share-dialog').showModal();
};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#copy-share').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-link').value);$('#copy-share').textContent='Copied!';}catch{$('#share-link').select();notice('Select and copy the link from the box.');}};
if(readOnly){
 document.querySelector('#viewer-owner-login')?.removeAttribute('hidden');
 $('[data-tab=emails]').hidden=false;$('[data-tab=emails]').disabled=false;$('#emails').hidden=true;$('#email-dialog').hidden=true;$('#email-recipient').value='';$('#email-body').value='';
 $('.warm .text-link').textContent='Teacher confirmations are managed by the project lead.';$('.warm small').textContent='Open Email drafts to see how to request authorization.';$('#emails .section-bar p').textContent='Access to teacher email drafts requires authorization from the project lead.';
 for(const selector of ['#add-assignment','#sync-settings','#add-visit','#add-rotation','#import','#export','#share'])$(selector).hidden=true;
 $('.storage-note').innerHTML='This is a fixed snapshot. <a href="view.html">Open the current live schedule</a> for updates.';
 $('footer').innerHTML='<span class="badge">VIEW-ONLY SCHEDULE</span>';
 $('#view-banner').hidden=false;
 if(shareError){$('#view-banner').textContent='This shared link is invalid. Showing the original proposed schedule; ask Valerie for a new link.';}
}

$('#copy-email').onclick=async()=>{if(readOnly||!ownerReady)return;try{await navigator.clipboard.writeText($('#email-body').value);$('#copy-email').textContent='Copied!';}catch{$('#email-body').select();notice('Select and copy the draft text.');}};

function liveUrl(config){
 const url=new URL(location.href);url.pathname=url.pathname.replace(/[^/]*$/,'')+'view.html';url.search='';url.hash=new URLSearchParams({live:JSON.stringify({url:config.url,key:config.key,planId:config.planId})}).toString();return url.href;
}
function openAssignment(a,date){
 if((!readOnly&&!ownerReady)||(readOnly&&!a))return;
 const f=$('#assignment-form');f.reset();$('#assignment-error').textContent='';
 f.elements.id.value=a?.id||'';f.elements.date.value=a?.date||date||'';
 f.elements.role.innerHTML='<option value="">Choose a role</option>'+assignmentRoles.map(r=>`<option>${esc(r)}</option>`).join('');
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
 e.preventDefault();if(readOnly||!ownerReady)return;
 const data=new FormData(e.target);const assignment=Object.fromEntries(data);delete assignment.assignee;
 assignment.assignees=data.getAll('assignee');assignment.description=assignment.description.trim();
 const error=validateAssignment(assignment,state);if(error){$('#assignment-error').textContent=error;return;}
 assignment.id=assignment.id||crypto.randomUUID();
 const i=state.assignments.findIndex(a=>a.id===assignment.id);if(i<0)state.assignments.push(assignment);else state.assignments[i]=assignment;
 const d=new Date(assignment.date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));week=d;
 save();$('#assignment-dialog').close();notice('Work assignment saved.');
};
$('#delete-assignment').onclick=()=>{
 if(readOnly||!ownerReady||!confirm('Delete this work assignment?'))return;
 state.assignments=state.assignments.filter(a=>a.id!==$('#assignment-form').elements.id.value);save();$('#assignment-dialog').close();
};
sync=await setupSync({readOnly,hasLocalPlan,localSavedAt,localWriterId,writerId,ownerClient:ownerAccess?.client,getState:()=>structuredClone(state),applyState:incoming=>{
 if(!validState(incoming))throw Error('The shared schedule has an unsupported format.');cloudLoaded=true;
 state=normalizeAssignments(incoming);
 const movedToPending=moveGornailToPending(state);
 const teamsUpdated=applyNewPresentationTeams(state);
 changeBaseline=changeSnapshot(state);
 if((movedToPending||teamsUpdated)&&!readOnly)setTimeout(()=>{if(ownerReady)save();},0);
 if(!state.rotations.some(r=>r.id===rotationId))rotationId=state.rotations.at(-1).id;
 if(!readOnly)try{localStorage.setItem(key,JSON.stringify(state));localSavedAt=Date.now();localStorage.setItem('cuped-planner-saved-at',String(localSavedAt));localStorage.setItem('cuped-planner-writer',writerId);}catch{}
 render();
},onStatus:text=>{$('#sync-status').textContent=text;
 if(!readOnly)$('.storage-note').textContent=text+' · Export a backup to keep a separate copy.';
 if(readOnly&&(new URLSearchParams(location.hash.slice(1)).has('live')||/^(Loading shared calendar|Live view|Could not load shared calendar)/.test(text))){$('.storage-note').textContent=text;$('#view-banner').textContent='View-only live calendar · '+text;$('#calendar').hidden=!cloudLoaded;}
}});

if(!readOnly&&!ownerReady)sync?.destroy();
appStarted=true;
let signingOut=false;
async function logoutEditor(){
 if(readOnly||signingOut)return;
 signingOut=true;lockPlanner();
 try{await ownerAccess?.signOut();}finally{location.reload();}
}
const signOutButton=document.querySelector('#owner-signout');
if(signOutButton){signOutButton.hidden=readOnly;signOutButton.onclick=logoutEditor;}
window.addEventListener('owner-session-signed-out',logoutEditor);
async function verifyEditorAccess(){
 if(readOnly||!ownerReady||verifierBusy||document.hidden)return;
 verifierBusy=true;if(plannerShell)plannerShell.inert=true;
 try{if(!await ownerAccess.verify())lockPlanner();}
 finally{verifierBusy=false;if(plannerShell&&ownerReady)plannerShell.inert=false;}
}
window.addEventListener('focus',verifyEditorAccess);
document.addEventListener('visibilitychange',verifyEditorAccess);
if(!readOnly)setInterval(verifyEditorAccess,60000);

function renderTeamPhoto(){
 const photo=isValidTeamPhoto(state.teamPhoto)?state.teamPhoto:null;
 const image=$('#team-photo-image'),figure=$('#team-photo');
 const active=$('[data-tab=team]').classList.contains('active');
 figure.hidden=!active||(!photo&&readOnly);
 figure.classList.toggle('no-photo',!photo);
 image.hidden=!photo;
 if(photo){if(image.getAttribute('src')!==photo.dataUrl)image.src=photo.dataUrl;image.alt=photo.alt;}
 else image.removeAttribute('src');
 $('#team-photo-controls').hidden=readOnly;
 $('#pick-team-photo').textContent=photo?'Change team photo':'Add team photo';
 $('#remove-team-photo').hidden=!photo;
}
$('#pick-team-photo').onclick=()=>{if(readOnly||!ownerReady)return;$('#team-photo-file').click();};
$('#team-photo-file').onchange=async event=>{
 if(readOnly||!ownerReady)return;
 const file=event.target.files[0];if(!file)return;
 const picker=$('#pick-team-photo');picker.disabled=true;
 try{
  const photo=await fileToTeamPhoto(file);if(!ownerReady)return;
  state.teamPhoto=photo;const stored=save();
  notice(stored?'Team photo saved on this device. Wait for Shared calendar saved to share it with viewers.':'Browser storage is full. Export a backup or confirm Shared calendar saved before closing this page.');
 }catch(error){notice(error.message);}
 finally{picker.disabled=false;event.target.value='';}
};
$('#remove-team-photo').onclick=()=>{
 if(readOnly||!ownerReady||!confirm('Remove the team photo from this schedule?'))return;
 delete state.teamPhoto;save();
};
