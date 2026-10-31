// Coral Reef's school week follows Miami time, regardless of the viewer's device zone.
export function defaultSchoolWeek(now=new Date()) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
 const monday=new Date(parts.year,parts.month-1,parts.day,12);
 const day=monday.getDay();
 monday.setDate(monday.getDate()+(day===6?2:day===0?1:1-day));
 return monday;
}
