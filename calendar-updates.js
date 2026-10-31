export const newPresentationTeams = ['Ella Corea','Esmeralda Martinez','Damian Bautista','Samantha Calvo-Ferrer','Cathy Vu','Dora Sofia','Ava Cardona','Alexis Armenteros'];
export function applyNewPresentationTeams(state) {
 if(state.presenterTeamRevision==='2026-10-30')return false;
 state.presenters=[...newPresentationTeams];state.presenterTeamRevision='2026-10-30';
 state.calendarUpdates={...state.calendarUpdates,'teams-2026-10-30':{id:'teams-2026-10-30',at:'2026-10-30',messages:['New presentation teams announced. A-Day: Ella Corea, Esmeralda Martinez, Damian Bautista, Samantha Calvo-Ferrer. B-Day: Cathy Vu, Dora Sofia, Ava Cardona, Alexis Armenteros.']}};
 return true;
}
export function changeSnapshot(state) {
 return structuredClone({visits:state.visits||[],assignments:state.assignments||[],presenters:state.presenters||[],rotations:state.rotations||[],teachers:state.teachers||[],students:state.students||[]});
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function describeChanges(before,after) {
 if(!before)return [];
 const messages=[];
 for(const [key,name,label] of [['visits','teacher','Visit'],['assignments','role','Work assignment']]){
  const old=new Map((before[key]||[]).map(item=>[item.id,item]));
  for(const item of after[key]||[]){
   const previous=old.get(item.id);old.delete(item.id);
   const title=item[name]||label;
   if(!previous){messages.push(`${label} added: ${title}${item.date?' · '+item.date:''}.`);continue;}
   if(same(previous,item))continue;
   const fields=[];
   for(const field of ['date','start','end','status','room'])if((previous[field]||'')!==(item[field]||''))fields.push(`${field}: ${previous[field]||'not set'} → ${item[field]||'not set'}`);
   if(!same(previous.presenters,item.presenters)||!same(previous.assignees,item.assignees))fields.push('students updated');
   if(previous.notes!==item.notes||previous.description!==item.description)fields.push('details updated');
   messages.push(`${title}: ${fields.join('; ')||'updated'}.`);
  }
  for(const item of old.values())messages.push(`${label} removed: ${item[name]}${item.date?' · '+item.date:''}.`);
 }
 if(!same(before.presenters,after.presenters))messages.push('Presentation teams updated: '+after.presenters.join(', ')+'.');
 if(!same(before.rotations,after.rotations))messages.push('Team rotation assignments updated.');
 if(!same(before.teachers,after.teachers))messages.push('Teacher directory details updated.');
 if(!same(before.students,after.students))messages.push('Student roster details updated.');
 return messages;
}
export function recordCalendarChanges(before,state,{id=crypto.randomUUID(),at=new Date().toISOString()}={}) {
 const messages=describeChanges(before,state);if(!messages.length)return false;
 state.calendarUpdates={...state.calendarUpdates,[id]:{id,at,messages}};
 const entries=recentUpdates(state,30);state.calendarUpdates=Object.fromEntries(entries.map(entry=>[entry.id,entry]));return true;
}
export function recentUpdates(state,limit=30) {
 return Object.values(state.calendarUpdates||{}).filter(entry=>entry&&typeof entry.id==='string'&&typeof entry.at==='string'&&Array.isArray(entry.messages)&&entry.messages.every(m=>typeof m==='string')).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id)).slice(0,limit);
}
export function teacherProgress(state,status){const visits=state.visits.filter(v=>v.status===status);return {teachers:new Set(visits.map(v=>v.teacher)).size,visits:visits.length};}
