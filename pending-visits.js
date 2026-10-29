// Requested correction after the October 29 B-Day presentations.
export function moveGornailToPending(state) {
 const visit=state.visits.find(v=>v.id==='first-week-2026-10-29-2'&&v.teacher==='Mr. Gornail'&&v.date==='2026-10-29'&&['Planned','Confirmed'].includes(v.status));
 if(!visit)return false;
 visit.previousDate=visit.date;visit.date='';visit.status='Pending';
 visit.start='';visit.end='';
 visit.notes=[visit.notes,'October 29 visit did not take place because Mr. Gornail had lunch. Pending a new B-Day date and time; confirm instructional availability before rescheduling.'].filter(Boolean).join('\n');
 return true;
}
export function pendingVisits(state,filter='All') {
 return state.visits.filter(v=>v.status==='Pending'&&!v.date&&(filter==='All'||v.day===filter));
}
