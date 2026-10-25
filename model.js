import {departmentLunch,roomLunch} from './lunch.js';
import {faculty} from './faculty.js';
export const roles = ['Project Lead','Teacher Outreach','Student Recruitment','Social Media','Content Creation','Mobile Branch Promotion','Presentations'];
const groups = [
 ['Project Lead','A',['Valerie Gutierrez']],
 ['Teacher Outreach','A',['Aadi Shah','Ella Corea']],['Teacher Outreach','B',['Jolie Chirino','Samantha Ramirez']],
 ['Student Recruitment','A',['Esmeralda Martinez','Damian Bautista','Samantha Calvo-Ferrer']],['Student Recruitment','B',['Anthony Vargas','Daniela Sofia']],
 ['Social Media','A',['Jazmyn Santiago','Addisyn Hinds']],['Social Media','B',['Cathy Vu','Maria Paula-Pajares']],
 ['Content Creation','A',['Amanda Posner']],['Content Creation','B',['Camori Bruins']],
 ['Mobile Branch Promotion','A',['Rudy Ramos','Yan Lastre']],['Mobile Branch Promotion','B',['Ava Cardona','Ava Sardinas','Alexis Armenteros','Dora Sofia']]
];
export const students = groups.flatMap(([role,day,names])=>names.map(name=>({name,day,role})));
export const proposed = ['Addisyn Hinds','Aadi Shah','Rudy Ramos','Yan Lastre','Samantha Ramirez','Camori Bruins','Maria Paula-Pajares','Anthony Vargas'];
export const teachers = ['Ms. Vazquez','Mr. Cordova','Mr. Gornail','Ms. Riley','Ms. Depool','Ms. Mercurius','Ms. Macqouid','Mr. McGraw','Ms. Medina','Ms. Salinas','Ms. Eden','Mr. Lorenzo'];
export function initialState(){return {version:1,students:structuredClone(students),teachers:teachers.map(name=>({name,email:''})),rotations:[{id:'october',start:'2026-10-19',end:'2026-10-30',assignments:Object.fromEntries(students.map(s=>[s.name,s.role]))}],presenters:[...proposed],visits:[],firstWeekPlanApplied:false};}
export function validateVisit(v,state,exclude){
 if(!v.date||!v.teacher||!v.start||!v.end||!['A','B'].includes(v.day))return 'Complete the date, teacher, day, and times.';
 if(confirmedDays[v.date]&&confirmedDays[v.date]!==v.day)return 'October 29 is B-Day; October 30 is A-Day.';
 if(v.start>=v.end)return 'End time must be after start time.';
 if(v.start<'09:40'||v.end>'12:00')return 'Visits must fit the 9:40 a.m.–noon presentation window.';
 const lunch=teacherLunch(v,state);
 if(lunch&&overlap(v.start,v.end,lunch[0],lunch[1])&&v.status!=='Cancelled')return 'This teacher’s class is at lunch during part of this visit. Choose instructional time.';
 if(internLunchOverlap(v)&&!v.lunchAcknowledged&&v.status!=='Cancelled')return 'This visit overlaps CCU second lunch (11:35–12:15). Acknowledge the lunch impact to save.';
 if(!v.presenters.length)return 'Select at least one presenter.';
 if(v.presenters.some(n=>!state.students.some(s=>s.name===n&&s.day===v.day)))return 'Presenters must match the selected A/B day.';
 if(state.visits.some(x=>x.status!=='Cancelled'&&v.status!=='Cancelled'&&x.id!==exclude&&x.date===v.date&&x.start<v.end&&x.end>v.start&&(x.teacher===v.teacher||x.presenters.some(n=>v.presenters.includes(n)))))return 'This overlaps another visit for this teacher or a presenter.';
 return '';
}
export function emailDraft(v){return `Good morning ${v.teacher},\n\nCan our CCU CUPED interns visit your classroom on ${v.date} from ${v.start} to ${v.end} to present EdFed membership opportunities?\n\nPresenters: ${v.presenters.join(', ')}.\n\nPlease reply to confirm whether this time works and share your room number.\n\nThank you,\nValerie\nCCU CUPED Project Lead`;}
export function validState(s){return s?.version===1&&Array.isArray(s.students)&&s.students.length>0&&s.students.every(x=>typeof x.name==='string'&&['A','B'].includes(x.day))&&Array.isArray(s.teachers)&&s.teachers.every(t=>typeof t.name==='string'&&typeof t.email==='string')&&Array.isArray(s.rotations)&&s.rotations.length>0&&s.rotations.every(r=>typeof r.id==='string'&&typeof r.start==='string'&&typeof r.end==='string'&&r.assignments&&typeof r.assignments==='object')&&Array.isArray(s.presenters)&&Array.isArray(s.visits)&&s.visits.every(v=>typeof v.id==='string'&&typeof v.date==='string'&&typeof v.teacher==='string'&&typeof v.start==='string'&&typeof v.end==='string'&&Array.isArray(v.presenters)&&v.presenters.every(n=>typeof n==='string'));}

