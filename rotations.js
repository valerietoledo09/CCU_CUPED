export function blankRotation(students,start,end,id=crypto.randomUUID()) {
 return {id,start,end,assignments:Object.fromEntries(students.map(student=>[student.name,'']))};
}
export function previousRotation(rotations,current) {
 return rotations.filter(rotation=>rotation.id!==current.id&&rotation.end<current.start).sort((a,b)=>b.end.localeCompare(a.end)||b.start.localeCompare(a.start))[0]||null;
}
