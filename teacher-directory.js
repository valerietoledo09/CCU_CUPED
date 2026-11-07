import {faculty} from './faculty.js';
// Room column in the supplied Reef Lines directory dated August 26, 2026.
const rooms={'Ms. Vazquez':'104','Mr. Cordova':'241','Mr. Gornail':'111','Ms. Riley':'247','Ms. Depool':'67','Ms. Mercurius':'309','Ms. Macqouid':'106','Mr. McGraw':'263','Ms. Medina':'211','Ms. Salinas':'285','Ms. Eden':'218','Mr. Lorenzo':'54','Mrs. Harrison':'415','Ms. Mirabal':'305','Ms. Bolt':'302'};
export function teacherRoom(teacher){return teacher?.room?.trim()||rooms[teacher?.name]||'';}
export function visitRoom(visit,state){return visit?.room?.trim()||teacherRoom(state?.teachers?.find(teacher=>teacher.name===visit?.teacher))||rooms[visit?.teacher]||'';}
export function applyTeacherDirectory(state){
 if(state.teacherDirectoryRevision==='2026-11-06-mirabal-bolt')return false;
 if(!state.teachers.some(t=>/^(Mrs?\.?|Ms\.?)?\s*Harrison$/i.test(t.name)))state.teachers.push({name:'Mrs. Harrison',email:'',fullName:'SUSAN HARRISON',department:'Mathematics',facultyEmail:'sharrison@dadeschools.net'});
 for(const contact of [
  {name:'Ms. Mirabal',last:'mirabal',room:'305',email:'ammirabal@dadeschools.net',fullName:'ANNA MIRABAL',department:'Business – Lead Teacher'},
  {name:'Ms. Bolt',last:'bolt',room:'302',email:'michellebolt@dadeschools.net',fullName:'MICHELLE BOLT',department:'CTE Teacher'}
 ]){
  let teacher=state.teachers.find(t=>t.name.replace(/^(Ms|Mr|Mrs)\.?\s+/i,'').toLowerCase()===contact.last);
  if(!teacher){teacher={name:contact.name,email:''};state.teachers.push(teacher);}
  for(const field of ['room','email','fullName','department'])if(!teacher[field])teacher[field]=contact[field];
  if(!teacher.facultyEmail)teacher.facultyEmail=contact.email;
 }
 const aliases={'Ms. Depool':'DE POOL','Ms. Macqouid':'MACQUOID'};
 for(const teacher of state.teachers){
  if(!teacher.room&&rooms[teacher.name])teacher.room=rooms[teacher.name];
  const last=aliases[teacher.name]||teacher.name.replace(/^(Ms|Mr|Mrs)\.?\s+/,'').toUpperCase();
  const matches=faculty.filter(f=>f.last===last&&(teacher.name!=='Ms. Riley'||f.first==='TRACEY'));
  if(matches.length===1){const f=matches[0];if(!teacher.email)teacher.email=f.email;if(!teacher.facultyEmail)teacher.facultyEmail=f.email;if(!teacher.fullName)teacher.fullName=f.first+' '+f.last;if(!teacher.department)teacher.department=f.department;}
 }
 state.teacherDirectoryRevision='2026-11-06-mirabal-bolt';return true;
}
