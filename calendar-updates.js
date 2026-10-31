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
   const title=(item[name]||label)+(key==='assignments'?' assignment':'');
   if(!previous){messages.push(`${title}: added${item.date?' for '+item.date:''}.`);continue;}
   const important=key==='visits'?['date','start','end','status','room','teacher','presenters']:['date','role','status','assignees'];
   if(important.every(field=>same(previous[field],item[field])))continue;
   const changes=[];
   if(previous.status!==item.status)changes.push(`marked ${item.status}`);
   if(previous.date!==item.date)changes.push(item.date?`rescheduled to ${item.date}`:'awaiting a new date');
   if(!changes.length)changes.push('schedule or team updated');
   messages.push(`${title}: ${changes.join(', ')}.`);
  }
  for(const item of old.values())messages.push(`${item[name]}${key==='assignments'?' assignment':''}: removed.`);
 }
 if(!same(before.presenters,after.presenters))messages.push('Presentation teams updated.');
 if(!same(before.rotations,after.rotations))messages.push('Team rotation assignments updated.');
 return messages;
}
function rawUpdates(state) {
 return Object.values(state.calendarUpdates||{}).filter(entry=>entry&&typeof entry.id==='string'&&typeof entry.at==='string'&&Array.isArray(entry.messages)&&entry.messages.every(m=>typeof m==='string')).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export function recordCalendarChanges(before,state,{id=crypto.randomUUID(),at=new Date().toISOString()}={}) {
 const messages=describeChanges(before,state);if(!messages.length)return false;
 state.calendarUpdates={...state.calendarUpdates,[id]:{id,at,messages}};
 state.calendarUpdates=Object.fromEntries(rawUpdates(state).slice(0,100).map(entry=>[entry.id,entry]));return true;
}
function conciseMessage(message){
 if(/Teacher directory details|Student roster details/.test(message))return '';
 if(/^Presentation teams updated:|^New presentation teams announced/.test(message))return 'Presentation teams updated.';
 if(message.includes(' → ')){
  const title=message.split(':')[0];
  const status=message.match(/status: [^;]* → ([^;.]+)/);
  const date=message.match(/date: [^;]* → (\d{4}-\d{2}-\d{2})/);
  return `${title}: ${[status?`marked ${status[1]}`:'',date?`rescheduled to ${date[1]}`:''].filter(Boolean).join(', ')||'schedule updated'}.`;
 }
 if(/: details updated\.$/.test(message))return '';
 return message;
}
export function recentUpdates(state,limit=30) {
 const days=new Map();
 for(const entry of rawUpdates(state)){
  const date=entry.at.length===10?entry.at:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(entry.at));
  if(!days.has(date))days.set(date,{id:`digest-${date}-${entry.id}`,at:entry.at,messages:[],subjects:new Set()});
  const digest=days.get(date);
  for(const raw of entry.messages){
   const message=conciseMessage(raw);if(!message)continue;
   const subject=message.includes(':')?message.split(':')[0]:message;
   if(digest.subjects.has(subject))continue;
   digest.subjects.add(subject);digest.messages.push(message);
  }
 }
 return [...days.values()].filter(day=>day.messages.length).slice(0,limit).map(({subjects,...day})=>day);
}
export function teacherProgress(state,status){const visits=state.visits.filter(v=>v.status===status);return {teachers:new Set(visits.map(v=>v.teacher)).size,visits:visits.length};}
