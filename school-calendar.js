// Source: supplied Coral Reef Senior High 2026–2027 A/B school calendar.
// Only instructional dates carry an A/B designation. No recurring visits are created.
export const noSchoolDates = {};
function mark(month, days, label) {
 for (const day of days.split(' ').map(Number)) noSchoolDates[`${month}-${String(day).padStart(2,'0')}`] = label;
}
mark('2026-08','10 12','Teacher planning day');
mark('2026-08','11','Professional learning day');
mark('2026-09','7','Labor Day');
mark('2026-09','21','Teacher planning day');
mark('2026-11','3','Professional learning day');
mark('2026-11','11','Veterans Day');
mark('2026-11','23 24 25 27','Thanksgiving recess');
mark('2026-11','26','Thanksgiving holiday');
mark('2026-12','18','Teacher planning day');
mark('2026-12','21 22 23 24 25 28 29 30 31','Winter recess');
mark('2027-01','1','Winter recess');
mark('2027-01','15','Teacher planning day');
mark('2027-01','18','Martin Luther King Jr. Day');
mark('2027-02','15','Presidents Day');
mark('2027-03','10 29','Teacher planning day');
mark('2027-03','22 23 24 25 26','Spring recess');
mark('2027-05','31','Memorial Day');
mark('2027-06','4','Teacher planning day');
export const schoolDays = {};
let nextDay='A';
for(let date=new Date('2026-08-13T12:00:00Z');date<=new Date('2027-06-03T12:00:00Z');date.setUTCDate(date.getUTCDate()+1)) {
 const key=date.toISOString().slice(0,10);
 if([0,6].includes(date.getUTCDay())||noSchoolDates[key])continue;
 schoolDays[key]=nextDay;nextDay=nextDay==='A'?'B':'A';
}
export function schoolDateInfo(date) {
 const d=new Date(date+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return {day:null,noSchool:false,label:'School day unconfirmed'};
 if([0,6].includes(d.getUTCDay()))return {day:null,noSchool:true,label:'Weekend · No school'};
 if(noSchoolDates[date])return {day:null,noSchool:true,label:'No school · '+noSchoolDates[date]};
 if(schoolDays[date])return {day:schoolDays[date],noSchool:false,label:schoolDays[date]+'-Day'};
 if(date>='2026-07-01'&&date<='2027-06-30')return {day:null,noSchool:true,label:'No school · Summer break'};
 return {day:null,noSchool:false,label:'School day unconfirmed'};
}
export function calendarRange(anchor, mode='week', includeWeekend=false) {
 const start=new Date(anchor);start.setHours(12,0,0,0);
 if(mode==='month')start.setDate(1);
 start.setDate(start.getDate()-((start.getDay()+6)%7));
 let count=includeWeekend?7:5;
 if(mode==='month') {
  const end=new Date(anchor.getFullYear(),anchor.getMonth()+1,0,12);
  count=Math.ceil((((end-start)/86400000)+1)/7)*7;
 }
 return {start,count,columns:mode==='month'||includeWeekend?7:5};
}
