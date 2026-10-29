import {schoolDateInfo} from './school-calendar.js';
// Supplied Coral Reef CUPED schedule, revised 09/17/26. These are learning
// sessions/opportunities, not student work assignments or classroom visits.
const months = {
 '2026-09': '8 B P1 T;9 A P1 T;15 A P2 T;16 B P2 T;22 A F1 T;23 B P3 T M;29 B F1 T;30 A P3 T M',
 '2026-10': '6 A F2 T;7 B O;13 B F2 T;14 A P4 T M;20 A F3 T;21 B P4 T M;27 B F3 T;28 A P5 T',
 '2026-11': '4 A F4 T;9 B F4;10 A T;13 A F5 T M;17 B P5 T;18 B F5 T M',
 '2026-12': '1 B T;2 A F6 T;4 A R;7 B F6;8 A T;9 B T M;14 A F7;15 B F7 T;16 A T',
 '2027-01': '5 B T;6 A F8 T M;12 A T;13 B F8 T M;19 B T;20 A F9 T;26 A T;27 B F9 T;28 A T',
 '2027-02': '2 B T;3 B F10 T;9 A T;10 B F10 T M;16 A T;17 B T;23 B T;24 A T M',
 '2027-03': '2 A T;3 B T;9 B T;12 B T M;16 B T;17 A T;30 B T;31 A T M',
 '2027-04': '6 A T;7 B T M;13 B T;14 A T M;20 A T;21 B T;27 B T;28 A T',
 '2027-05': '4 A T;5 B T;11 B T;12 A T M;18 A T;19 B T;25 B T;26 A T;27 B T M'
};
function activity(code) {
 if(code[0]==='P')return {kind:'learning',title:`Classroom presentation ${code.slice(1)} with Rory`,host:'Rory',time:'9:35–11:35 a.m.'};
 if(code[0]==='F')return {kind:'learning',title:`FinEd · Module ${code.slice(1)} with Emory`,host:'Emory',time:'Time not listed'};
 if(code==='R')return {kind:'learning',title:'FinEd · Reality Fair with Emory',host:'Emory',time:'Time not listed'};
 if(code==='T')return {kind:'tabling',title:'Tabling with Rory',host:'Rory',time:'10:30 a.m.–12:44 p.m.'};
 if(code==='M')return {kind:'mobile',title:'Mobile branch',host:null,time:'10:30 a.m.–12:44 p.m.'};
 return {kind:'learning',title:'CUPED orientation',host:null,time:'Time not listed'};
}
export const learningSchedule = Object.entries(months).flatMap(([month,rows])=>rows.split(';').map(row=>{
 const [day,sourceDay,...codes]=row.split(' ');const date=`${month}-${day.padStart(2,'0')}`;
 const school=schoolDateInfo(date);
 return {id:'cuped-learning-'+date,date,sourceDay,day:school.day||sourceDay,
  dayWarning:school.day&&school.day!==sourceDay?`Schedule PDF lists ${sourceDay}-Day; the school calendar lists ${school.day}-Day. Confirm with the program team.`:'',
  mobile:codes.includes('M'),activities:codes.map(activity)};
}));
export function learningOn(date, filter='All') {
 return learningSchedule.filter(event=>event.date===date&&(filter==='All'||event.day===filter));
}
