// Rotation requested by the project lead after reviewing the supplied October and November screenshots.
export const novemberAssignments = {
  "Valerie Gutierrez": "Project Lead",
  "Aadi Shah": "Social Media",
  "Ella Corea": "Student Recruitment",
  "Esmeralda Martinez": "Content Creation",
  "Damian Bautista": "Teacher Outreach",
  "Samantha Calvo-Ferrer": "Mobile Branch Promotion",
  "Jazmyn Santiago": "Teacher Outreach",
  "Addisyn Hinds": "Content Creation",
  "Amanda Posner": "Mobile Branch Promotion",
  "Rudy Ramos": "Presentations",
  "Yan Lastre": "Social Media",
  "Cathy Vu": "Teacher Outreach",
  "Dora Sofia": "Content Creation",
  "Ava Cardona": "Student Recruitment",
  "Ava Sardinas": "Social Media",
  "Alexis Armenteros": "Content Creation",
  "Camori Bruins": "Student Recruitment",
  "Daniela Sofia": "Teacher Outreach",
  "Jolie Chirino": "Social Media",
  "Anthony Vargas": "Mobile Branch Promotion",
  "Samantha Ramirez": "Mobile Branch Promotion",
  "Maria Paula-Pajares": "Content Creation"
};
export const verifiedPriorRoles = {
  "Cathy Vu": [
    "Social Media",
    "Mobile Branch Promotion"
  ],
  "Aadi Shah": [
    "Teacher Outreach",
    "Content Creation"
  ],
  "Dora Sofia": [
    "Mobile Branch Promotion",
    "Student Recruitment"
  ],
  "Ella Corea": [
    "Teacher Outreach",
    "Social Media"
  ],
  "Rudy Ramos": [
    "Mobile Branch Promotion",
    "Teacher Outreach"
  ],
  "Yan Lastre": [
    "Mobile Branch Promotion",
    "Student Recruitment"
  ],
  "Ava Cardona": [
    "Mobile Branch Promotion",
    "Social Media"
  ],
  "Ava Sardinas": [
    "Mobile Branch Promotion",
    "Student Recruitment"
  ],
  "Addisyn Hinds": [
    "Social Media",
    "Teacher Outreach"
  ],
  "Amanda Posner": [
    "Content Creation",
    "Student Recruitment"
  ],
  "Camori Bruins": [
    "Content Creation",
    "Mobile Branch Promotion"
  ],
  "Daniela Sofia": [
    "Student Recruitment",
    "Social Media"
  ],
  "Jolie Chirino": [
    "Teacher Outreach",
    "Mobile Branch Promotion"
  ],
  "Anthony Vargas": [
    "Student Recruitment",
    "Teacher Outreach"
  ],
  "Damian Bautista": [
    "Student Recruitment",
    "Mobile Branch Promotion"
  ],
  "Jazmyn Santiago": [
    "Social Media",
    "Mobile Branch Promotion"
  ],
  "Samantha Ramirez": [
    "Teacher Outreach",
    "Content Creation"
  ],
  "Alexis Armenteros": [
    "Mobile Branch Promotion",
    "Student Recruitment"
  ],
  "Valerie Gutierrez": [
    "Project Lead",
    "Project Lead"
  ],
  "Esmeralda Martinez": [
    "Student Recruitment",
    "Mobile Branch Promotion"
  ],
  "Maria Paula-Pajares": [
    "Social Media",
    "Teacher Outreach"
  ],
  "Samantha Calvo-Ferrer": [
    "Student Recruitment",
    "Social Media"
  ]
};
export const novemberPresenters = ['Jazmyn Santiago','Amanda Posner','Rudy Ramos','Jolie Chirino','Daniela Sofia','Ava Sardinas'];
const priorPresentationTeams = ["Addisyn Hinds","Aadi Shah","Rudy Ramos","Yan Lastre","Samantha Ramirez","Camori Bruins","Maria Paula-Pajares","Anthony Vargas","Ella Corea","Esmeralda Martinez","Damian Bautista","Samantha Calvo-Ferrer","Cathy Vu","Dora Sofia","Ava Cardona","Alexis Armenteros"];
const start='2026-11-16',end='2026-11-27',revision='2026-11-16';
export function applyNovemberRoles(state){
 if(state.novemberRolesApplied===revision)return applyRudyPresentationChange(state);
 const names=state.students.map(student=>student.name);
 if(names.length!==Object.keys(novemberAssignments).length||names.some(name=>!Object.hasOwn(novemberAssignments,name))||new Set(names).size!==names.length)return {changed:false,issue:'The roster differs from the verified 22-student roster. Review the new rotation with the project lead before applying it.'};
 const past=state.rotations.filter(rotation=>rotation.end<start);
 const target=state.rotations.find(rotation=>rotation.start===start&&rotation.end===end);
 if(state.rotations.some(rotation=>rotation!==target&&rotation.start<=end&&rotation.end>=start))return {changed:false,issue:'An existing rotation overlaps November 16–27. Review its dates before applying the new assignments.'};
 for(const name of names){
  if(name==='Valerie Gutierrez')continue;
  const previous=new Set(verifiedPriorRoles[name]||[]);
  for(const rotation of past)if(rotation.assignments[name])previous.add(rotation.assignments[name]);
  const student=state.students.find(s=>s.name===name);if(student.role)previous.add(student.role);
  if(previous.has(novemberAssignments[name]))return {changed:false,issue:`${name} has already had ${novemberAssignments[name]} in the recorded history. The new rotation was not applied; choose an unused role.`};
 }
 if(target&&Object.values(target.assignments).some(role=>role))return {changed:false,issue:'November 16–27 already has role assignments. They were preserved; review this rotation before applying a replacement.'};
 const used=new Set(priorPresentationTeams);
 for(const rotation of past)for(const [name,role] of Object.entries(rotation.assignments))if(role==='Presentations')used.add(name);
 for(const visit of state.visits)if(visit.date&&visit.date<start&&visit.status!=='Cancelled')for(const name of visit.presenters)used.add(name);
 // Rudy is an explicit project-lead-requested exception to the fresh-presenter rule.
 const repeated=novemberPresenters.filter(name=>name!=='Rudy Ramos'&&used.has(name));
 if(repeated.length)return {changed:false,issue:`Recorded presentation history already includes ${repeated.join(', ')}. The new rotation was not applied; review the unused presenters first.`};
 if(target)target.assignments={...novemberAssignments};
 else state.rotations.push({id:'rotation-2026-11-16',start,end,assignments:{...novemberAssignments}});
 state.rotations.sort((a,b)=>a.start.localeCompare(b.start));
 state.presenters=[...novemberPresenters];
 state.presenterTeamRevision=revision;
 state.novemberRolesApplied=revision;
 state.rudyPresentationRevision=revision;
 state.calendarUpdates={...state.calendarUpdates,'rotation-2026-11-16':{id:'rotation-2026-11-16',at:'2026-11-15',messages:['November 16–27 rotation assigned with new roles; Valerie remains Project Lead.','New presentation teams: A-Day — Jazmyn Santiago, Amanda Posner, and Rudy Ramos. B-Day — Jolie Chirino, Daniela Sofia, and Ava Sardinas.']}};
 return {changed:true,issue:''};
}

export function applyRudyPresentationChange(state){
 if(state.rudyPresentationRevision===revision)return {changed:false,issue:''};
 const target=state.rotations.find(rotation=>rotation.start===start&&rotation.end===end);
 if(!target||!state.students.some(student=>student.name==='Rudy Ramos'&&student.day==='A'))return {changed:false,issue:'Review Rudy’s A-Day roster entry and the November 16–27 rotation before applying this change.'};
 target.assignments['Rudy Ramos']='Presentations';
 if(!state.presenters.includes('Rudy Ramos')){
  const after=state.presenters.indexOf('Amanda Posner');
  if(after>=0)state.presenters.splice(after+1,0,'Rudy Ramos');else state.presenters.push('Rudy Ramos');
 }
 state.rudyPresentationRevision=revision;
 state.calendarUpdates={...state.calendarUpdates,'rudy-presentations-2026-11-16':{id:'rudy-presentations-2026-11-16',at:'2026-11-15',messages:['Rudy Ramos moved from Student Recruitment to Presentations and joined the A-Day presentation team.']}};
 return {changed:true,issue:''};
}