export const confirmedDays = {'2026-10-29':'B','2026-10-30':'A'};
export function applyFirstWeekPlan(state){
 if(state.firstWeekPlanApplied)return state;
 const ava=state.students.find(s=>s.name==='Ava Cardona');
 if(ava&&!state.visits.some(v=>v.presenters.includes(ava.name)&&v.day==='A'))ava.day='B';
 for(const [date,day] of Object.entries(confirmedDays)){
  if(state.visits.some(v=>v.date===date))continue;
  const team=proposed.filter(name=>state.students.some(s=>s.name===name&&s.day===day));
  const names=day==='B'?teachers.slice(0,3):teachers.slice(3,6);
  [['09:40','09:55'],['10:10','10:25'],['10:40','10:55']].forEach(([start,end],i)=>{
   const v={id:`first-week-${date}-${i}`,date,day,start,end,teacher:names[i],room:'',status:'Planned',presenters:[...team],notes:'Proposed teacher and time; confirm availability and room before visiting. Allow 15 minutes between presentations for travel and preparation.'};
   if(!validateVisit(v,state))state.visits.push(v);
  });
 }
 state.firstWeekPlanApplied=true;
 return state;
}

export const lunchWindows = {first:['10:35','11:15'],second:['11:35','12:15']};
export const overlap=(start,end,otherStart,otherEnd)=>start<otherEnd&&end>otherStart;
export function teacherLunch(v,state){
 const teacher=state.teachers.find(t=>t.name===v.teacher);
 return lunchWindows[roomLunch(v.room)||teacher?.lunch?.[v.day]]||null;
}
export function internLunchOverlap(v){return overlap(v.start,v.end,...lunchWindows.second);}
export function visitWarnings(v,state){
 const warnings=[];
 if(internLunchOverlap(v))warnings.push('Overlaps CCU second lunch (11:35–12:15). Plan lunch for the presenters.');
 const lunch=teacherLunch(v,state);
 if(!lunch)warnings.push('Teacher lunch is unconfirmed for this school day. Confirm before visiting.');
 else if(overlap(v.start,v.end,...lunch))warnings.push('Teacher lunch conflict: choose an instructional slot.');
 const roomGroup=roomLunch(v.room);const teacher=state.teachers.find(t=>t.name===v.teacher);
 if(roomGroup&&teacher?.lunch?.[v.day]&&teacher.lunch[v.day]!=='unknown'&&roomGroup!==teacher.lunch[v.day])warnings.push('Room and department lunch groups differ. Room schedule is used; confirm this classroom assignment.');
 if(v.start<'09:40'||v.end>'12:00')warnings.push('Outside the 9:40 a.m.–noon visit window.');
 return warnings;
}
export function enrichTeachers(state){
 for(const teacher of state.teachers)if(teacher.name==='Mr. Gornell')teacher.name='Mr. Gornail';
 for(const visit of state.visits)if(visit.teacher==='Mr. Gornell')visit.teacher='Mr. Gornail';
 const aliases={'Ms. Depool':'DE POOL','Ms. Macqouid':'MACQUOID'};
 for(const teacher of state.teachers){
  if(!teacher.lunch)teacher.lunch={A:'unknown',B:'unknown'};
  const last=aliases[teacher.name]||teacher.name.replace(/^(Ms|Mr)\. /,'').toUpperCase();
  const matches=faculty.filter(f=>f.last===last&&(teacher.name!=='Ms. Riley'||f.first==='TRACEY'));
  if(matches.length===1&&!teacher.facultyEmail){
   const f=matches[0];teacher.fullName=f.first+' '+f.last;teacher.department=f.department;teacher.facultyEmail=f.email;
   if(!teacher.email)teacher.email=f.email;
  }
  const group=departmentLunch(teacher.department);
  if(group)for(const day of ['A','B'])if(!teacher.lunch[day]||teacher.lunch[day]==='unknown')teacher.lunch[day]=group;
 }
 if(!state.schoolLunchScheduleApplied){
  for(const v of state.visits){
   if(v.id==='first-week-2026-10-29-2'&&v.teacher==='Mr. Gornail'&&v.status==='Planned'&&v.start==='10:40'&&v.end==='10:55'){
    const revised={...v,start:'11:15',end:'11:30'};
    if(!validateVisit(revised,state,v.id)){v.start=revised.start;v.end=revised.end;}
   }
  }
  state.schoolLunchScheduleApplied=true;
 }
 return state;
}
